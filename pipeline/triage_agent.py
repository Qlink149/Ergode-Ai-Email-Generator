"""
triage_agent.py
----------------
Runs automatically whenever a support agent posts a Comment or edits a
draft (see api.py's /triage route and edit_draft()). Reads the feedback
plus the case it was left on, against the CURRENT live system prompt, and
decides one of four outcomes:

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
"""

import json
from typing import Optional

from openai import BadRequestError, OpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL, require_openai_key
from escalation_store import save_escalation
from prompt_proposal_store import save_prompt_proposal
from system_prompt_store import load_system_prompt

TRIAGE_INSTRUCTIONS = """
You are triaging one piece of support-agent feedback against the customer
support system prompt it relates to. You will be given: the current LIVE
system prompt in full, the feedback itself (a comment an agent left on a
generated draft, or the text of a draft the agent manually rewrote), and
the case it was left on (the customer's message, the AI's original draft
reply and its reasoning/policy, and the order/thread context available).

Decide exactly ONE outcome and return a JSON object with these fields:

- "outcome": one of "none", "prompt_fix", "code_restriction", "data_restriction"
- "reason": 2-4 sentences explaining the decision. Be concrete - name the
  actual gap, not a generic restatement of the feedback.

The following four fields are ONLY used when outcome is "prompt_fix" -
empty string for every other outcome. Your fix is applied by exact,
literal text search-and-splice in code, NOT by you rewriting the whole
prompt - so anchor_text must be copied perfectly, character for
character, from the current live prompt you were given above:

- "edit_type": "insert_after" (add new_text as a new rule right after an
  existing passage - use this for adding something that doesn't exist
  yet) or "replace" (swap an existing passage out entirely for new_text -
  use this when the fix needs to change or strengthen wording that's
  already there, not just add to it).
- "anchor_text": an EXACT, VERBATIM copy-paste of a short passage - one
  sentence or one bullet line, not a whole paragraph unless truly
  necessary - that already exists, word-for-word and punctuation-for-
  punctuation, in the live prompt above. It will be searched for
  literally, so any difference at all (a smart quote vs a straight quote,
  extra whitespace, a paraphrase) means the fix cannot be applied. Pick a
  passage that appears exactly ONCE in the whole prompt, so there's no
  ambiguity about where it goes.
- "new_text": for "insert_after", the new rule/sentence to add right
  after anchor_text (write it so it reads naturally following anchor_text
  - don't repeat anchor_text itself). For "replace", the complete
  replacement for anchor_text.
- "contradiction_check": one or two sentences confirming you checked
  new_text against the rest of the current prompt for conflicts, and what
  you found (either "no conflict with existing rules" or naming the
  specific rule it had to be reconciled with and how).

How to decide which outcome:

**"none"** - the feedback doesn't point at any real gap: praise, a small
wording preference already covered by existing guidance, a one-off human
error unrelated to the prompt or data, or feedback too vague to act on.
This should be the outcome for MOST feedback - only escalate a real,
specific, recurring-shaped gap, not every piece of feedback.

**"prompt_fix"** - the live system prompt is silently missing a rule, or
has a rule that's wrong or that the feedback shows produced the wrong
behavior, AND the fix is something a rule/instruction can actually
control (tone, when to ask a question, when to state a fact, which
template to use, wording, sequencing). Before choosing this, check: does
the prompt already say the right thing and the AI just didn't follow it
reliably in this one case? If so this might still be "prompt_fix" if
strengthening the wording plausibly helps, but if the current prompt is
ALREADY unambiguous and correct on this exact point, prefer "none" -
don't add redundant or contradictory rules on top of ones that already
work.

**"code_restriction"** - the fix requires actual application logic, not
prompt wording. Examples: a deterministic guarantee no prompt instruction
can reliably enforce on its own (the kind of thing that needs a
code-level safety net), a UI/workflow change, a bug in how data is
formatted or passed to the model, a timing/sequencing issue in the
pipeline itself.

**"data_restriction"** - the AI would need to know something to respond
correctly, but that information is never included in the order/thread
context it's given at all - not a prompt problem, the fact itself doesn't
reach the model. Example: the feedback implies the AI should have known
an order was "on hold" or "damaged," but no such field is ever passed in
the order facts.

If you cannot tell from what's given whether this is a real, specific gap
(rather than a one-off), prefer "none" over guessing - false positives
create real proposals/escalations someone has to review, so only surface
something you're actually confident about.

Return ONLY the JSON object, no other text.
"""

# Fail closed: if the model's response can't be parsed, do nothing rather
# than risk spamming a proposal/escalation from garbage output.
_FALLBACK_RESULT = {
    "outcome": "none",
    "reason": "Triage could not be parsed - defaulting to no action.",
    "edit_type": "",
    "anchor_text": "",
    "new_text": "",
    "contradiction_check": "",
}


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
        return dict(_FALLBACK_RESULT)

    for key, default in _FALLBACK_RESULT.items():
        result.setdefault(key, default)

    return result


def run_and_persist_triage(context: dict, client: Optional[OpenAI] = None) -> dict:
    """
    The shared entry point both trigger points call (api.py's /triage route
    for comments, and edit_draft() for draft edits). Runs the classifier,
    then persists either a proposal (only for "prompt_fix") or an
    escalation (every other outcome, including "none") - always exactly
    one record, so every comment/edit is reviewable.
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


RECHECK_INSTRUCTIONS = """
You are re-verifying a previously drafted system-prompt fix right before
it gets applied, against the CURRENT live prompt. Time has passed since
this fix was drafted - the live prompt may have changed since then (a
different fix could have been approved, or someone edited it by hand) -
so verify from scratch rather than trusting the earlier draft blindly.

You will be given the ORIGINAL feedback this fix was for (the comment/edit
text and the reason a fix was warranted), and the CURRENT live system
prompt in full.

Decide:
- Does the CURRENT live prompt already adequately cover this fix - word
  for word, or in substance (a rule that says the same thing a different
  way still counts as already covered)? If so, applying the old draft
  again would just create a redundant or possibly conflicting duplicate
  rule - don't do it.
- If the current prompt does NOT already cover it, draft the fix again
  against the CURRENT live prompt you were just given (not the old draft,
  which may be stale).

Your fix is applied by exact, literal text search-and-splice in code, NOT
by rewriting the whole prompt - so anchor_text must be copied perfectly,
character for character, from the CURRENT live prompt above.

Return a JSON object with exactly these fields:
- "already_covered": true or false
- "note": one or two sentences. If already_covered is true, name what
  already covers it. If false, briefly confirm the fix was reapplied
  cleanly against the current prompt.
- "edit_type": "insert_after" or "replace" - required when already_covered
  is false, empty string when true. Same meaning as before: "insert_after"
  adds new_text right after an existing passage, "replace" swaps an
  existing passage out for new_text entirely.
- "anchor_text": an EXACT, VERBATIM copy-paste of a short passage - one
  sentence or bullet line - that exists, word-for-word, in the CURRENT
  live prompt above (not the old draft). Must appear exactly ONCE in the
  prompt. Required when already_covered is false, empty string when true.
- "new_text": the new or replacement wording - required when
  already_covered is false, empty string when true.

Return ONLY the JSON object, no other text.
"""

_RECHECK_FALLBACK = {
    "already_covered": False,
    "note": "Recheck could not be parsed - the fix was not reapplied automatically.",
    "edit_type": "",
    "anchor_text": "",
    "new_text": "",
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
        return dict(_RECHECK_FALLBACK)

    for key, default in _RECHECK_FALLBACK.items():
        result.setdefault(key, default)

    return result
