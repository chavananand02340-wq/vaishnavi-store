"use client";

import { supabase } from "@/services/supabase/browser";
import { removeImages, uploadAndSave } from "@/services/admin/storage";
import { CATEGORY_SELECT, PRODUCT_SELECT, slugify, uniqueSlug } from "@/lib/catalog";
import { AppError, unwrap } from "@/lib/errors";
import type { VariantRow } from "@/lib/product-form";
import type { Category, Product, ProductImage, Variant } from "@/types/catalog";

/** Shop panel: products, sizes, photos and categories. Every function throws AppError on failure. */

export type ProductDetails = {
  name: string;
  name_local: string | null;
  category_id: string;
  search_keywords: string | null;
  description: string | null;
  is_active: boolean;
  is_featured: boolean;
};

const ADMIN_PRODUCT_SELECT = `${PRODUCT_SELECT}, search_keywords`;

// ---------- Categories ----------

export async function listCategories(): Promise<Category[]> {
  return unwrap(await supabase().from("categories").select(CATEGORY_SELECT).order("sort_order").order("name"), "Couldn't load categories.") as Category[];
}

/** Categories plus how many products each one has. */
export async function listCategoriesWithCounts() {
  const [cats, p] = await Promise.all([listCategories(), supabase().from("products").select("category_id")]);
  const count = new Map<string, number>();
  for (const r of (p.data ?? []) as { category_id: string }[]) count.set(r.category_id, (count.get(r.category_id) ?? 0) + 1);
  return { cats, count };
}

export async function addCategory(name: string, existing: Category[]) {
  const clean = name.trim();
  if (clean.length < 2) throw new AppError("invalid", "Write a category name.");
  const slug = uniqueSlug(slugify(clean), existing.map((c) => c.slug));
  unwrap(await supabase().from("categories").insert({ name: clean, slug, sort_order: (existing.at(-1)?.sort_order ?? 0) + 10, is_active: true }), "Couldn't add category");
  return clean;
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, "name" | "is_active" | "image_path">>) {
  unwrap(await supabase().from("categories").update(patch).eq("id", id), "Couldn't save");
}

export async function deleteCategory(c: Category) {
  unwrap(await supabase().from("categories").delete().eq("id", c.id), "Couldn't delete. Move its products first.");
  await removeImages([c.image_path]);
}

/** New photo for a category; the old one is removed after the switch. */
export async function setCategoryPhoto(c: Category, file: File) {
  await uploadAndSave(file, `categories/${c.id}`, 800, (path) => updateCategory(c.id, { image_path: path }));
  await removeImages([c.image_path]);
}

/** Saves a new order for a list (categories, banners): positions 10, 20, 30… */
export async function saveOrder(table: "categories" | "banners" | "product_images", ids: string[], start = 10) {
  const sb = supabase();
  const results = await Promise.all(ids.map((id, k) => sb.from(table).update({ sort_order: start + k * 10 }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new AppError("unknown", "Couldn't save the new order", { cause: failed.error });
}

/** Swaps item i with its neighbour and returns the new id order. */
export function swapped<T extends { id?: string }>(list: T[], i: number, dir: -1 | 1): string[] {
  const order = list.map((x) => x.id!);
  if (i + dir < 0 || i + dir >= order.length) return order;
  [order[i], order[i + dir]] = [order[i + dir], order[i]];
  return order;
}

// ---------- Products ----------

export async function listProducts() {
  const sb = supabase();
  const [p, c, s] = await Promise.all([
    sb.from("products").select(ADMIN_PRODUCT_SELECT).order("name").limit(3000),
    listCategories(),
    sb.from("store_settings").select("low_stock_threshold").eq("id", 1).single(),
  ]);
  return {
    products: unwrap(p, "Couldn't load products.") as unknown as Product[],
    categories: c,
    lowStockAt: (s.data?.low_stock_threshold as number) ?? 5,
  };
}

export async function getProductForEdit(id: string) {
  const [p, categories] = await Promise.all([supabase().from("products").select(ADMIN_PRODUCT_SELECT).eq("id", id).maybeSingle(), listCategories()]);
  return { product: unwrap(p, "Couldn't load the product.") as unknown as Product | null, categories };
}

export function checkProductDetails(d: ProductDetails) {
  if (d.name.trim().length < 2) throw new AppError("invalid", "Write the product name.");
  if (!d.category_id) throw new AppError("invalid", "Choose a category.");
}

/** New product with its first size. If the size can't be saved, the product is removed again. */
export async function createProduct(d: ProductDetails, firstSize: VariantRow): Promise<string> {
  checkProductDetails(d);
  const sb = supabase();
  const ins = await sb.from("products").insert(d).select("id").single();
  if (ins.error || !ins.data) throw new AppError("network", "Couldn't save the product. Check your internet.", { cause: ins.error });
  const id = ins.data.id as string;
  const vr = await sb.from("product_variants").insert({ ...firstSize, product_id: id, sort_order: 0 });
  if (vr.error) {
    await sb.from("products").delete().eq("id", id);
    throw new AppError("unknown", "Couldn't save the price. Please try again.", { cause: vr.error });
  }
  return id;
}

export async function updateProduct(id: string, d: ProductDetails) {
  checkProductDetails(d);
  unwrap(await supabase().from("products").update(d).eq("id", id), "Couldn't save details");
}

/** Hidden copy with stock 0, so the owner can edit it before it shows. Returns the new id. */
export async function duplicateProduct(p: Product): Promise<string> {
  const sb = supabase();
  const ins = await sb
    .from("products")
    .insert({ name: `${p.name} (copy)`.slice(0, 120), name_local: p.name_local ?? null, category_id: p.category_id, description: p.description, search_keywords: p.search_keywords, is_active: false, is_featured: false })
    .select("id")
    .single();
  if (ins.error || !ins.data) throw new AppError("unknown", "Couldn't duplicate", { cause: ins.error });
  const id = ins.data.id as string;
  const sizes = p.product_variants.map((v) => ({ product_id: id, label: v.label, price_paise: v.price_paise, mrp_paise: v.mrp_paise, sort_order: v.sort_order, stock_qty: 0 }));
  if (sizes.length) unwrap(await sb.from("product_variants").insert(sizes), "Copy made, but its sizes couldn't be copied");
  return id;
}

/** Deletes the product (old orders keep their own copy of the details) and its photos. */
export async function deleteProduct(p: Product) {
  unwrap(await supabase().from("products").delete().eq("id", p.id), "Couldn't delete");
  await removeImages(p.product_images.map((i) => i.storage_path));
}

// ---------- Sizes (variants) ----------

export async function addVariant(productId: string, row: VariantRow, sortOrder: number) {
  unwrap(await supabase().from("product_variants").insert({ ...row, product_id: productId, sort_order: sortOrder }), "Couldn't add size");
}

export async function updateVariant(productId: string, variantId: string, patch: Partial<VariantRow>) {
  unwrap(await supabase().from("product_variants").update(patch).eq("id", variantId).eq("product_id", productId), "Couldn't save this size");
}

export async function setStock(variantId: string, qty: number) {
  if (!Number.isInteger(qty) || qty < 0) throw new AppError("invalid", "Stock must be 0 or more");
  unwrap(await supabase().from("product_variants").update({ stock_qty: qty }).eq("id", variantId), "Couldn't save stock");
}

export async function deleteVariant(v: Pick<Variant, "id">) {
  unwrap(await supabase().from("product_variants").delete().eq("id", v.id), "Couldn't delete this size");
}

// ---------- Product photos ----------

export async function addProductPhoto(productId: string, file: File, sortOrder: number) {
  await uploadAndSave(file, `products/${productId}`, 1200, async (path) => {
    unwrap(await supabase().from("product_images").insert({ product_id: productId, storage_path: path, sort_order: sortOrder }), "Couldn't save the photo");
  });
}

/** Puts one photo first (the one shown on cards). */
export async function setMainPhoto(images: ProductImage[], imageId: string) {
  await saveOrder("product_images", [imageId, ...images.map((i) => i.id!).filter((x) => x !== imageId)], 0);
}

export async function removeProductPhoto(img: Required<Pick<ProductImage, "id" | "storage_path">>) {
  unwrap(await supabase().from("product_images").delete().eq("id", img.id), "Couldn't remove the photo");
  await removeImages([img.storage_path]);
}

