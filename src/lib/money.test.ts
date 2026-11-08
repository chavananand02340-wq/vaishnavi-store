import { describe, expect, it } from "vitest";
import { formatPaise, paiseToRupeesInput, rupeesToPaise } from "./money";

describe("rupeesToPaise", () => {
  it.each([
    ["30", 3000],
    ["349.5", 34950],
    ["₹ 1,200", 120000],
    ["0", 0],
  ])("%s → %i", (input, paise) => expect(rupeesToPaise(input)).toBe(paise));

  it.each(["", "-5", "abc", "1.234"])("rejects %s", (input) => expect(rupeesToPaise(input)).toBeNull());
});

describe("paiseToRupeesInput", () => {
  it.each([
    [3000, "30"],
    [34950, "349.50"],
    [null, ""],
  ])("%s → %s", (paise, text) => expect(paiseToRupeesInput(paise)).toBe(text));
});

describe("formatPaise", () => {
  it("shows rupees with the Indian grouping", () => expect(formatPaise(12000000)).toMatch(/1,20,000/));
});
