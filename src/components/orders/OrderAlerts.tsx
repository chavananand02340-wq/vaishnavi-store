"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * New-order alerts for the counter device.
 *  - Supabase Realtime pushes new orders instantly; a 20 s refresh is the fallback.
 *  - Browsers only allow sound after a tap, so staff press "Start shift" once.
 *  - While any order is still "New", the alarm repeats every 20 s.
 *  - Keeps the screen awake (where supported) and shows a system notification
 *    if the tab is in the background.
 */
export function OrderAlerts({ newIds, latestNewNo }: { newIds: string[]; latestNewNo: number | null }) {
  const newCount = newIds.length;
  const idsKey = newIds.join(",");
  const router = useRouter();
  const [shift, setShift] = useState(false);
  const [live, setLive] = useState<"connecting" | "live" | "offline">("connecting");
  const audio = useRef<AudioContext | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);
  const seen = useRef<Set<string>>(new Set(newIds));

  const beep = useCallback(() => {
    const ctx = audio.current;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime;
    // Three loud two-tone chimes.
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
    if ("vibrate" in navigator) navigator.vibrate?.([300, 150, 300, 150, 300]);
  }, []);

  const requestWake = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && !wake.current) {
        wake.current = await navigator.wakeLock.request("screen");
        wake.current.addEventListener("release", () => {
          wake.current = null;
        });
      }
    } catch {
      /* not supported or denied */
    }
  }, []);

  async function startShift() {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = audio.current ?? new Ctor();
      await audio.current.resume();
    } catch {
      /* audio unavailable */
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
    beep(); // test sound
  }

  // Re-acquire the wake lock when the tab becomes visible again.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && shift) void requestWake();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [shift, requestWake]);

  // Realtime subscription → refresh the list.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => router.refresh())
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" ? "offline" : "connecting");
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  // Fallback polling.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => clearInterval(t);
  }, [router]);

  // An order id we haven't seen before → alarm + notification.
  useEffect(() => {
    const fresh = newIds.filter((id) => !seen.current.has(id));
    newIds.forEach((id) => seen.current.add(id));
    if (fresh.length === 0) return;
    if (shift) beep();
    if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("New order", { body: latestNewNo ? `VS-${latestNewNo}` : "Open the orders panel", tag: "vs-new-order" });
      } catch {
        /* some mobile browsers only allow notifications from a service worker */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Keep ringing while orders wait in "New".
  useEffect(() => {
    if (!shift || newCount === 0) return;
    const t = setInterval(beep, 20_000);
    return () => clearInterval(t);
  }, [shift, newCount, beep]);

  return (
    <div className="space-y-2">
      {!shift ? (
        <button type="button" onClick={startShift} className="btn w-full bg-accent-500 text-base text-neutral-900">
          🔔 Start shift — turn on order sound
        </button>
      ) : (
        <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <span>🔔 Sound on · screen stays awake</span>
          <button type="button" className="underline" onClick={beep}>Test</button>
        </div>
      )}
      <p className="text-xs text-neutral-500">
        Live updates: {live === "live" ? "connected" : live === "connecting" ? "connecting…" : "offline — checking every 20 s"}. Keep this page open on the counter phone.
      </p>
      {newCount > 0 && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-center font-semibold text-amber-900" role="alert">
          {newCount} new order{newCount === 1 ? "" : "s"} waiting — confirm below
        </p>
      )}
    </div>
  );
}
