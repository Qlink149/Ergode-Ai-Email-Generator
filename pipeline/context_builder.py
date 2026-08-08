"""
context_builder.py
-------------------
Builds the "briefing note" the AI sees before it writes a reply - and
nothing more than that. See draft_generator.py's load_system_prompt()
(MongoDB "system_prompts" collection) for the writing rules; this file
only assembles the facts.

For every outbound (agent) reply in a thread, we rebuild the world exactly
as it looked right before that reply was written: the customer message it
answers, plus everything said earlier in the thread. The AI never sees the
real reply it is being compared against - that would defeat the point of
the comparison.
"""

from typing import Dict, List, Optional

from thread_parser import load_parsed_threads


def find_order_id(messages: List[dict], up_to_index: int) -> Optional[str]:
    """
    Walk backward from up_to_index looking for the first known order id.

    Mirrors step 2 of the order-resolution ladder from the design doc: if
    the current message doesn't carry an order id, check the rest of the
    thread's history for one before giving up.
    """
    for message in reversed(messages[: up_to_index + 1]):
        if message.get("order_id"):
            return message["order_id"]
    return None


def build_eval_cases(messages: List[dict]) -> List[dict]:
    """
    Turn one thread's messages into a list of eval cases - one per outbound
    reply that has at least one customer message before it to respond to.

    Each case is:
      {
        "reply_seq": the seq number of the real reply we're recreating,
        "context": the briefing note handed to the AI,
        "actual_reply": the real text an agent actually sent,
      }
    """
    cases = []

    for i, message in enumerate(messages):
        if message["direction"] != "out":
            continue

        # The customer message this reply is answering: the closest
        # inbound message before it.
        trigger = next(
            (m for m in reversed(messages[:i]) if m["direction"] == "in"),
            None,
        )
        if trigger is None:
            # An outbound message with nothing before it to respond to -
            # there is nothing meaningful to evaluate here.
            continue

        # Everything before this reply, minus the trigger message itself
        # (that gets its own field so the prompt can call it out clearly).
        history = [m for m in messages[:i] if m is not trigger]

        context = {
            "customer_message": trigger["text"],
            "is_relay": trigger["is_relay"],
            "order_id": find_order_id(messages, i - 1),
            "thread_history": [
                {"direction": m["direction"], "text": m["text"]} for m in history
            ],
        }

        cases.append(
            {
                "reply_seq": message["seq"],
                "context": context,
                "actual_reply": message["text"],
            }
        )

    return cases


def build_all_eval_cases() -> Dict[str, List[dict]]:
    """Build eval cases for every parsed thread. Returns {thread_id: [cases]}."""
    threads = load_parsed_threads()
    return {
        thread_id: build_eval_cases(messages) for thread_id, messages in threads.items()
    }


if __name__ == "__main__":
    all_cases = build_all_eval_cases()
    total = sum(len(cases) for cases in all_cases.values())
    print(f"Built {total} eval cases across {len(all_cases)} threads.")
