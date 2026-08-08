/**
 * OrderDetailsGrid.jsx
 * ---------------------
 * The Order Details card row, styled after the real CRM's own Order
 * Details tab (Order Id / Title / Recipient / OP User / Action cards).
 * `internal` fields (seller, auxhold, processing-site) are agent-facing
 * only - never read into AI-generated text, see disclosureClassifier.js.
 */

function Field({ label, value }) {
  return (
    <div className="border-b border-[rgb(var(--navy-rgb)/0.06)] py-1.5 last:border-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="executive-card p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h4>
      <div>{children}</div>
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

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Card title="Order">
        <Field label="Order ID" value={orderId} />
        <Field label="Internal Order ID" value={int.internal_order_id} />
        <Field label="Order Item ID" value={int.order_item_id} />
        <Field label="Order Date" value={int.order_date} />
        <Field label="Quantity" value={safe.quantity} />
        <Field label="Venue" value={int.venue_full_name} />
      </Card>

      <Card title="Product">
        <Field label="Title" value={safe.product_name} />
        <Field label="SKU" value={int.sku} />
        <Field label="ASIN" value={int.asin} />
        <Field label="Shipment Number" value={int.shipment_no} />
        <Field label="Total Sale" value={int.total_sale_price} />
        <Field label="Total Purchase" value={totalPurchase} />
      </Card>

      <Card title="Recipient">
        <Field label="Recipient Name" value={safe.recipient_name} />
        <Field label="City" value={int.city} />
        <Field label="State" value={int.state} />
        <Field label="Country" value={int.country} />
        <Field label="Zip Code" value={int.zip} />
        <Field label="Email Address" value={int.email} />
      </Card>

      <Card title="Processing">
        <Field label="OP User" value={int.op_user} />
        <Field label="Processing Site" value={int.processing_site} />
        <Field label="Processing Time" value={int.processing_time} />
        <Field label="Seller ID" value={int.seller_id} />
        <Field label="Seller Name" value={int.seller_name} />
        <Field label="Purchase Price" value={int.purchase_price} />
      </Card>

      <Card title="Fulfillment">
        <Field label="Action" value={int.action} />
        <Field label="Auxhold Carrier" value={int.auxhold_carrier} />
        <Field label="Auxhold Tracking" value={int.auxhold_tracking} />
        <Field label="Tracking to Customer Carrier" value={safe.carrier_name} />
        <Field label="Tracking to Customer" value={safe.tracking_id} />
      </Card>
    </div>
  );
}
