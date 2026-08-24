import sys
sys.path.insert(0, "pipeline")

from triage_agent import run_triage
from system_prompt_store import load_system_prompt

live_prompt = load_system_prompt()

scenarios = [
    {
        "name": "none (praise, no gap)",
        "context": {
            "trigger_type": "comment",
            "source_text": "This one was perfect, exactly what I would have written.",
            "customer_message": "Thank you!",
            "ai_draft_reply": "You're very welcome. Please let us know if we can assist with anything else.",
        },
    },
    {
        "name": "prompt_fix (real gap - re-testing the return-tracking rule as if it never existed)",
        "context": {
            "trigger_type": "comment",
            "source_text": "The AI should never offer store credit as an option anywhere - Ergode never does store credit, only cash refunds or keep-it discounts. This draft offered '$10 store credit' which we never do.",
            "customer_message": "This is broken, can I get $10 off instead of returning it?",
            "ai_draft_reply": "We can offer you $10 in store credit to keep the item instead of returning it.",
        },
    },
    {
        "name": "code_restriction (deterministic guarantee, not prompt-fixable)",
        "context": {
            "trigger_type": "comment",
            "source_text": "The AI keeps writing the customer's raw order total with 4 decimal places like $36.1971 instead of rounding to $36.20 - this happens no matter how we word the instruction, it's clearly not reading the rounding rule reliably. We need this to just always be forced to 2 decimals in code, not left to the model.",
            "customer_message": "What's my order total?",
            "ai_draft_reply": "Your order total is $36.1971.",
        },
    },
    {
        "name": "data_restriction (AI never sees this field at all)",
        "context": {
            "trigger_type": "comment",
            "source_text": "The customer asked if their order was flagged for a customs delay, and the AI had no idea because we never pass customs-hold status to it at all - it's not in order_facts anywhere, so there was nothing it could have said even with a perfect prompt.",
            "customer_message": "Is my package stuck in customs?",
            "ai_draft_reply": "We don't have a specific update on your package's location right now.",
        },
    },
]

for s in scenarios:
    print("=" * 70)
    print(s["name"])
    print("=" * 70)
    result = run_triage(s["context"], live_prompt)
    print("outcome:", result.get("outcome"))
    print("reason:", result.get("reason"))
    if result.get("outcome") == "prompt_fix":
        pc = result.get("proposed_content", "")
        print("proposed_content length:", len(pc), "(live prompt length:", len(live_prompt), ")")
        print("contradiction_check:", result.get("contradiction_check"))
    print()
