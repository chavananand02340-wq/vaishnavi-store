"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_BUCKET, slugify } from "@/lib/catalog";

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const on = (fd: FormData, k: string) => fd.get(k) === "on";
const uuid = z.string().uuid();

function go(path: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(params).toString();
  redirect(qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path);
}

function safeReturn(fd: FormData, fallback: string): string {
  const r = str(fd, "return_to");
  return r.startsWith("/admin/") && !r.startsWith("//") ? r : fallback;
}

function refreshStore() {
  revalidatePath("/", "layout");
}

type VariantInput = {
  label: string;
  price_paise: number;
  mrp_paise: number | null;
  sale_price_paise: number | null;
  sale_ends_at: string | null;
  stock_qty: number;
};

/** Reads variant fields (optionally prefixed) and returns data or a friendly error. */
function readVariant(fd: FormData, prefix = ""): { data: VariantInput } | { error: string } {
  const label = str(fd, `${prefix}label`);
  if (label.length < 1 || label.length > 40) return { error: "Enter the size, e.g. 1 kg or 500 g." };

  const price = rupeesToPaise(str(fd, `${prefix}price`));
  if (price == null || price <= 0) return { error: "Enter a valid selling price." };

  const mrpRaw = str(fd, `${prefix}mrp`);
  const mrp = mrpRaw === "" ? null : rupeesToPaise(mrpRaw);
  if (mrpRaw !== "" && mrp == null) return { error: "MRP is not a valid amount." };
  if (mrp != null && mrp < price) return { error: "MRP cannot be lower than the selling price." };

  const saleRaw = str(fd, `${prefix}sale_price`);
  const sale = saleRaw === "" ? null : rupeesToPaise(saleRaw);
  if (saleRaw !== "" && (sale == null || sale <= 0)) return { error: "Offer price is not a valid amount." };
  if (sale != null && sale >= price) return { error: "Offer price must be lower than the selling price." };

  const endsRaw = str(fd, `${prefix}sale_ends_on`);
  let saleEnds: string | null = null;
  if (endsRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endsRaw)) return { error: "Offer end date is invalid." };
    saleEnds = `${endsRaw}T23:59:59+05:30`; // end of that day in India
  }

  const stockRaw = str(fd, `${prefix}stock`);
  const stock = stockRaw === "" ? 0 : Number(stockRaw);
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return { error: "Stock must be a whole number (0 or more)." };

  return {
    data: { label, price_paise: price, mrp_paise: mrp, sale_price_paise: sale, sale_ends_at: saleEnds, stock_qty: stock },
  };
}

const productSchema = z.object({
  name: z.string().trim().min(2, "Product name is too short").max(120),
  category_id: z.string().uuid("Choose a category"),
  description: z.string().trim().max(2000).transform((v) => v || null),
  search_keywords: z.string().trim().max(300).transform((v) => v || null),
});

function readProduct(fd: FormData) {
  return productSchema.safeParse({
    name: str(fd, "name"),
    category_id: str(fd, "category_id"),
    description: str(fd, "description"),
    search_keywords: str(fd, "search_keywords"),
  });
}

// ---------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------
export async function createCategory(fd: FormData) {
  await requireOwner();
  const name = str(fd, "name");
  if (name.length < 2 || name.length > 60) go("/admin/categories", { error: "Category name must be 2–60 characters." });

  const supabase = await createClient();
  const { data: last } = await supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const base = slugify(name);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { count } = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("slug", slug);
    if (!count) break;
    slug = `${base}-${i}`;
  }

  const { error } = await supabase
    .from("categories")
    .insert({ name, slug, sort_order: (last?.[0]?.sort_order ?? 0) + 10, is_active: true });
  if (error) go("/admin/categories", { error: "Could not add category." });
  refreshStore();
  go("/admin/categories", { saved: name });
}

export async function updateCategory(fd: FormData) {
  await requireOwner();
  const id = uuid.safeParse(str(fd, "id"));
  const name = str(fd, "name");
  const sort = Number(str(fd, "sort_order") || "0");
  if (!id.success || name.length < 2 || name.length > 60 || !Number.isInteger(sort)) {
    go("/admin/categories", { error: "Check the category name and position." });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name, sort_order: sort, is_active: on(fd, "is_active") })
    .eq("id", id.data);
  if (error) go("/admin/categories", { error: "Could not save category." });
  refreshStore();
  go("/admin/categories", { saved: name });
}

export async function deleteCategory(fd: FormData) {
  await requireOwner();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) go("/admin/categories", { error: "Invalid category." });
  const supabase = await createClient();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id.data);
  if (count) go("/admin/categories", { error: `This category still has ${count} product(s). Move or delete them first, or hide the category.` });
  const { error } = await supabase.from("categories").delete().eq("id", id.data);
  if (error) go("/admin/categories", { error: "Could not delete category." });
  refreshStore();
  go("/admin/categories", { removed: "1" });
}

// ---------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------
export async function createProduct(fd: FormData) {
  await requireOwner();
  const p = readProduct(fd);
  if (!p.success) go("/admin/products/new", { error: p.error.issues[0].message });
  const v = readVariant(fd);
  if ("error" in v) go("/admin/products/new", { error: v.error });

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .insert({ ...p.data, is_active: !fd.has("is_hidden"), is_featured: on(fd, "is_featured") })
    .select("id")
    .single();
  if (error || !product) go("/admin/products/new", { error: "Could not save product." });

  const { error: vErr } = await supabase.from("product_variants").insert({ ...v.data, product_id: product.id, sort_order: 0 });
  if (vErr) {
    await supabase.from("products").delete().eq("id", product.id);
    go("/admin/products/new", { error: "Could not save the size/price. Please try again." });
  }

  refreshStore();
  if (str(fd, "next") === "another") {
    go("/admin/products/new", { saved: p.data.name, category: p.data.category_id });
  }
  go(`/admin/products/${product.id}`, { created: "1" });
}

export async function updateProduct(fd: FormData) {
  await requireOwner();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) go("/admin/products", { error: "Invalid product." });
  const back = `/admin/products/${id.data}`;
  const p = readProduct(fd);
  if (!p.success) go(back, { error: p.error.issues[0].message });

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ ...p.data, is_active: on(fd, "is_active"), is_featured: on(fd, "is_featured") })
    .eq("id", id.data);
  if (error) go(back, { error: "Could not save product." });
  refreshStore();
  go(back, { saved: "1" });
}

export async function deleteProduct(fd: FormData) {
  await requireOwner();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) go("/admin/products", { error: "Invalid product." });
  if (str(fd, "confirm") !== "DELETE") {
    go(`/admin/products/${id.data}`, { error: "Type DELETE to confirm, or just hide the product instead." });
  }
  const supabase = await createClient();
  const { data: imgs } = await supabase.from("product_images").select("storage_path").eq("product_id", id.data);
  // Past orders keep their own copy of names and prices, so deleting is safe.
  const { error } = await supabase.from("products").delete().eq("id", id.data);
  if (error) go(`/admin/products/${id.data}`, { error: "Could not delete product." });
  const paths = (imgs ?? []).map((i) => i.storage_path as string);
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  refreshStore();
  go("/admin/products", { removed: "1" });
}

/** Copy a product with its sizes (stock 0, hidden) so similar items are quick to add. */
export async function duplicateProduct(fd: FormData) {
  await requireOwner();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) go("/admin/products", { error: "Invalid product." });
  const supabase = await createClient();
  const { data: src } = await supabase
    .from("products")
    .select("name, category_id, description, search_keywords, product_variants(label, price_paise, mrp_paise, sort_order)")
    .eq("id", id.data)
    .single();
  if (!src) go("/admin/products", { error: "Product not found." });

  const { data: copy, error } = await supabase
    .from("products")
    .insert({
      name: `${src.name} (copy)`.slice(0, 120),
      category_id: src.category_id,
      description: src.description,
      search_keywords: src.search_keywords,
      is_active: false,
      is_featured: false,
    })
    .select("id")
    .single();
  if (error || !copy) go(`/admin/products/${id.data}`, { error: "Could not duplicate." });

  const variants = (src.product_variants ?? []) as { label: string; price_paise: number; mrp_paise: number | null; sort_order: number }[];
  if (variants.length) {
    await supabase.from("product_variants").insert(variants.map((v) => ({ ...v, product_id: copy.id, stock_qty: 0 })));
  }
  go(`/admin/products/${copy.id}`, { duplicated: "1" });
}

// ---------------------------------------------------------------------
// Variants (sizes)
// ---------------------------------------------------------------------
export async function addVariant(fd: FormData) {
  await requireOwner();
  const pid = uuid.safeParse(str(fd, "product_id"));
  if (!pid.success) go("/admin/products", { error: "Invalid product." });
  const back = `/admin/products/${pid.data}`;
  const v = readVariant(fd);
  if ("error" in v) go(back, { error: v.error });

  const supabase = await createClient();
  const { count } = await supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", pid.data);
  const { error } = await supabase
    .from("product_variants")
    .insert({ ...v.data, product_id: pid.data, sort_order: (count ?? 0) * 10 });
  if (error) go(back, { error: "Could not add size." });
  refreshStore();
  go(back, { saved: "1" });
}

export async function updateVariant(fd: FormData) {
  await requireOwner();
  const id = uuid.safeParse(str(fd, "id"));
  const pid = uuid.safeParse(str(fd, "product_id"));
  if (!id.success || !pid.success) go("/admin/products", { error: "Invalid size." });
  const back = `/admin/products/${pid.data}`;
  const v = readVariant(fd);
  if ("error" in v) go(back, { error: v.error });

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
    .update({ ...v.data, is_active: on(fd, "is_active") })
    .eq("id", id.data)
    .eq("product_id", pid.data);
  if (error) go(back, { error: "Could not save size." });
  refreshStore();
  go(back, { saved: "1" });
}

export async function deleteVariant(fd: FormData) {
  await requireOwner();
  const id = uuid.safeParse(str(fd, "id"));
  const pid = uuid.safeParse(str(fd, "product_id"));
  if (!id.success || !pid.success) go("/admin/products", { error: "Invalid size." });
  const back = `/admin/products/${pid.data}`;
  const supabase = await createClient();
  const { count } = await supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", pid.data);
  if ((count ?? 0) <= 1) go(back, { error: "A product needs at least one size. Hide the product instead." });
  const { error } = await supabase.from("product_variants").delete().eq("id", id.data).eq("product_id", pid.data);
  if (error) go(back, { error: "Could not delete size." });
  refreshStore();
  go(back, { saved: "1" });
}

/** Stock update from the product list. */
export async function quickStock(fd: FormData) {
  await requireOwner();
  const back = safeReturn(fd, "/admin/products");
  const id = uuid.safeParse(str(fd, "id"));
  const stock = Number(str(fd, "stock"));
  if (!id.success || !Number.isInteger(stock) || stock < 0 || stock > 100000) go(back, { error: "Stock must be 0 or more." });
  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").update({ stock_qty: stock }).eq("id", id.data);
  if (error) go(back, { error: "Could not update stock." });
  refreshStore();
  go(back, { saved: "1" });
}

// ---------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------
/** Called by the uploader after the file is in storage. */
export async function registerProductImage(productId: string, storagePath: string) {
  await requireOwner();
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Invalid product." };
  if (!new RegExp(`^products/${productId}/[a-zA-Z0-9-]+\\.(webp|jpg|jpeg|png)$`).test(storagePath)) {
    return { ok: false, message: "Invalid image path." };
  }
  const supabase = await createClient();
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if ((count ?? 0) >= 6) {
    await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
    return { ok: false, message: "Maximum 6 photos per product." };
  }
  const { error } = await supabase
    .from("product_images")
    .insert({ product_id: productId, storage_path: storagePath, sort_order: (count ?? 0) * 10 });
  if (error) return { ok: false, message: "Could not save photo." };
  refreshStore();
  return { ok: true };
}

export async function deleteProductImage(fd: FormData) {
  await requireOwner();
  const id = uuid.safeParse(str(fd, "id"));
  const pid = uuid.safeParse(str(fd, "product_id"));
  if (!id.success || !pid.success) go("/admin/products", { error: "Invalid photo." });
  const supabase = await createClient();
  const { data: img } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", id.data)
    .eq("product_id", pid.data)
    .single();
  if (img) {
    await supabase.from("product_images").delete().eq("id", id.data);
    await supabase.storage.from(IMAGE_BUCKET).remove([img.storage_path as string]);
  }
  refreshStore();
  go(`/admin/products/${pid.data}`, { saved: "1" });
}

export async function makeMainImage(fd: FormData) {
  await requireOwner();
  const id = uuid.safeParse(str(fd, "id"));
  const pid = uuid.safeParse(str(fd, "product_id"));
  if (!id.success || !pid.success) go("/admin/products", { error: "Invalid photo." });
  const supabase = await createClient();
  const { data: imgs } = await supabase.from("product_images").select("id").eq("product_id", pid.data).order("sort_order");
  const ordered = [id.data, ...(imgs ?? []).map((i) => i.id as string).filter((x) => x !== id.data)];
  for (let i = 0; i < ordered.length; i++) {
    await supabase.from("product_images").update({ sort_order: i * 10 }).eq("id", ordered[i]);
  }
  refreshStore();
  go(`/admin/products/${pid.data}`, { saved: "1" });
}
