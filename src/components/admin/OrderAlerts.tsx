"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeToOrders, type LiveStatus } from "@/services/admin/orders";
import { Icon } from "@/components/ui/Icon";
import { alarm } from "@/state/alarm";

/**
 * New-order alarm for the counter phone.
 *  - Realtime pushes changes instantly; polling every 20 s is the backup.
 *  - Phones only allow sound after a tap, so staff press "Start shift" once.
 *  - The alarm repeats every 20 s while any order is still New.
 *  - Keeps the screen awake where the phone allows it.
 */
export function OrderAlerts({ newIds, onChange }: { newIds: string[]; onChange: () => void }) {
  // The beeping itself is done by the panel shell (alarm.ts) so it works on every admin page.
  const [shift, setShift] = useState(alarm.isOn());
  const [live, setLive] = useState<LiveStatus>("connecting");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const newCount = newIds.length;

  useEffect(() => alarm.subscribe(() => setShift(alarm.isOn())), []);

  useEffect(() => {
    const unsubscribe = subscribeToOrders("orders-live", () => onChangeRef.current(), setLive);
    const t = setInterval(() => document.visibilityState === "visible" && onChangeRef.current(), 20_000);
    const onVis = () => document.visibilityState === "visible" && onChangeRef.current();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-2">
      {!shift ? (
        <button type="button" onClick={() => void alarm.start()} className="btn w-full bg-amber-500 py-4 text-[17px] text-amber-950 shadow-[0_8px_20px_-10px_rgba(180,83,9,.8)]">
          <Icon name="bell" className="size-6" strokeWidth={2.4} /> Start shift: turn on order alarm
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900 ring-1 ring-emerald-200">
          <Icon name="bell" className={`size-6 ${newCount ? "animate-ring text-amber-600" : ""}`} strokeWidth={2.2} />
          <span className="flex-1 text-[15px] font-semibold">Alarm on, on every panel page. Screen stays awake.</span>
          <button type="button" className="text-[14px] font-bold underline" onClick={() => alarm.beep()}>Test sound</button>
        </div>
      )}
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <span className={`size-2 rounded-full ${live === "live" ? "bg-emerald-500" : live === "connecting" ? "bg-amber-400" : "bg-rose-500"}`} />
        {live === "live" ? "Live: new orders appear instantly" : live === "connecting" ? "Connecting…" : "Live link lost, checking every 20 seconds"}
      </p>
    </div>
  );
}
