"""
thread_parser.py
-----------------
Turns the raw categorizations.zip export into clean, structured thread data.

The zip has one folder per thread, e.g. "categorizations/1767049/", containing
numbered message files like "1_message_in_873211.txt" and
"2_message_out_213438.txt". Inbound ("_in_") messages are the raw Amazon
notification email, full of boilerplate. Outbound ("_out_") messages are
already the clean reply text an agent sent.

This file's only job is: read the zip, and for every thread produce a list of
messages in order, each with the boilerplate stripped and the useful bits
(order id, the customer's actual words, whether this is a marketplace
representative relaying on the customer's behalf) pulled out.

Run this file directly to parse the whole zip once and cache the result as
JSON files under data/parsed_threads/, so later steps don't need to touch the
zip again.
"""

import json
import re
import zipfile
from pathlib import Path

from config import ZIP_PATH, PARSED_THREADS_DIR

# Matches filenames like "1_message_in_873211.txt" -> seq=1, direction="in"
FILENAME_PATTERN = re.compile(r"^(\d+)_message_(in|out)_\d+\.txt$")

# Phrases that show up when a marketplace rep is relaying on the customer's
# behalf, rather than the customer writing to us directly. Seeing any of
# these inside the message body flags it as a "relay" message.
RELAY_PHRASES = [
    "this is amazon's customer service team",
    "this is amazon’s customer service team",
    "dear amazon seller",
    "reason for contact:",
]


# Seen inline in A-to-z claim notices: "-- Order number: 702-3395804-1992244"
ORDER_ID_INLINE_PATTERN = re.compile(r"Order (?:ID|number):\s*([A-Z0-9\-]+)", re.IGNORECASE)


def extract_order_id(raw_text: str) -> str | None:
    """
    Pull the order id out of the raw text. Amazon uses more than one
    layout for this across notice types: a line ENDING in "Order ID:"
    (sometimes prefixed, e.g. "Buyer Cancellation Request for Order ID:")
    followed by the id on the next line - with a trailing colon or period
    depending on the notice - or an inline "Order number: X" on one line
    (seen in A-to-z claims).
    """
    lines = [line.strip() for line in raw_text.splitlines()]
    for i, line in enumerate(lines):
        if line.endswith("Order ID:"):
            for next_line in lines[i + 1:]:
                if next_line:
                    return next_line.strip(".:").strip()

    inline_match = ORDER_ID_INLINE_PATTERN.search(raw_text)
    return inline_match.group(1) if inline_match else None


def extract_customer_message(raw_text: str) -> str:
    """
    Pull just the customer's (or relaying rep's) actual words out of the
    email, cutting away Amazon's surrounding boilerplate.

    The real content always sits between a line that says "Message:" and a
    line that says "View Message". If that marker pair isn't found (some
    older/odd formats), fall back to returning the whole text so nothing is
    silently lost.
    """
    lines = raw_text.splitlines()
    start = None
    end = None
    for i, line in enumerate(lines):
        if line.strip() == "Message:":
            start = i + 1
        elif line.strip() == "View Message" and start is not None:
            end = i
            break

    if start is None or end is None:
        return raw_text.strip()

    body_lines = [line for line in lines[start:end] if line.strip()]
    return "\n".join(body_lines).strip()


def is_relay_message(customer_text: str) -> bool:
    """True if this message is a marketplace rep relaying for the customer."""
    lowered = customer_text.lower()
    return any(phrase in lowered for phrase in RELAY_PHRASES)


# The five headers of Amazon's return-authorization table that render
# reliably; the sixth ("Customer's Comment") has an apostrophe that varies
# by encoding, so it's matched separately rather than by exact text.
RETURN_NOTICE_HEADERS = ["Order Item", "ASIN", "SKU", "Return Quantity", "Return Reason"]


def extract_return_authorization_details(raw_text: str) -> dict | None:
    """
    Parse Amazon's fixed-format 'Return authorization request' system
    notice - a structured table (product / ASIN / SKU / quantity / return
    reason / customer comment), not free customer text.

    Text extraction flattens the table into two blocks: all six column
    headers in order, then all six values in the same order. Once the
    headers are found, the next six lines are the values, positionally.

    This exists because that raw notice also contains Amazon's own
    boilerplate and sign-off ("Thank you, Amazon Services") - without this,
    the whole notice gets treated as "the customer's message" and an AI
    reply ends up addressed to Amazon instead of the actual buyer. It also
    recovers the Return Reason, an enumerated code (e.g. "Better price
    available") that maps cleanly onto buyer-remorse vs. damaged/defective
    - exactly the deterministic signal the return-request category needs
    and free-text extraction would otherwise throw away.
    """
    if "Return authorization request for order" not in raw_text:
        return None

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    try:
        start = lines.index("Order Item")
    except ValueError:
        return None

    if lines[start : start + 5] != RETURN_NOTICE_HEADERS:
        return None  # table shape doesn't match what we expect - bail out safely

    values = lines[start + 6 : start + 12]  # skip 5 known headers + 1 comment header
    if len(values) < 6:
        return None

    return {
        "product_name": values[0],
        "return_reason": values[4],
        "customer_comment": values[5],
    }


def is_cancellation_notice(raw_text: str) -> bool:
    """
    True for Amazon's 'Buyer Cancellation Request' system notice - the
    single largest category in the corpus (30% of threads). It carries no
    reason code and no free text to extract; it's a policy notice plus an
    order id, wrapped in the same kind of boilerplate ("The Amazon
    Marketplace team" sign-off, opt-out footer) that caused the return-
    notice bug. There's nothing to lose by summarizing it instead of
    keeping that boilerplate as if it were something the customer wrote.
    """
    lowered = raw_text.strip().lower()
    return lowered.startswith("hello,") and "cancellation request" in lowered[:400]


def extract_a_to_z_claim_details(raw_text: str) -> dict | None:
    """
    Parse Amazon's A-to-z Guarantee claim notice. Low volume (~1% of the
    corpus) but high-risk: it carries a hard 72-hour deadline and a
    specific dollar claim amount - exactly the kind of detail that must
    not get lost inside unstructured boilerplate, and the corpus notes
    call out that neither this nor the invoice-discrepancy case are
    covered by the existing prompt at all.
    """
    if "a-to-z guarantee claim" not in raw_text[:200].lower():
        return None

    claim_amount = re.search(r"Claim amount:\s*(\$[\d.,]+)", raw_text)
    return_carrier = re.search(r"Return carrier:\s*(.+)", raw_text)
    return_tracking = re.search(r"Return tracking number:\s*(\S+)", raw_text)

    return {
        "claim_amount": claim_amount.group(1) if claim_amount else "not specified",
        "return_carrier": return_carrier.group(1).strip() if return_carrier else "not specified",
        "return_tracking": return_tracking.group(1) if return_tracking else "not specified",
    }


def parse_inbound_message(raw_text: str) -> dict:
    """
    Build the structured fields for a message_in file.

    Checked in priority order: each structured Amazon notice type first
    (deterministic, no ambiguity about what kind of email this is), and
    only if none of them match does this fall back to free-text
    extraction for a genuine buyer message.
    """
    return_details = extract_return_authorization_details(raw_text)
    a_to_z_details = None if return_details else extract_a_to_z_claim_details(raw_text)

    if return_details:
        customer_text = (
            "[Amazon system notice: return authorization request]\n"
            f"Product: {return_details['product_name']}\n"
            f"Return reason (Amazon's enum): {return_details['return_reason']}\n"
            f"Customer's comment: {return_details['customer_comment']}"
        )
    elif a_to_z_details:
        customer_text = (
            "[Amazon system notice: A-to-z Guarantee claim - urgent, 72-hour deadline]\n"
            f"Claim amount: {a_to_z_details['claim_amount']}\n"
            f"Return carrier: {a_to_z_details['return_carrier']}\n"
            f"Return tracking number: {a_to_z_details['return_tracking']}"
        )
    elif is_cancellation_notice(raw_text):
        customer_text = (
            "[Amazon system notice: buyer cancellation request]\n"
            "Buyer asked to cancel this order before it shipped."
        )
    else:
        customer_text = extract_customer_message(raw_text)

    return {
        "order_id": extract_order_id(raw_text),
        "text": customer_text,
        "is_relay": is_relay_message(customer_text),
    }


def parse_outbound_message(raw_text: str) -> dict:
    """Outbound files are already clean agent replies - just trim whitespace."""
    return {
        "order_id": None,
        "text": raw_text.strip(),
        "is_relay": False,
    }


def parse_zip(zip_path: Path = ZIP_PATH) -> dict[str, list[dict]]:
    """
    Read the whole zip and return {thread_id: [messages...]}, each thread's
    messages sorted in the order they actually happened.
    """
    threads: dict[str, list[dict]] = {}

    with zipfile.ZipFile(zip_path) as archive:
        for entry in archive.namelist():
            path_parts = Path(entry).parts
            # Expected shape: categorizations/<thread_id>/<file>.txt
            if len(path_parts) != 3 or not entry.endswith(".txt"):
                continue

            thread_id, filename = path_parts[1], path_parts[2]
            match = FILENAME_PATTERN.match(filename)
            if not match:
                continue

            seq, direction = int(match.group(1)), match.group(2)
            raw_text = archive.read(entry).decode("utf-8", errors="replace")

            parsed = (
                parse_inbound_message(raw_text)
                if direction == "in"
                else parse_outbound_message(raw_text)
            )
            parsed["seq"] = seq
            parsed["direction"] = direction

            threads.setdefault(thread_id, []).append(parsed)

    for messages in threads.values():
        messages.sort(key=lambda m: m["seq"])

    return threads


def save_parsed_threads(threads: dict[str, list[dict]]) -> None:
    """Write one JSON file per thread so later steps can skip re-reading the zip."""
    for thread_id, messages in threads.items():
        out_path = PARSED_THREADS_DIR / f"{thread_id}.json"
        out_path.write_text(json.dumps(messages, indent=2, ensure_ascii=False), encoding="utf-8")


def load_parsed_threads() -> dict[str, list[dict]]:
    """Read back the cached JSON files produced by save_parsed_threads()."""
    threads = {}
    for file_path in PARSED_THREADS_DIR.glob("*.json"):
        threads[file_path.stem] = json.loads(file_path.read_text(encoding="utf-8"))
    return threads


if __name__ == "__main__":
    parsed = parse_zip()
    save_parsed_threads(parsed)
    total_messages = sum(len(m) for m in parsed.values())
    print(f"Parsed {len(parsed)} threads, {total_messages} messages.")
    print(f"Saved to {PARSED_THREADS_DIR}")
