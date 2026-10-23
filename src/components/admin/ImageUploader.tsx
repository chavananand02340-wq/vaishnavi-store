"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET } from "@/lib/catalog";
import { registerProductImage } from "@/app/admin/catalog-actions";

const MAX_SIDE = 1200;

/** Shrinks a phone photo before upload: max 1200px, WebP (or JPEG where WebP isn't supported). */
async function shrink(file: File): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  const webp = await toBlob("image/webp", 0.82);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await toBlob("image/jpeg", 0.85);
  if (!jpg) throw new Error("Could not process photo");
  return { blob: jpg, ext: "jpg" };
}

export function ImageUploader({ productId, disabled }: { productId: string; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const supabase = createClient();
    try {
      for (const [i, file] of Array.from(files).entries()) {
        if (!file.type.startsWith("image/")) {
          setStatus("Only photos can be uploaded.");
          continue;
        }
        setStatus(`Uploading photo ${i + 1} of ${files.length}…`);
        const { blob, ext } = await shrink(file);
        const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
        if (error) throw new Error(error.message);
        const res = await registerProductImage(productId, path);
        if (!res.ok) throw new Error(res.message);
      }
      setStatus("Photo added.");
      startTransition(() => router.refresh());
    } catch (e) {
      setStatus(e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        type="button"
        className="btn-ghost w-full"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : "📷 Add photo (camera or gallery)"}
      </button>
      {status && <p className="hint mt-2" role="status">{status}</p>}
    </div>
  );
}
