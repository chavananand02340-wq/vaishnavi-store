"use client";

import { useRef, useState } from "react";
import { addProductPhoto } from "@/services/admin/catalog";
import { MAX_PRODUCT_PHOTOS } from "@/config/site";
import { errorMessage } from "@/lib/errors";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

/** "Add photo" tile on the product page: picks one or more photos, shrinks and uploads them in order. */
export function ImageUploader({ productId, count, onDone }: { productId: string; count: number; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const full = count >= MAX_PRODUCT_PHOTOS;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    let n = count;
    try {
      for (const [i, file] of Array.from(files).entries()) {
        if (n >= MAX_PRODUCT_PHOTOS) {
          toast(`A product can have up to ${MAX_PRODUCT_PHOTOS} photos.`, "error");
          break;
        }
        if (!file.type.startsWith("image/")) continue;
        setBusy(`Uploading ${i + 1} of ${files.length}…`);
        await addProductPhoto(productId, file, n * 10);
        n++;
      }
      if (n > count) toast(n - count > 1 ? `${n - count} photos added` : "Photo added");
      onDone();
    } catch (e) {
      toast(errorMessage(e, "Upload failed"), "error");
      if (n > count) onDone();
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
        <span className="px-1 text-center text-[12.5px] font-bold leading-tight">{busy ?? (full ? `${MAX_PRODUCT_PHOTOS} photos max` : "Add photo")}</span>
      </button>
    </>
  );
}
