"use client";

import { useEffect, useRef, useState } from "react";
import { listNewOrderIds, subscribeToOrders } from "@/services/admin/orders";
import { alarm } from "@/state/alarm";
import { orderLabel } from "@/config/site";

/**
 * Orders waiting in "New" (online orders count only once paid), kept live.
 * Also rings the shared alarm on every admin page when a new one arrives.
 */
export function useNewOrders() {
  const [ids, setIds] = useState<{ id: string; no: number }[]>([]);
  const [alarmOn, setAlarmOn] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => alarm.subscribe(() => setAlarmOn(alarm.isOn())), []);
  useEffect(() => setAlarmOn(alarm.isOn()), []);

  useEffect(() => {
    const load = async () => {
      const list = await listNewOrderIds().catch(() => null);
      if (!list) return; // offline: keep the last list, try again on the next tick
      const first = seen.current === null;
      seen.current = seen.current ?? new Set();
      const fresh = list.filter((o) => !seen.current!.has(o.id));
      list.forEach((o) => seen.current!.add(o.id));
      setIds(list);
      if (!first && fresh.length) {
        if (alarm.isOn()) alarm.beep();
        if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("New order", { body: orderLabel(fresh.at(-1)!.no), tag: "vs-new-order" });
          } catch {
            /* some phones only allow notifications from an installed app */
          }
        }
      }
    };
    void load();
    const unsubscribe = subscribeToOrders("panel-new-orders", () => void load());
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void load();
        if (alarm.isOn()) void alarm.keepAwake();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      unsubscribe();
    };
  }, []);

  // Keep ringing every 20 s until someone accepts the order.
  useEffect(() => {
    if (!alarmOn || ids.length === 0) return;
    const t = setInterval(() => alarm.beep(), 20_000);
    return () => clearInterval(t);
  }, [alarmOn, ids.length]);

  return { count: ids.length, alarmOn };
}
