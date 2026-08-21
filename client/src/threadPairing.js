/** Message-pairing logic used by OrderLookupPage.jsx. */

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
