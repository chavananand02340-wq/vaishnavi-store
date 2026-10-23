import { describe, expect, it } from "vitest";
import { amountToFreeDeliveryPaise, deliveryFeePaise, type DeliveryRule } from "./pricing";
import { rupeesToPaise } from "./money";

const launchRule: DeliveryRule = {
  deliveryFeePaise: 3000,
  freeDeliveryEnabled: true,
  freeDeliveryThresholdPaise: 35000,
};

describe("delivery fee — launch rules from the brief", () => {
  it.each([
    [100, 30, 130],
    [200, 30, 230],
    [349, 30, 379],
    [350, 0, 350],
    [500, 0, 500],
  ])("subtotal ₹%i → fee ₹%i, total ₹%i", (subtotal, fee, total) => {
    const s = subtotal * 100;
    const f = deliveryFeePaise(s, launchRule);
    expect(f).toBe(fee * 100);
    expect(s + f).toBe(total * 100);
  });

  it("₹349.99 is still below the threshold", () => {
    expect(deliveryFeePaise(34999, launchRule)).toBe(3000);
  });

  it("free delivery disabled → fee always applies", () => {
    expect(deliveryFeePaise(100000, { ...launchRule, freeDeliveryEnabled: false })).toBe(3000);
    expect(amountToFreeDeliveryPaise(10000, { ...launchRule, freeDeliveryEnabled: false })).toBe(0);
  });

  it("PIN-code override replaces the base fee but free delivery still wins", () => {
    const rule = { ...launchRule, pincodeFeeOverridePaise: 5000 };
    expect(deliveryFeePaise(10000, rule)).toBe(5000);
    expect(deliveryFeePaise(35000, rule)).toBe(0);
  });

  it("shows how much more is needed for free delivery", () => {
    expect(amountToFreeDeliveryPaise(30000, launchRule)).toBe(5000);
    expect(amountToFreeDeliveryPaise(40000, launchRule)).toBe(0);
  });
});

describe("rupeesToPaise", () => {
  it.each([
    ["30", 3000],
    ["349.5", 34950],
    ["₹ 1,200", 120000],
    ["0", 0],
  ])("%s → %i", (input, paise) => expect(rupeesToPaise(input)).toBe(paise));

  it.each(["", "-5", "abc", "1.234"])("rejects %s", (input) => expect(rupeesToPaise(input)).toBeNull());
});
