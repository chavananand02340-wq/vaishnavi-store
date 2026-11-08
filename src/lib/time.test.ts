import { describe, expect, it } from "vitest";
import { formatTime, isOpenNow, istDayStartISO } from "@/lib/time";
import { isMobile, isPincode, isUuid } from "@/lib/validation";

// 2026-11-08 10:00 IST = 04:30 UTC
const at = (utc: string) => new Date(utc);

describe("opening hours (India time)", () => {
  const h = { open_time: "08:00", close_time: "21:00", accepting_orders: true };
  it("is open at 10 am IST", () => expect(isOpenNow(h, at("2026-11-08T04:30:00Z"))).toBe(true));
  it("is closed at 10 pm IST", () => expect(isOpenNow(h, at("2026-11-08T16:30:00Z"))).toBe(false));
  it("handles hours past midnight", () => expect(isOpenNow({ ...h, open_time: "18:00", close_time: "01:00" }, at("2026-11-08T19:00:00Z"))).toBe(true));
  it("is closed when orders are paused", () => expect(isOpenNow({ ...h, accepting_orders: false }, at("2026-11-08T04:30:00Z"))).toBe(false));
  it("formats times", () => {
    expect(formatTime("09:00:00")).toBe("9 am");
    expect(formatTime("18:30")).toBe("6:30 pm");
  });
  it("day starts at IST midnight", () => expect(istDayStartISO().endsWith("T18:30:00.000Z")).toBe(true));
});

describe("validation", () => {
  it("PIN codes", () => {
    expect(isPincode("442001")).toBe(true);
    expect(isPincode("042001")).toBe(false);
  });
  it("mobiles", () => {
    expect(isMobile("9876543210")).toBe(true);
    expect(isMobile("1234567890")).toBe(false);
  });
  it("tokens", () => {
    expect(isUuid("00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isUuid("nope")).toBe(false);
  });
});
