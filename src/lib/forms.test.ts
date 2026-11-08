import { describe, expect, it } from "vitest";
import { EMPTY_VARIANT, parseVariant } from "@/lib/product-form";
import { EMPTY_DETAILS, checkDetails, fullAddress, normalizeMobile } from "@/lib/checkout-form";
import { couponFromForm, type CouponForm } from "@/lib/coupon-form";
import { AppError } from "@/lib/errors";

describe("size form", () => {
  const ok = { ...EMPTY_VARIANT, label: "1 kg", price: "100", mrp: "120", stock: "4" };
  it("builds the database row in paise", () => {
    expect(parseVariant(ok)).toEqual({ row: { label: "1 kg", price_paise: 10000, mrp_paise: 12000, sale_price_paise: null, sale_ends_at: null, stock_qty: 4, is_active: true } });
  });
  it.each([
    [{ label: "" }, "pack size"],
    [{ price: "abc" }, "selling price"],
    [{ mrp: "90" }, "MRP can't be lower"],
    [{ sale: "150" }, "Offer price must be lower"],
    [{ stock: "-1" }, "Stock"],
  ])("rejects %j", (patch, message) => {
    const r = parseVariant({ ...ok, ...patch });
    expect("error" in r && r.error).toContain(message);
  });
});

describe("checkout details", () => {
  it("normalises mobile numbers", () => {
    expect(normalizeMobile("+91 98765 43210")).toBe("9876543210");
    expect(normalizeMobile("09876543210")).toBe("9876543210");
  });
  it("adds city and state to the address once", () => {
    expect(fullAddress({ address: "Flat 2, Tukum", city: "Wardha", state: "Maharashtra" })).toBe("Flat 2, Tukum, Wardha, Maharashtra");
    expect(fullAddress({ address: "Flat 2, Wardha", city: "Wardha", state: "" })).toBe("Flat 2, Wardha");
  });
  it("lists what to fix", () => {
    const e = checkDetails({ ...EMPTY_DETAILS, name: "Priya", phone: "12345", address: "Flat 2, Tukum", pincode: "442001" });
    expect(e).toEqual({ name: null, phone: "Enter a 10-digit mobile number", email: null, address: null, pincode: null });
  });
});

describe("coupon form", () => {
  const f: CouponForm = { code: "DIWALI10", description: "", kind: "percent", value: "10", min_order: "200", max_discount: "100", ends_on: "", usage_limit: "", once_per_customer: true, show_in_checkout: true };
  it("builds the row", () => {
    expect(couponFromForm(f)).toMatchObject({ code: "DIWALI10", kind: "percent", value: 10, min_order_paise: 20000, max_discount_paise: 10000, per_phone_limit: 1 });
  });
  it("rejects a bad percent", () => {
    expect(() => couponFromForm({ ...f, value: "95" })).toThrow(AppError);
  });
});
