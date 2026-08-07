/** Shared message-pairing logic: TicketDetail.jsx uses buildCustomerMessageCases(), OrderLookupPage.jsx uses buildLatestCase(). */

/** One case per customer message: what it said, prior history, and any real replies that followed before the next customer message. */
export function buildCustomerMessageCases(messages) {
  const cases = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.direction !== "in" || !message.text) continue;

    const history = messages.slice(0, i).map((m) => ({ direction: m.direction, text: m.text }));

    const realReplies = [];
    for (let j = i + 1; j < messages.length; j++) {
      if (messages[j].direction === "in") break;
      if (messages[j].text) realReplies.push(messages[j].text);
    }

    cases.push({
      seq: message.seq,
      realReplies,
      messageDate: message.created_time || null,
      context: {
        customerMessage: message.text,
        orderId: message.order_id,
        isRelay: message.is_relay,
        threadHistory: history,
      },
    });
  }

  return cases;
}

/** The reply to the last customer message, answered or not. Null if there's no customer message to respond to. */
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
