import { describe, expect, it } from "vitest";
import { bestDiscount, comparePrice, effectivePrice, slugify, toCard, uniqueSlug } from "@/lib/catalog";
import type { Product, Variant } from "@/types/catalog";

const v = (o: Partial<Variant> = {}): Variant => ({
  id: "v1", label: "1 kg", price_paise: 10000, mrp_paise: 12000, sale_price_paise: null, sale_ends_at: null, stock_qty: 5, is_active: true, sort_order: 0, ...o,
});

describe("prices", () => {
  it("uses the selling price without a sale", () => {
    expect(effectivePrice(v())).toBe(10000);
    expect(comparePrice(v())).toBe(12000);
  });
  it("uses the sale price while it is valid", () => {
    const sale = v({ sale_price_paise: 9000, sale_ends_at: "2999-01-01T00:00:00Z" });
    expect(effectivePrice(sale)).toBe(9000);
    expect(comparePrice(sale)).toBe(12000);
  });
  it("ignores an expired sale", () => {
    expect(effectivePrice(v({ sale_price_paise: 9000, sale_ends_at: "2000-01-01T00:00:00Z" }))).toBe(10000);
  });
  it("shows no strike-through when MRP equals the price", () => {
    expect(comparePrice(v({ mrp_paise: 10000 }))).toBeNull();
  });
});

describe("toCard", () => {
  const p = (variants: Variant[]): Product => ({ id: "p1", name: "Atta", description: null, category_id: "c1", is_active: true, is_featured: false, product_variants: variants, product_images: [] });
  it("drops products with no active size", () => expect(toCard(p([v({ is_active: false })]))).toBeNull());
  it("works out the best in-stock discount", () => {
    const card = toCard(p([v(), v({ id: "v2", price_paise: 5000, mrp_paise: 10000, stock_qty: 0 })]))!;
    expect(bestDiscount(card)).toBe(17); // 120 → 100; the 50% size is out of stock
  });
});

describe("slugs", () => {
  it.each([
    ["Atta, Rice & Dal", "atta-rice-and-dal"],
    ["  Tea / Coffee  ", "tea-coffee"],
    ["!!!", "category"],
  ])("%s → %s", (name, slug) => expect(slugify(name)).toBe(slug));
  it("adds a number when taken", () => expect(uniqueSlug("oil", ["oil", "oil-2"])).toBe("oil-3"));
});
