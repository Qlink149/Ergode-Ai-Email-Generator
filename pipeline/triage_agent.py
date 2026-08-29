"""
triage_agent.py
----------------
Runs automatically whenever a support agent posts a Comment or edits a
draft with "permanent fix" checked (see routers/triage.py and
routers/draft_edit.py's edit_draft()). Reads the feedback plus the case it
was left on, against the CURRENT live system prompt, and decides one of
four outcomes:

- "none"              - no gap the AI could find; still recorded for a
                          human to see and dismiss, just never auto-applied
- "prompt_fix"         - a system-prompt rule is missing or wrong; drafts an
                          exact-anchor insertion/replacement (never a full
                          document rewrite - see the anchor_text field
                          below), held as a pending proposal (see
                          prompt_proposal_store.py) until a human approves
                          it - never auto-applied
- "code_restriction"   - can only be fixed by an actual code change
- "data_restriction"   - needs data from the CRM/Order API that never
                          reaches the AI today

Every outcome is recorded somewhere a human can see it - "prompt_fix" as a
proposal (prompt_proposal_store.py), the other three as an escalation
(escalation_store.py) - so nothing the AI decides is ever invisible. Only
a prompt_fix proposal has an action to take (approve/reject); the rest
are acknowledged, not applied.

The three system-prompt strings these calls use live in triage_prompts.py
- split out purely for length, no logic there.
"""

import json
from typing import Optional

from openai import BadRequestError, OpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL, require_openai_key
from escalation_store import save_escalation
from prompt_proposal_store import save_prompt_proposal
from system_prompt_store import load_system_prompt
from triage_prompts import (
    TRIAGE_INSTRUCTIONS,
    TRIAGE_FALLBACK,
    RECHECK_INSTRUCTIONS,
    RECHECK_FALLBACK,
    OVERRIDE_INSTRUCTIONS,
    OVERRIDE_FALLBACK,
)


def _format_case_block(context: dict) -> str:
    lines = []
    if context.get("order_id"):
        lines.append(f"Order ID: {context['order_id']}")
    if context.get("customer_message"):
        lines.append(f"\nCustomer's message:\n{context['customer_message']}")
    if context.get("ai_draft_reply"):
        lines.append(f"\nAI's original draft reply:\n{context['ai_draft_reply']}")
    if context.get("ai_reasoning"):
        lines.append(f"\nAI's own reasoning for that draft:\n{context['ai_reasoning']}")
    if context.get("ai_policy_applied"):
        lines.append(f"\nPolicy the AI said it applied:\n{context['ai_policy_applied']}")
    order_facts = context.get("order_facts")
    if order_facts:
        known = {k: v for k, v in order_facts.items() if v}
        if known:
            facts_lines = "\n".join(f"- {k}: {v}" for k, v in known.items())
            lines.append(f"\nOrder facts available for this reply:\n{facts_lines}")
    thread_history = context.get("thread_history")
    if thread_history:
        history_lines = "\n".join(
            f"- {'Customer' if entry.get('direction') == 'in' else 'Us'}: {entry.get('text', '')}"
            for entry in thread_history
        )
        lines.append(f"\nEarlier messages in this thread, oldest first:\n{history_lines}")

    trigger_type = context.get("trigger_type")
    source_text = context.get("source_text", "")
    if trigger_type == "draft_edit":
        lines.append(f"\nThe agent manually rewrote the draft to read:\n{source_text}")
    else:
        lines.append(f"\nThe agent's comment:\n{source_text}")

    return "\n".join(lines)


def run_triage(context: dict, live_prompt: str, client: Optional[OpenAI] = None) -> dict:
    """Ask the model to classify one piece of feedback against the live prompt."""
    require_openai_key()
    client = client or OpenAI(api_key=OPENAI_API_KEY)

    user_content = (
        f"Current live system prompt, in full:\n{live_prompt}"
        f"\n\n-----\n\nThe case this feedback relates to:\n{_format_case_block(context)}"
    )
    messages = [
        {"role": "system", "content": TRIAGE_INSTRUCTIONS},
        {"role": "user", "content": user_content},
    ]
    kwargs = {"model": OPENAI_MODEL, "messages": messages, "response_format": {"type": "json_object"}}

    try:
        # temperature=0 for consistent classification - dropped if the
        # model only allows its default. Same pattern as analysis.py.
        response = client.chat.completions.create(**kwargs, temperature=0)
    except BadRequestError as err:
        if "temperature" not in str(err):
            raise
        response = client.chat.completions.create(**kwargs)

    try:
        result = json.loads(response.choices[0].message.content)
    except (json.JSONDecodeError, TypeError):
        return dict(TRIAGE_FALLBACK)

    for key, default in TRIAGE_FALLBACK.items():
        result.setdefault(key, default)

    return result


def run_and_persist_triage(context: dict, client: Optional[OpenAI] = None) -> dict:
    """
    The shared entry point both trigger points call (routers/triage.py for
    comments, and routers/draft_edit.py's edit_draft() for permanent-fix
    edits). Runs the classifier, then persists either a proposal (only for
    "prompt_fix") or an escalation (every other outcome, including "none")
    - always exactly one record, so every comment/edit is reviewable.
    """
    live_prompt = load_system_prompt()
    result = run_triage(context, live_prompt, client=client)
    outcome = result.get("outcome", "none")

    proposal_id = None
    escalation_id = None

    if outcome == "prompt_fix":
        proposal_id = save_prompt_proposal(context, result)
    else:
        # "code_restriction", "data_restriction", or "none" - all still
        # get a reviewable record (see escalation_store.py's docstring),
        # so a human sees every piece of feedback, never just the ones
        # the AI decided to act on.
        escalation_id = save_escalation(context, result, outcome)

    return {
        "outcome": outcome,
        "reason": result.get("reason", ""),
        "proposal_id": proposal_id,
        "escalation_id": escalation_id,
    }


def recheck_and_merge_proposal(current_prompt: str, proposal: dict, client: Optional[OpenAI] = None) -> dict:
    """
    Called at approval time, not creation time - see
    prompt_proposal_store.py's approve_proposal(). Re-verifies the fix
    against whatever the live prompt actually looks like right now, since
    the proposal's own anchor_text/new_text were drafted against a
    snapshot of the prompt that may no longer be current - the same
    passage might not exist verbatim anymore if it changed since.
    """
    require_openai_key()
    client = client or OpenAI(api_key=OPENAI_API_KEY)

    user_content = (
        f"Original feedback this fix was for:\n{proposal.get('source_text', '')}"
        f"\n\nOriginal reason a fix was warranted:\n{proposal.get('reason', '')}"
        f"\n\n-----\n\nCurrent live system prompt, in full:\n{current_prompt}"
    )
    messages = [
        {"role": "system", "content": RECHECK_INSTRUCTIONS},
        {"role": "user", "content": user_content},
    ]
    kwargs = {"model": OPENAI_MODEL, "messages": messages, "response_format": {"type": "json_object"}}

    try:
        response = client.chat.completions.create(**kwargs, temperature=0)
    except BadRequestError as err:
        if "temperature" not in str(err):
            raise
        response = client.chat.completions.create(**kwargs)

    try:
        result = json.loads(response.choices[0].message.content)
    except (json.JSONDecodeError, TypeError):
        return dict(RECHECK_FALLBACK)

    for key, default in RECHECK_FALLBACK.items():
        result.setdefault(key, default)

    return result


def draft_fix_from_override(escalation: dict, override_note: str, client: Optional[OpenAI] = None) -> dict:
    """
    Called when a human overrides a triage verdict they disagree with
    (see routers/escalations.py's override_escalation() and
    prompt_proposal_store.py's create_proposal_from_override()). Unlike
    run_triage(), this never returns "none" - the human has already
    decided a fix is warranted; this only drafts it, against the CURRENT
    live prompt, using the same anchor-based approach as everywhere else.
    """
    require_openai_key()
    client = client or OpenAI(api_key=OPENAI_API_KEY)

    current_prompt = load_system_prompt()
    user_content = (
        f"Original feedback:\n{escalation.get('source_text', '')}"
        f"\n\nTriage agent's earlier reasoning for its verdict ({escalation.get('type', 'none')}):"
        f"\n{escalation.get('reason', '')}"
        f"\n\nHuman's override note:\n{override_note}"
        f"\n\n-----\n\nCurrent live system prompt, in full:\n{current_prompt}"
    )
    messages = [
        {"role": "system", "content": OVERRIDE_INSTRUCTIONS},
        {"role": "user", "content": user_content},
    ]
    kwargs = {"model": OPENAI_MODEL, "messages": messages, "response_format": {"type": "json_object"}}

    try:
        response = client.chat.completions.create(**kwargs, temperature=0)
    except BadRequestError as err:
        if "temperature" not in str(err):
            raise
        response = client.chat.completions.create(**kwargs)

    try:
        result = json.loads(response.choices[0].message.content)
    except (json.JSONDecodeError, TypeError):
        return dict(OVERRIDE_FALLBACK)

    for key, default in OVERRIDE_FALLBACK.items():
        result.setdefault(key, default)

    return result
