"use client";

import { supabase } from "@/services/supabase/browser";
import { removeImages, uploadAndSave, uploadImage } from "@/services/admin/storage";
import { AppError, unwrap } from "@/lib/errors";
import { couponFromForm, type CouponForm } from "@/lib/coupon-form";
import type { StoreSettings } from "@/types/settings";

/** Shop panel: home-page banners, the top offer banner and coupons. */

// ---------- Sliding photo banners ----------

export type BannerRow = { id: string; image_path: string; link_url: string | null; alt_text: string | null; sort_order: number; is_active: boolean };

export async function listBanners(): Promise<BannerRow[]> {
  return unwrap(await supabase().from("banners").select("*").order("sort_order"), "Couldn't load banners.") as BannerRow[];
}

export async function addBanner(file: File, after: BannerRow[]) {
  await uploadAndSave(file, "banners", 1600, async (path) => {
    unwrap(await supabase().from("banners").insert({ image_path: path, sort_order: (after.at(-1)?.sort_order ?? 0) + 10, is_active: true }), "Couldn't save the banner");
  });
}

export async function updateBanner(id: string, patch: Partial<Pick<BannerRow, "alt_text" | "link_url" | "is_active">>) {
  unwrap(await supabase().from("banners").update(patch).eq("id", id), "Couldn't save");
}

export async function deleteBanner(b: BannerRow) {
  unwrap(await supabase().from("banners").delete().eq("id", b.id), "Couldn't delete");
  await removeImages([b.image_path]);
}

// ---------- Top offer banner (stored in store_settings) ----------

export type OfferFields = Pick<StoreSettings, "sale_enabled" | "sale_title" | "sale_subtitle" | "sale_percent" | "sale_coupon_code" | "sale_theme" | "sale_image_path" | "sale_link_url">;
export type CouponOption = { code: string; kind: string; value: number; is_active: boolean };

/** The offer banner, the coupons it can point to, and whether the photo columns exist (SQL part 22). */
export async function getOfferBanner() {
  const sb = supabase();
  const [s, c] = await Promise.all([
    sb.from("store_settings").select("*").eq("id", 1).single(),
    sb.from("coupons").select("code, kind, value, is_active").order("created_at", { ascending: false }),
  ]);
  const row = unwrap(s, "Couldn't load the banner.") as OfferFields & Record<string, unknown>;
  return { offer: row, hasPicture: "sale_image_path" in row, coupons: (c.data ?? []) as CouponOption[] };
}

export const uploadOfferPicture = (file: File) => uploadImage(file, "banners/offer", 1600);

export async function saveOfferBanner(patch: Partial<OfferFields>, oldImage: string | null | undefined) {
  if (patch.sale_percent != null && (!Number.isInteger(patch.sale_percent) || patch.sale_percent < 1 || patch.sale_percent > 90)) {
    throw new AppError("invalid", "Percent must be a whole number from 1 to 90");
  }
  if (patch.sale_enabled && !patch.sale_title) throw new AppError("invalid", "Write the offer name, e.g. Diwali Sale");
  unwrap(await supabase().from("store_settings").update(patch).eq("id", 1), "Couldn't save the banner");
  if (oldImage && "sale_image_path" in patch && oldImage !== patch.sale_image_path) await removeImages([oldImage]);
}

// ---------- Coupons ----------

export type { CouponForm };

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "flat";
  value: number;
  min_order_paise: number;
  max_discount_paise: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  per_phone_limit: number | null;
  show_in_checkout: boolean;
  is_active: boolean;
};

const COUPON_SELECT = "id, code, description, kind, value, min_order_paise, max_discount_paise, starts_at, ends_at, usage_limit, used_count, per_phone_limit, show_in_checkout, is_active";

export async function listAllCoupons(): Promise<Coupon[]> {
  return unwrap(await supabase().from("coupons").select(COUPON_SELECT).order("created_at", { ascending: false }), "Couldn't load coupons.") as Coupon[];
}

export async function createCoupon(f: CouponForm) {
  const row = couponFromForm(f);
  const { error } = await supabase().from("coupons").insert(row);
  if (error?.code === "23505") throw new AppError("conflict", `${f.code} already exists`, { cause: error });
  if (error) throw new AppError("unknown", "Couldn't create coupon", { cause: error });
  return row.code;
}

export async function updateCoupon(id: string, patch: Partial<Coupon>) {
  unwrap(await supabase().from("coupons").update(patch).eq("id", id), "Couldn't save");
}

export async function deleteCoupon(id: string) {
  unwrap(await supabase().from("coupons").delete().eq("id", id), "Couldn't delete");
}
