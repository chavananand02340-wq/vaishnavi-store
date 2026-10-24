"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { IMAGE_BUCKET } from "@/lib/catalog";
import { Icon } from "@/components/Icon";
import { shrinkImage } from "@/lib/image";
import { useToast } from "@/components/Toast";

export function ImageUploader({ productId, count, onDone }: { productId: string; count: number; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const full = count >= 6;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const sb = supabase();
    let n = count;
    try {
      for (const [i, file] of Array.from(files).entries()) {
        if (n >= 6) {
          toast("A product can have up to 6 photos.", "error");
          break;
        }
        if (!file.type.startsWith("image/")) continue;
        setBusy(`Uploading ${i + 1} of ${files.length}…`);
        const { blob, ext } = await shrinkImage(file, 1200);
        const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (up.error) throw new Error(up.error.message);
        const ins = await sb.from("product_images").insert({ product_id: productId, storage_path: path, sort_order: n * 10 });
        if (ins.error) {
          await sb.storage.from(IMAGE_BUCKET).remove([path]);
          throw new Error(ins.error.message);
        }
        n++;
      }
      toast("Photo added");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed", "error");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <button
        type="button"
        disabled={!!busy || full}
        onClick={() => input.current?.click()}
        className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 text-teal-800 disabled:opacity-50"
      >
        <Icon name="camera" className="size-7" />
        <span className="px-1 text-center text-[12.5px] font-bold leading-tight">{busy ?? (full ? "6 photos max" : "Add photo")}</span>
      </button>
    </>
  );
}
