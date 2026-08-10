/** Strips Amazon boilerplate out of inbound notice text - live-API equivalent of thread_parser.py's cleaning, adapted for text with no line breaks. */

const RETURN_REASONS = [
  "No longer needed",
  "Item arrived too late",
  "Better price available",
  "Incompatible or not useful",
  "Bought by mistake",
  "Wrong size: too large/long",
  "Performance or quality not adequate",
  "Inaccurate website description",
  "Product damaged, but shipping box OK",
  "Item defective or doesn't work",
  "Item defective or doesn’t work",
];

function extractReturnAuthorizationDetails(text) {
  if (!text.includes("Return authorization request for order")) return null;

  const reasonIdx = text.indexOf("Return Reason");
  if (reasonIdx === -1) return null;
  const commentIdx = text.indexOf("Comment", reasonIdx);
  const boundaryIdx = text.indexOf("Using your Manage Returns");
  if (commentIdx === -1 || boundaryIdx === -1) return null;

  const valuesBlob = text.slice(commentIdx + "Comment".length, boundaryIdx).trim();

  // Anchored to "B0" (real Amazon ASINs always start with it) rather than any
  // 10-char alphanumeric run - a product title containing something like
  // "Q4100C9044" would otherwise false-match before the real ASIN.
  const asinMatch = valuesBlob.match(/\bB0[A-Z0-9]{8}\b/);
  if (!asinMatch) return null;

  const productName = valuesBlob.slice(0, asinMatch.index).trim();
  let rest = valuesBlob.slice(asinMatch.index + asinMatch[0].length).trim();

  const skuMatch = rest.match(/^(\S+)\s+/);
  if (!skuMatch) return null;
  rest = rest.slice(skuMatch[0].length).trim();

  const qtyMatch = rest.match(/^(\d+)\s+/);
  if (!qtyMatch) return null;
  rest = rest.slice(qtyMatch[0].length).trim();

  const reason = RETURN_REASONS.find((r) => rest.startsWith(r));
  if (!reason) return null;
  const comment = rest.slice(reason.length).trim();

  return { productName, returnReason: reason, customerComment: comment };
}

function extractAToZClaimDetails(text) {
  if (!text.slice(0, 200).toLowerCase().includes("a-to-z guarantee claim")) return null;

  const claimAmount = text.match(/Claim amount:\s*(\$[\d.,]+)/);
  const returnCarrier = text.match(/Return carrier:\s*([^.]+?)(?:\s{2,}|Return tracking|$)/);
  const returnTracking = text.match(/Return tracking number:\s*(\S+)/);

  return {
    claimAmount: claimAmount ? claimAmount[1] : "not specified",
    returnCarrier: returnCarrier ? returnCarrier[1].trim() : "not specified",
    returnTracking: returnTracking ? returnTracking[1] : "not specified",
  };
}

/** Discards any duplicate (e.g. French) translation of the same notice by only matching the first occurrence of each field. */
function extractRelayedInquiryDetails(text) {
  if (!/dear amazon seller/i.test(text) || !/reason for contact:/i.test(text)) return null;

  const productMatch = text.match(/Product:\s*(\S+)/);
  const orderMatch = text.match(/Order number:\s*(\S+)/);
  const returnMatch = text.match(/Return requested:\s*(.+?)\s+Reason for contact:/i);
  const reasonMatch = text.match(/Reason for contact:\s*(.+?)(?:\s+Please respond|$)/i);
  if (!reasonMatch) return null;

  return {
    product: productMatch ? productMatch[1] : "not specified",
    orderNumber: orderMatch ? orderMatch[1] : "not specified",
    returnRequested: returnMatch ? returnMatch[1].trim() : "not specified",
    reasonForContact: reasonMatch[1].trim(),
  };
}

function isCancellationNotice(text) {
  const lowered = text.trim().toLowerCase();
  return lowered.startsWith("hello,") && lowered.slice(0, 400).includes("cancellation request");
}

function extractCustomerMessage(text) {
  const start = text.indexOf("Message:");
  const end = text.indexOf("View Message");
  if (start === -1 || end === -1 || end <= start) return text.trim();
  return text.slice(start + "Message:".length, end).trim();
}

const RELAY_PHRASES = [
  "this is amazon's customer service team",
  "this is amazon’s customer service team",
  "dear amazon seller",
  "reason for contact:",
];
function isRelayMessage(text) {
  const lowered = (text || "").toLowerCase();
  return RELAY_PHRASES.some((p) => lowered.includes(p));
}

function cleanInboundText(rawText) {
  const returnDetails = extractReturnAuthorizationDetails(rawText);
  if (returnDetails) {
    return (
      `[Amazon system notice: return authorization request]\n` +
      `Product: ${returnDetails.productName}\n` +
      `Return reason (Amazon's enum): ${returnDetails.returnReason}\n` +
      `Customer's comment: ${returnDetails.customerComment}`
    );
  }

  const claimDetails = extractAToZClaimDetails(rawText);
  if (claimDetails) {
    return (
      `[Amazon system notice: A-to-z Guarantee claim - urgent, 72-hour deadline]\n` +
      `Claim amount: ${claimDetails.claimAmount}\n` +
      `Return carrier: ${claimDetails.returnCarrier}\n` +
      `Return tracking number: ${claimDetails.returnTracking}`
    );
  }

  if (isCancellationNotice(rawText)) {
    return "[Amazon system notice: buyer cancellation request]\nBuyer asked to cancel this order before it shipped.";
  }

  const relayDetails = extractRelayedInquiryDetails(rawText);
  if (relayDetails) {
    return (
      `[Amazon system notice: relayed customer inquiry]\n` +
      `Product: ${relayDetails.product}\n` +
      `Order number: ${relayDetails.orderNumber}\n` +
      `Return requested: ${relayDetails.returnRequested}\n` +
      `Reason for contact: ${relayDetails.reasonForContact}`
    );
  }

  return extractCustomerMessage(rawText);
}

/** The CRM API returns runs of several spaces where the source had line breaks - collapse to one. */
function collapseWhitespace(text) {
  return text.replace(/[ \t]{2,}/g, " ").trim();
}

module.exports = { cleanInboundText, isRelayMessage, collapseWhitespace };
