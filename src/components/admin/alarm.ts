"use client";

/**
 * One order alarm for the whole owner/counter panel.
 * Lives at module level so it keeps ringing while you move between admin pages.
 * Phones only allow sound after a tap, so someone taps "Turn on alarm" once per visit.
 */

type Listener = () => void;
let ctx: AudioContext | null = null;
let on = false;
let wake: WakeLockSentinel | null = null;
const listeners = new Set<Listener>();
const KEY = "vs-alarm-wanted";

export const alarm = {
  isOn: () => on,
  /** True if the alarm was on earlier in this browser tab (we still need one tap to unlock sound). */
  wanted: () => {
    try {
      return window.sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  async start() {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = ctx ?? new Ctor();
      await ctx.resume();
    } catch {
      /* no audio */
    }
    await keepAwake();
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
    on = true;
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
    beep();
  },
  beep,
  keepAwake,
};

async function keepAwake() {
  try {
    if ("wakeLock" in navigator && !wake && document.visibilityState === "visible") {
      wake = await navigator.wakeLock.request("screen");
      wake.addEventListener("release", () => (wake = null));
    }
  } catch {
    /* not supported */
  }
}

function beep() {
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
}
