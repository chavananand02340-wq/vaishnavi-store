"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getUpiPayee, submitUpiReference } from "@/services/orders";
import { formatPaise } from "@/lib/money";
import { FALLBACK_STORE_NAME } from "@/config/site";
import { useCart } from "@/state/cart";

/** Old UPI option: QR with the amount filled in, plus an optional UPI reference box. */
export function UpiPayBox({ token, total, orderNo, waiting, onSent }: { token: string; total: number; orderNo: string; waiting: boolean; onSent: () => void }) {
  const { settings } = useCart();
  const [qr, setQr] = useState<string | null>(null);
  const [vpa, setVpa] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [utr, setUtr] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const payee = await getUpiPayee().catch(() => null);
      if (!payee) return;
      const p = new URLSearchParams({
        pa: payee.upiId,
        pn: payee.payeeName ?? settings?.store_name ?? FALLBACK_STORE_NAME,
        am: (total / 100).toFixed(2),
        cu: "INR",
        tn: orderNo,
      });
      const l = `upi://pay?${p.toString().replace(/\+/g, "%20")}`;
      setVpa(payee.upiId);
      setQr(await QRCode.toDataURL(l, { margin: 2, width: 600, errorCorrectionLevel: "M" }));
    })();
  }, [total, orderNo, settings?.store_name]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await submitUpiReference(token, utr);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Thanks! The shop will confirm your payment shortly." } : { ok: false, text: r.message ?? "Couldn't save." });
    if (r.ok) onSent();
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-white p-4 text-center ring-1 ring-line">
      <h2 className="text-[17px] font-bold">Pay {formatPaise(total)} with UPI</h2>
      {qr ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`UPI QR code for ${formatPaise(total)}`} className="mx-auto my-3 size-60" />
          <p className="text-[13px] text-muted">Amount {formatPaise(total)} and order number are already in the QR.</p>

          <ol className="mt-4 space-y-2 rounded-2xl bg-page p-3 text-left text-[14px] leading-snug">
            <li><b>1.</b> Tap <b>Save QR</b> below.</li>
            <li><b>2.</b> Open GPay, PhonePe or Paytm → <b>Scan QR</b> → pick the saved photo from your gallery.</li>
            <li><b>3.</b> Pay {formatPaise(total)}. On another phone? Just scan the QR on this screen.</li>
          </ol>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={qr} download={`pay-${orderNo.replace(/\W/g, "")}.png`} className="btn-brand">Save QR</a>
            <button
              type="button"
              className="btn-plain"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(vpa ?? "");
                  setCopied(true);
                } catch {
                  /* ignore */
                }
              }}
            >
              {copied ? "UPI ID copied" : "Copy UPI ID"}
            </button>
          </div>
          {vpa && <p className="mt-2 text-[13px] text-muted">UPI ID: <b className="text-ink">{vpa}</b></p>}
        </>
      ) : (
        <p className="mt-2 text-[15px] text-muted">UPI isn't set up yet. Please pay cash on delivery.</p>
      )}
      {waiting && <p className="mt-3 text-[14px] font-semibold text-haldi-700">Waiting for the shop to confirm your payment.</p>}
      <form onSubmit={send} className="mt-4 text-left">
        <label htmlFor="utr" className="label">Paid? Add the 12-digit UPI reference (optional)</label>
        <div className="flex gap-2">
          <input id="utr" className="field" inputMode="numeric" value={utr} onChange={(e) => setUtr(e.target.value.slice(0, 30))} />
          <button className="btn-brand shrink-0" type="submit" disabled={busy || utr.trim().length < 6}>{busy ? "Sending" : "Send"}</button>
        </div>
        {msg && <p className={`mt-2 text-[14px] ${msg.ok ? "text-brand-700" : "text-rose-700"}`}>{msg.text}</p>}
      </form>
    </section>
  );
}
