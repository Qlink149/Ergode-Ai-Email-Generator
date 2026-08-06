/**
 * threadPairing.js
 * -----------------
 * Turns a thread's message list into "reply cases" - one per outbound
 * reply, each paired with the customer message it answered and
 * everything said before that. Mirrors pipeline/context_builder.py's
 * build_eval_cases() exactly, so the live ticket view and the historical
 * batch report use the identical pairing rule.
 *
 * Built once here so this logic doesn't get reimplemented per page -
 * TicketDetail.jsx uses buildReplyCases() to give every past reply its
 * own "regenerate this" button; OrderLookupPage.jsx uses buildLatestCase()
 * for its single most-recent-exchange view.
 *
 * Both skip inbound messages with no usable text when looking for a
 * trigger - the live CRM API frequently returns empty message bodies (a
 * known gap, see crmThreadApiClient.js), and an empty message can't
 * inform anything anyway, so it's treated as if it weren't there.
 */

/** One case per outbound message: what it answered, and everything before that. */
export function buildReplyCases(messages) {
  const cases = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.direction !== "out") continue;

    // The customer message this reply is answering: the closest
    // inbound message before it that actually has text.
    let trigger = null;
    for (let j = i - 1; j >= 0; j--) {
      if (messages[j].direction === "in" && messages[j].text) {
        trigger = messages[j];
        break;
      }
    }
    if (!trigger) continue; // nothing before it to respond to

    const history = messages
      .slice(0, i)
      .filter((m) => m !== trigger)
      .map((m) => ({ direction: m.direction, text: m.text }));

    cases.push({
      seq: message.seq,
      realReply: message.text,
      context: {
        customerMessage: trigger.text,
        orderId: trigger.order_id,
        isRelay: trigger.is_relay,
        threadHistory: history,
      },
    });
  }

  return cases;
}

/**
 * The single most-recent exchange: the reply to the last customer
 * message, whether or not it's been answered yet. Returns null if there's
 * no customer message anywhere in the thread to respond to.
 */
export function buildLatestCase(messages) {
  const lastMessage = messages[messages.length - 1];
  const hasRealReply = lastMessage.direction === "out";
  const relevant = hasRealReply ? messages.slice(0, -1) : messages;

  let trigger = null;
  for (let j = relevant.length - 1; j >= 0; j--) {
    if (relevant[j].direction === "in" && relevant[j].text) {
      trigger = relevant[j];
      break;
    }
  }
  if (!trigger) return null;

  const history = relevant
    .filter((m) => m !== trigger)
    .map((m) => ({ direction: m.direction, text: m.text }));

  return {
    context: {
      customerMessage: trigger.text,
      orderId: trigger.order_id,
      isRelay: trigger.is_relay,
      threadHistory: history,
    },
    realReply: hasRealReply ? lastMessage.text : null,
  };
}
