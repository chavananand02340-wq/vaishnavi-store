"use client";

import { useEffect, useState } from "react";
import { isPincodeServed } from "@/services/location";
import { getSavedPin, savePin } from "@/state/device-store";
import { isPincode } from "@/lib/validation";
import { errorMessage } from "@/lib/errors";
import { Icon } from "@/components/ui/Icon";

/** "Do we deliver to you?" PIN check. Remembers a served PIN on this phone. */
export function PincodeCheck({ onDone }: { onDone?: () => void } = {}) {
  const [pin, setPin] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setSaved(getSavedPin()), []);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!isPincode(pin)) {
      setResult({ ok: false, text: "Enter a 6-digit PIN code." });
      return;
    }
    setBusy(true);
    let served: boolean;
    try {
      served = await isPincodeServed(pin);
    } catch (err) {
      setBusy(false);
      return setResult({ ok: false, text: errorMessage(err) });
    }
    setBusy(false);
    if (served) {
      savePin(pin);
      setSaved(pin);
      setResult(null);
      onDone?.();
    } else {
      setResult({ ok: false, text: `We don't deliver to ${pin} yet. Call or WhatsApp us to check.` });
    }
  }

  if (saved) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-white p-3 ring-1 ring-line">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Icon name="pin" />
        </span>
        <p className="flex-1 text-[15px] leading-snug">
          <b>We deliver to {saved}</b>
          <br />
          <span className="text-muted">Your order reaches you in about half an hour.</span>
        </p>
        <button type="button" className="text-[14px] font-semibold text-brand-700 underline" onClick={() => setSaved(null)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={check} className="rounded-[var(--radius-card)] bg-white p-3 ring-1 ring-line">
      <label htmlFor="pin" className="text-[15px] font-bold">Do we deliver to you?</label>
      <div className="mt-2 flex gap-2">
        <input
          id="pin"
          className="field py-2.5"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="Your PIN code"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
            setResult(null);
          }}
        />
        <button className="btn-brand shrink-0" type="submit" disabled={busy || pin.length !== 6}>
          {busy ? "Checking" : "Check"}
        </button>
      </div>
      {result && <p className={`mt-2 text-[14px] ${result.ok ? "text-brand-700" : "text-rose-700"}`} role="status">{result.text}</p>}
    </form>
  );
}
