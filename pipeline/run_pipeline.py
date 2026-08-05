"""
run_pipeline.py
----------------
The orchestrator. Ties every other pipeline file together into one run:

  1. Parse the zip into clean threads (thread_parser.py)
  2. Build the AI's briefing note for every real reply (context_builder.py)
  3. Ask OpenAI to draft its own version of that reply (draft_generator.py)
  4. Compare our draft against what was actually sent (comparison.py)
  5. Save everything as one report (report_builder.py)

Usage:
    python run_pipeline.py                 # run every case
    python run_pipeline.py --limit 5        # quick test on the first 5 cases
    python run_pipeline.py --thread 1767049  # only this one thread
"""

import argparse
from typing import List, Optional

from openai import OpenAI

import thread_parser
import report_builder
from config import OPENAI_API_KEY, require_openai_key
from context_builder import build_all_eval_cases
from draft_generator import generate_draft
from comparison import compare_pair
from order_lookup_client import fetch_order_facts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the draft-vs-real comparison pipeline.")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N cases.")
    parser.add_argument("--thread", type=str, default=None, help="Only process this thread id.")
    return parser.parse_args()


def collect_cases(thread_filter: Optional[str]) -> List[dict]:
    """Flatten {thread_id: [cases]} into one list, each case tagged with its thread id."""
    all_cases = build_all_eval_cases()
    flat = []
    for thread_id, cases in all_cases.items():
        if thread_filter and thread_id != thread_filter:
            continue
        for case in cases:
            flat.append({"thread_id": thread_id, **case})
    return flat


def run() -> None:
    args = parse_args()
    require_openai_key()

    print("Step 1/3: parsing the zip into clean threads...")
    thread_parser.save_parsed_threads(thread_parser.parse_zip())

    print("Step 2/3: building briefing notes for every real reply...")
    cases = collect_cases(args.thread)
    if args.limit:
        cases = cases[: args.limit]
    print(f"  {len(cases)} case(s) to run.")

    print("Step 3/3: generating drafts and comparing against real replies...")
    client = OpenAI(api_key=OPENAI_API_KEY)
    results = []
    for i, case in enumerate(cases, start=1):
        print(f"  [{i}/{len(cases)}] thread {case['thread_id']}, reply #{case['reply_seq']}")

        # Enrich with real order facts (recipient name, tracking, etc.) from
        # the live Order API, the same data Order Lookup uses - this is what
        # closes the "why does the draft say [Name] instead of the real
        # customer" gap for the historical batch too. Best-effort: if the
        # Express server isn't running or the order no longer exists, this
        # returns None and the case runs exactly as it did before.
        case["context"]["order_facts"] = fetch_order_facts(case["context"]["order_id"])

        draft_reply = generate_draft(case["context"], client=client)
        comparison = compare_pair(case["actual_reply"], draft_reply)

        results.append(
            {
                "thread_id": case["thread_id"],
                "reply_seq": case["reply_seq"],
                "context": case["context"],
                "actual_reply": case["actual_reply"],
                "draft_reply": draft_reply,
                "comparison": comparison,
            }
        )

    report = report_builder.build_report(results)
    report_builder.save_report(report)

    print("\nDone.")
    print(f"Summary: {report['summary']}")
    print("Saved to MongoDB (pipeline_runs collection).")


if __name__ == "__main__":
    run()
