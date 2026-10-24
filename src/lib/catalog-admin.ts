"use client";

import { rupeesToPaise, paiseToRupeesInput } from "@/lib/money";
import type { Variant } from "@/lib/catalog";

/** Editable form state for one size (strings, exactly as typed). */
export type VariantForm = { label: string; price: string; mrp: string; sale: string; saleEnds: string; stock: string; active: boolean };

export const EMPTY_VARIANT: VariantForm = { label: "", price: "", mrp: "", sale: "", saleEnds: "", stock: "", active: true };

export function variantToForm(v: Variant): VariantForm {
  return {
    label: v.label,
    price: paiseToRupeesInput(v.price_paise),
    mrp: paiseToRupeesInput(v.mrp_paise),
    sale: paiseToRupeesInput(v.sale_price_paise),
    saleEnds: v.sale_ends_at ? new Date(v.sale_ends_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "",
    stock: String(v.stock_qty),
    active: v.is_active,
  };
}

export type VariantRow = {
  label: string;
  price_paise: number;
  mrp_paise: number | null;
  sale_price_paise: number | null;
  sale_ends_at: string | null;
  stock_qty: number;
  is_active: boolean;
};

/** Validates a size form. Returns the database row or a message the owner can act on. */
export function parseVariant(f: VariantForm): { row: VariantRow } | { error: string } {
  const label = f.label.trim();
  if (!label || label.length > 40) return { error: "Write the pack size, like 1 kg or 500 g." };
  const price = rupeesToPaise(f.price);
  if (price == null || price <= 0) return { error: "Enter the selling price in rupees." };
  const mrp = f.mrp.trim() ? rupeesToPaise(f.mrp) : null;
  if (f.mrp.trim() && mrp == null) return { error: "MRP isn't a valid amount." };
  if (mrp != null && mrp < price) return { error: "MRP can't be lower than the selling price." };
  const sale = f.sale.trim() ? rupeesToPaise(f.sale) : null;
  if (f.sale.trim() && (sale == null || sale <= 0)) return { error: "Offer price isn't a valid amount." };
  if (sale != null && sale >= price) return { error: "Offer price must be lower than the selling price." };
  if (f.saleEnds && !/^\d{4}-\d{2}-\d{2}$/.test(f.saleEnds)) return { error: "Offer end date isn't valid." };
  const stock = f.stock.trim() === "" ? 0 : Number(f.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return { error: "Stock must be a whole number, 0 or more." };
  return {
    row: {
      label,
      price_paise: price,
      mrp_paise: mrp,
      sale_price_paise: sale,
      sale_ends_at: sale != null && f.saleEnds ? `${f.saleEnds}T23:59:59+05:30` : null,
      stock_qty: stock,
      is_active: f.active,
    },
  };
}
