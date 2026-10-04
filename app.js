const $ = (id) => document.getElementById(id);
let timer = null;

function setStatus(cls, text) {
  $("status").className = cls;
  $("status").textContent = text;
}

$("go").addEventListener("click", async () => {
  $("err").textContent = "";
  clearInterval(timer);
  $("go").disabled = true;
  try {
    const r = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat($("amount").value), customer_name: $("name").value }),
    });
    const j = await r.json();
    if (!r.ok || j.status !== "success") throw new Error(j.message || "Could not create the payment.");
    const d = j.data;
    $("qr").src = d.qr_url;
    $("checkout").href = d.checkout_url;
    $("intent").hidden = !d.upi_intent;
    if (d.upi_intent) $("intent").href = d.upi_intent;
    $("oid").textContent = d.order_id;
    $("amt").textContent = "Rs " + d.payable_amount;
    $("exp").textContent = d.expires_at_ist;
    setStatus("pending", "Waiting for payment...");
    $("out").hidden = false;
    const stopAt = Date.now() + 6 * 60 * 1000;
    timer = setInterval(() => {
      if (Date.now() > stopAt) { clearInterval(timer); setStatus("expired", "Expired. Generate a new link."); return; }
      poll(d.order_id);
    }, 4000);
  } catch (e) {
    $("err").textContent = e.message;
  } finally {
    $("go").disabled = false;
  }
});

async function poll(id) {
  try {
    const j = await (await fetch("/api/status?order_id=" + encodeURIComponent(id))).json();
    if (j.status === "success") {
      setStatus("success", "Payment received. UTR " + (j.utr || "n/a"));
      clearInterval(timer);
    } else if (j.status === "expired") {
      setStatus("expired", "Expired. Generate a new link.");
      clearInterval(timer);
    }
  } catch (e) { /* keep polling */ }
}
