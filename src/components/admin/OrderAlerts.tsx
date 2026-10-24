"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { Icon } from "@/components/Icon";

/**
 * New-order alarm for the counter phone.
 *  - Realtime pushes changes instantly; polling every 20 s is the backup.
 *  - Phones only allow sound after a tap, so staff press "Start shift" once.
 *  - The alarm repeats every 20 s while any order is still New.
 *  - Keeps the screen awake where the phone allows it.
 */
export function OrderAlerts({ newIds, latestNewNo, onChange }: { newIds: string[]; latestNewNo: number | null; onChange: () => void }) {
  const [shift, setShift] = useState(false);
  const [live, setLive] = useState<"connecting" | "live" | "offline">("connecting");
  const audio = useRef<AudioContext | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);
  const seen = useRef<Set<string>>(new Set(newIds));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const newCount = newIds.length;
  const idsKey = newIds.join(",");

  const beep = useCallback(() => {
    const ctx = audio.current;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      for (const [freq, offset] of [[880, 0], [1320, 0.18]] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        const t = start + i * 0.6 + offset;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      }
    }
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  }, []);

  const requestWake = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && !wake.current) {
        wake.current = await navigator.wakeLock.request("screen");
        wake.current.addEventListener("release", () => (wake.current = null));
      }
    } catch {
      /* not supported */
    }
  }, []);

  async function startShift() {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = audio.current ?? new Ctor();
      await audio.current.resume();
    } catch {
      /* no audio */
    }
    await requestWake();
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
    setShift(true);
    beep();
  }

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        if (shift) void requestWake();
        onChangeRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [shift, requestWake]);

  useEffect(() => {
    const sb = supabase();
    const ch = sb
      .channel("orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => onChangeRef.current())
      .subscribe((status) => setLive(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" ? "offline" : "connecting"));
    const t = setInterval(() => document.visibilityState === "visible" && onChangeRef.current(), 20_000);
    return () => {
      clearInterval(t);
      void sb.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    const fresh = newIds.filter((id) => !seen.current.has(id));
    newIds.forEach((id) => seen.current.add(id));
    if (!fresh.length) return;
    if (shift) beep();
    if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("New order", { body: latestNewNo ? `VS-${latestNewNo}` : "Open the orders panel", tag: "vs-new-order" });
      } catch {
        /* some phones only allow notifications from an installed app */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    if (!shift || newCount === 0) return;
    const t = setInterval(beep, 20_000);
    return () => clearInterval(t);
  }, [shift, newCount, beep]);

  return (
    <div className="space-y-2">
      {!shift ? (
        <button type="button" onClick={startShift} className="btn w-full bg-amber-500 py-4 text-[17px] text-amber-950 shadow-[0_8px_20px_-10px_rgba(180,83,9,.8)]">
          <Icon name="bell" className="size-6" strokeWidth={2.4} /> Start shift: turn on order alarm
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900 ring-1 ring-emerald-200">
          <Icon name="bell" className={`size-6 ${newCount ? "animate-ring text-amber-600" : ""}`} strokeWidth={2.2} />
          <span className="flex-1 text-[15px] font-semibold">Alarm on. Screen stays awake.</span>
          <button type="button" className="text-[14px] font-bold underline" onClick={beep}>Test sound</button>
        </div>
      )}
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <span className={`size-2 rounded-full ${live === "live" ? "bg-emerald-500" : live === "connecting" ? "bg-amber-400" : "bg-rose-500"}`} />
        {live === "live" ? "Live: new orders appear instantly" : live === "connecting" ? "Connecting…" : "Live link lost, checking every 20 seconds"}
      </p>
    </div>
  );
}
