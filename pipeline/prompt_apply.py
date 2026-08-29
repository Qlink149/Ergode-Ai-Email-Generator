"""
prompt_apply.py
----------------
The one function that actually changes the live system prompt's text:
apply_edit(). Split out of prompt_proposal_store.py because it's the
single most safety-critical piece of this codebase (see that file's own
docstring for why proposals are anchor_text + new_text, never a full
rewrite) - kept on its own, small and pure, with no DB or OpenAI
dependency at all.
"""


def apply_edit(current_prompt: str, edit_type: str, anchor_text: str, new_text: str):
    """
    Deterministic, code-only splice - no model involved in this step at
    all. Returns (success: bool, content_or_none: Optional[str], note: str).
    Refuses (success=False) unless anchor_text appears in current_prompt
    exactly once, so there's never any ambiguity about where the edit goes
    and never any risk of the rest of the document being altered.
    """
    if not anchor_text or not new_text or edit_type not in ("insert_after", "replace"):
        return False, None, "Malformed edit (missing anchor/new text, or unknown edit_type)."

    count = current_prompt.count(anchor_text)
    if count == 0:
        return False, None, "The anchor text no longer appears in the current live prompt - it may have changed."
    if count > 1:
        return False, None, f"The anchor text appears {count} times in the current prompt - too ambiguous to apply safely."

    if edit_type == "insert_after":
        merged = current_prompt.replace(anchor_text, f"{anchor_text}\n{new_text}", 1)
    else:
        merged = current_prompt.replace(anchor_text, new_text, 1)

    return True, merged, "Applied cleanly."
