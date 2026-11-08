"use client";

import { supabase } from "@/services/supabase/browser";
import { IMAGE_BUCKET } from "@/config/site";
import { shrinkImage } from "@/lib/image";
import { AppError } from "@/lib/errors";

/** Photos in Supabase Storage (products, categories, banners). */

/** Shrinks a phone photo and uploads it under `folder`. Returns the storage path. */
export async function uploadImage(file: File, folder: string, maxSide: number): Promise<string> {
  if (!file.type.startsWith("image/")) throw new AppError("invalid", "Choose a photo (JPG, PNG or WebP).");
  const { blob, ext } = await shrinkImage(file, maxSide);
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase().storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (error) throw new AppError("upstream", `Upload failed: ${error.message}`, { cause: error });
  return path;
}

/** Deletes photos. Best effort: a leftover file is harmless. */
export async function removeImages(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return;
  const { error } = await supabase().storage.from(IMAGE_BUCKET).remove(list);
  if (error) console.warn("[storage] couldn't remove", list, error.message);
}

/**
 * Uploads a photo, then runs `save(path)` (e.g. a database insert).
 * If saving fails the photo is removed again, so nothing is left half-done.
 */
export async function uploadAndSave(file: File, folder: string, maxSide: number, save: (path: string) => Promise<void>): Promise<string> {
  const path = await uploadImage(file, folder, maxSide);
  try {
    await save(path);
  } catch (e) {
    await removeImages([path]);
    throw e;
  }
  return path;
}
