"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))
  .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a 10-digit mobile number")
  .transform((v) => (v === "" ? null : v));
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const rupees = z
  .string()
  .transform((v, ctx) => {
    const p = rupeesToPaise(v);
    if (p === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter an amount in rupees" });
      return z.NEVER;
    }
    return p;
  });
const optionalRupees = z.string().transform((v, ctx) => {
  if (v.trim() === "") return null;
  const p = rupeesToPaise(v);
  if (p === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter an amount in rupees" });
    return z.NEVER;
  }
  return p;
});
const checkbox = (fd: FormData, name: string) => fd.get(name) === "on";
const str = (fd: FormData, name: string) => String(fd.get(name) ?? "");

function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

// ---------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------
const settingsSchema = z.object({
  store_name: z.string().trim().min(2).max(80),
  tagline: text(120),
  address: text(300),
  phone_primary: mobile,
  phone_secondary: mobile,
  whatsapp_number: mobile,
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email")
    .transform((v) => (v === "" ? null : v)),
  instagram_url: text(300),
  maps_url: text(300),
  open_time: time,
  close_time: time,
  closed_message: text(200),
  announcement: text(200),
  default_eta_minutes: z.coerce.number().int().min(5).max(600),
  delivery_fee_paise: rupees,
  free_delivery_threshold_paise: rupees,
  min_order_paise: optionalRupees,
  low_stock_threshold: z.coerce.number().int().min(0).max(10000),
  upi_id: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(v), "Invalid UPI ID")
    .transform((v) => (v === "" ? null : v)),
  upi_payee_name: text(80),
});

export async function saveSettings(formData: FormData) {
  await requireOwner();

  const parsed = settingsSchema.safeParse({
    store_name: str(formData, "store_name"),
    tagline: str(formData, "tagline"),
    address: str(formData, "address"),
    phone_primary: str(formData, "phone_primary"),
    phone_secondary: str(formData, "phone_secondary"),
    whatsapp_number: str(formData, "whatsapp_number"),
    email: str(formData, "email"),
    instagram_url: str(formData, "instagram_url"),
    maps_url: str(formData, "maps_url"),
    open_time: str(formData, "open_time").slice(0, 5),
    close_time: str(formData, "close_time").slice(0, 5),
    closed_message: str(formData, "closed_message"),
    announcement: str(formData, "announcement"),
    default_eta_minutes: str(formData, "default_eta_minutes"),
    delivery_fee_paise: str(formData, "delivery_fee"),
    free_delivery_threshold_paise: str(formData, "free_delivery_threshold"),
    min_order_paise: str(formData, "min_order"),
    low_stock_threshold: str(formData, "low_stock_threshold"),
    upi_id: str(formData, "upi_id"),
    upi_payee_name: str(formData, "upi_payee_name"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    back("/admin/settings", { error: `${issue.path.join(".")}: ${issue.message}` });
  }

  const upiEnabled = checkbox(formData, "upi_enabled");
  if (upiEnabled && (!parsed.data.upi_id || !parsed.data.upi_payee_name)) {
    back("/admin/settings", { error: "To turn on UPI, enter the UPI ID and payee name first." });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("store_settings")
    .update({
      ...parsed.data,
      accepting_orders: checkbox(formData, "accepting_orders"),
      free_delivery_enabled: checkbox(formData, "free_delivery_enabled"),
      cod_enabled: checkbox(formData, "cod_enabled"),
      upi_enabled: upiEnabled,
    })
    .eq("id", 1);

  if (error) back("/admin/settings", { error: "Could not save. Please try again." });

  revalidatePath("/", "layout");
  back("/admin/settings", { saved: "1" });
}

/** One-tap switch from the dashboard. */
export async function setAcceptingOrders(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();
  await supabase
    .from("store_settings")
    .update({ accepting_orders: formData.get("value") === "true" })
    .eq("id", 1);
  revalidatePath("/", "layout");
  redirect("/admin");
}

// ---------------------------------------------------------------------
// PIN codes
// ---------------------------------------------------------------------
const pinSchema = z.object({
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "PIN code must be 6 digits"),
  area_name: text(80),
  fee_override_paise: optionalRupees,
});

export async function addPincode(formData: FormData) {
  await requireOwner();
  const parsed = pinSchema.safeParse({
    pincode: str(formData, "pincode"),
    area_name: str(formData, "area_name"),
    fee_override_paise: str(formData, "fee_override"),
  });
  if (!parsed.success) back("/admin/pincodes", { error: parsed.error.issues[0].message });

  const supabase = await createClient();
  const { error } = await supabase.from("delivery_pincodes").insert({ ...parsed.data, is_active: true });
  if (error) {
    back("/admin/pincodes", {
      error: error.code === "23505" ? "This PIN code is already in the list." : "Could not add PIN code.",
    });
  }
  revalidatePath("/", "layout");
  back("/admin/pincodes", { saved: parsed.data.pincode });
}

export async function updatePincode(formData: FormData) {
  await requireOwner();
  const pincode = str(formData, "pincode");
  const parsed = pinSchema.safeParse({
    pincode,
    area_name: str(formData, "area_name"),
    fee_override_paise: str(formData, "fee_override"),
  });
  if (!parsed.success) back("/admin/pincodes", { error: parsed.error.issues[0].message });

  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_pincodes")
    .update({
      area_name: parsed.data.area_name,
      fee_override_paise: parsed.data.fee_override_paise,
      is_active: checkbox(formData, "is_active"),
    })
    .eq("pincode", pincode);
  if (error) back("/admin/pincodes", { error: "Could not update PIN code." });
  revalidatePath("/", "layout");
  back("/admin/pincodes", { saved: pincode });
}

export async function deletePincode(formData: FormData) {
  await requireOwner();
  const pincode = str(formData, "pincode");
  if (!/^[1-9]\d{5}$/.test(pincode)) back("/admin/pincodes", { error: "Invalid PIN code." });

  const supabase = await createClient();
  // Past orders keep their own copy of the PIN code, so deleting is safe.
  const { error } = await supabase.from("delivery_pincodes").delete().eq("pincode", pincode);
  if (error) back("/admin/pincodes", { error: "Could not remove PIN code." });
  revalidatePath("/", "layout");
  back("/admin/pincodes", { removed: pincode });
}
