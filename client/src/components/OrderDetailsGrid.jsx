/**
 * OrderDetailsGrid.jsx
 * ---------------------
 * The Order Details row, matching the real CRM's own Order Details tab
 * field-for-field (labels, order, five-column layout) - no section
 * headers there, just five divided columns of label/value rows.
 * `internal` fields (seller, auxhold, processing-site) are agent-facing
 * only - never read into AI-generated text, see disclosureClassifier.js.
 * Used by OrderLookupPage.jsx.
 */

function Field({ label, value, index }) {
  return (
    <div
      className={`grid min-w-0 grid-cols-[120px_1fr] gap-2 px-3 py-2 text-xs ${
        index % 2 === 1 ? "bg-[rgb(var(--navy-rgb)/0.03)]" : ""
      }`}
    >
      <span className="min-w-0 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 break-words font-medium">{value ?? "—"}</span>
    </div>
  );
}

function Column({ fields }) {
  return (
    <div className="min-w-0">
      {fields.map((f, i) => (
        <Field key={f.label} label={f.label} value={f.value} index={i} />
      ))}
    </div>
  );
}

export default function OrderDetailsGrid({ orderId, customerSafe, internal }) {
  const safe = customerSafe || {};
  const int = internal || {};
  const totalPurchase =
    int.purchase_price && safe.quantity
      ? (Number(int.purchase_price) * Number(safe.quantity)).toFixed(2)
      : int.purchase_price;

  const columns = [
    [
      { label: "Order Id", value: orderId },
      { label: "Internal Order Id", value: int.internal_order_id },
      { label: "Order Item Id", value: int.order_item_id },
      { label: "Order Date", value: int.order_date },
      { label: "Quantity", value: safe.quantity },
      { label: "Venue", value: int.venue_full_name },
    ],
    [
      { label: "Title", value: safe.product_name },
      { label: "SKU", value: int.sku },
      { label: "ISBN", value: int.asin },
      { label: "Shipment Number", value: int.shipment_no },
      { label: "Total Sale", value: int.total_sale_price },
      { label: "Total Purchase", value: totalPurchase },
    ],
    [
      { label: "Recipient Name", value: safe.recipient_name },
      { label: "City", value: int.city },
      { label: "State", value: int.state },
      { label: "Country", value: int.country },
      { label: "Zip Code", value: int.zip },
      { label: "Email address", value: int.email },
    ],
    [
      { label: "OP User", value: int.op_user },
      { label: "Processing Site", value: int.processing_site },
      { label: "Processing Time", value: int.processing_time },
      { label: "Seller Id", value: int.seller_id },
      { label: "Seller Name", value: int.seller_name },
      { label: "Purchase Price", value: int.purchase_price },
    ],
    [
      { label: "Action", value: int.action },
      { label: "Auxhold Carrier", value: int.auxhold_carrier },
      { label: "Auxhold Tracking", value: int.auxhold_tracking },
      { label: "Tracking to Customer Carrier", value: safe.carrier_name },
      { label: "Tracking to Customer", value: safe.tracking_id },
    ],
  ];

  return (
    <div className="executive-card overflow-hidden p-0">
      <div className="grid divide-y divide-[rgb(var(--navy-rgb)/0.08)] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
        {columns.map((fields, i) => (
          <Column key={i} fields={fields} />
        ))}
      </div>
    </div>
  );
}
