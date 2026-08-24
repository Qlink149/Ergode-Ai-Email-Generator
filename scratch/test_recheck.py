import urllib.request, json, os

TOK = open("/tmp/tok.txt").read().strip() if os.path.exists("/tmp/tok.txt") else None
BASE = "http://127.0.0.1:4000"


def call(method, path, body=None, token=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    tok = TOK
    if not tok:
        raise SystemExit("no token")

    # --- baseline ---
    versions = call("GET", "/api/system-prompt/versions", token=tok)["versions"]
    baseline_version = versions[0]["version"]
    baseline_content = versions[0]["content"]
    print("baseline version:", baseline_version)

    # --- step 1: create a real prompt_fix proposal for a clearly-synthetic, traceable rule ---
    triage = call(
        "POST",
        "/api/comments",
        {
            "order_id": "TEST-0000000-0000003",
            "author": "claude-test",
            "text": "The draft offered a $5 gift card as compensation - Ergode never does gift cards, only cash refunds or partial-refund discounts.",
            "customer_message": "Can I get some compensation for the delay?",
            "ai_reply": "We can offer you a $5 gift card for the inconvenience.",
        },
        token=tok,
    )["triage"]
    print("triage result:", triage)
    assert triage["outcome"] == "prompt_fix", f"expected prompt_fix, got {triage['outcome']}"
    proposal_id = triage["proposal_id"]

    # --- step 2: simulate a concurrent, unrelated manual edit to the live prompt ---
    marker = "\n\n<!-- TEST-MARKER-CONCURRENT-EDIT-DO-NOT-KEEP -->"
    concurrent_content = baseline_content + marker
    save_result = call("PUT", "/api/system-prompt", {"content": concurrent_content}, token=tok)
    print("concurrent edit saved as version:", save_result["version"])

    # --- step 3: approve the ORIGINAL proposal (drafted against the OLD prompt) ---
    approve_result = call("POST", f"/api/proposals/{proposal_id}/approve", token=tok)
    print("approve result:", approve_result)

    # --- step 4: verify the final content has BOTH the new fix AND the concurrent marker ---
    final = call("GET", "/api/system-prompt", token=tok)["content"]
    has_marker = "TEST-MARKER-CONCURRENT-EDIT-DO-NOT-KEEP" in final
    has_giftcard_rule = "gift card" in final.lower()
    print("final content has concurrent marker (should be True):", has_marker)
    print("final content has gift-card rule (should be True):", has_giftcard_rule)

    if not has_marker:
        print("FAIL: the concurrent edit was clobbered!")
    if not has_giftcard_rule:
        print("FAIL: the approved fix was not actually applied!")
    if has_marker and has_giftcard_rule:
        print("PASS: recheck correctly merged against the current prompt without clobbering the concurrent edit.")

    # --- step 5: test the already_covered path - create another proposal for the SAME gift-card issue ---
    triage2 = call(
        "POST",
        "/api/comments",
        {
            "order_id": "TEST-0000000-0000004",
            "author": "claude-test",
            "text": "Again offered a gift card instead of cash - we don't do gift cards.",
            "customer_message": "What can you offer me?",
            "ai_reply": "How about a $10 gift card?",
        },
        token=tok,
    )["triage"]
    print("second triage result:", triage2)
    if triage2["outcome"] == "prompt_fix":
        approve_result2 = call("POST", f"/api/proposals/{triage2['proposal_id']}/approve", token=tok)
        print("second approve result (should be already_covered):", approve_result2)
    else:
        print("second comment classified as", triage2["outcome"], "- already covered was caught at CREATE time instead of approve time, which is also correct")

    # --- cleanup: restore the true baseline content (removing the test marker + gift-card addition) ---
    restore = call("PUT", "/api/system-prompt", {"content": baseline_content}, token=tok)
    print("restored baseline as version:", restore["version"])
    final_check = call("GET", "/api/system-prompt", token=tok)["content"]
    print("restored correctly:", final_check == baseline_content)


main()
