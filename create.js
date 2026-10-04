// POST /api/create  -> creates a FamGateway order. API key stays server-side.
const BASE = "https://famgateway.in";
const MIN_AMOUNT = 1;
const MAX_AMOUNT = Number(process.env.MAX_AMOUNT || 10000);

// Best-effort per-instance rate limit (8 orders/min per IP).
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 8;
}

const fromGateway = (u) => typeof u === "string" && u.startsWith(BASE + "/");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ status: "error", message: "Method not allowed" });

  const key = process.env.FAMGATEWAY_API_KEY;
  if (!key) return res.status(500).json({ status: "error", message: "Server is not configured." });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ status: "error", message: "Too many requests. Wait a minute." });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const raw = typeof body.amount === "number" || typeof body.amount === "string" ? Number(body.amount) : NaN;
  const amount = Math.round(raw * 100) / 100;
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return res.status(400).json({ status: "error", message: `Enter an amount between ${MIN_AMOUNT} and ${MAX_AMOUNT}.` });
  }
  const name = String(body.customer_name || "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 60);
  const payload = { amount };
  if (name) payload.customer_name = name;

  try {
    const r = await fetch(`${BASE}/api/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    const d = j && j.data;
    if (!r.ok || j.status !== "success" || !d || !fromGateway(d.qr_url) || !fromGateway(d.checkout_url)) {
      return res.status(502).json({ status: "error", message: "Could not create the payment. Try again." });
    }
    // Pass through only the fields the page needs.
    return res.status(200).json({
      status: "success",
      data: {
        order_id: String(d.order_id),
        payable_amount: String(d.payable_amount),
        qr_url: d.qr_url,
        checkout_url: d.checkout_url,
        upi_intent: String(d.upi_intent || "").startsWith("upi://") ? d.upi_intent : "",
        expires_at_ist: String(d.expires_at_ist || ""),
      },
    });
  } catch (e) {
    return res.status(502).json({ status: "error", message: "Payment service unreachable. Try again." });
  }
};
