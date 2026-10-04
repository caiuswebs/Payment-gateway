// GET /api/status?order_id=...  -> authoritative server-to-server check.
const BASE = "https://famgateway.in";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.FAMGATEWAY_API_KEY;
  const id = String(req.query.order_id || "");
  if (!key || !/^[A-Za-z0-9_]{4,40}$/.test(id)) return res.status(400).json({ status: "error" });

  try {
    const r = await fetch(`${BASE}/api/verify-order.php?order_id=${encodeURIComponent(id)}`, {
      headers: { "X-Api-Key": key },
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    if (j.status === "success" && j.data) {
      return res.status(200).json({
        status: "success",
        utr: String(j.data.utr || ""),
        sender_name: String(j.data.sender_name || ""),
        amount: j.data.amount,
      });
    }
    if (j.status === "expired") return res.status(200).json({ status: "expired" });
    return res.status(200).json({ status: "pending" });
  } catch (e) {
    return res.status(200).json({ status: "pending" });
  }
};
