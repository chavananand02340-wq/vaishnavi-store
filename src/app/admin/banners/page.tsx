"use client";

import { useRef, useState } from "react";
import { addBanner, deleteBanner, listBanners, updateBanner, type BannerRow as Banner } from "@/services/admin/marketing";
import { saveOrder, swapped } from "@/services/admin/catalog";
import { imageUrl } from "@/lib/catalog";
import { useAsync } from "@/hooks/useAsync";
import { useAction } from "@/hooks/useAction";
import { Card, CardTitle, Empty, ErrorBox, PageTitle, Spinner, Switch } from "@/components/admin/AdminUI";
import { Icon } from "@/components/ui/Icon";
import { OfferBannerEditor } from "@/components/admin/OfferBannerEditor";

function BannerRow({ b, first, last, onMove, onChanged }: { b: Banner; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onChanged: () => void }) {
  const { run, isBusy: busy } = useAction();
  const [alt, setAlt] = useState(b.alt_text ?? "");
  const [link, setLink] = useState(b.link_url ?? "");
  const dirty = alt !== (b.alt_text ?? "") || link !== (b.link_url ?? "");

  const save = (patch: Partial<Banner>, msg: string) => run("save", () => updateBanner(b.id, patch), { success: msg, refreshStore: true, onSuccess: onChanged });
  async function remove() {
    if (!window.confirm("Delete this banner?")) return;
    await run("remove", () => deleteBanner(b), { success: "Banner deleted", refreshStore: true, onSuccess: onChanged });
  }

  return (
    <li className={`overflow-hidden rounded-2xl bg-white ring-1 ${b.is_active ? "ring-orange-200" : "ring-line opacity-75"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl(b.image_path) ?? ""} alt="" className="aspect-[2/1] w-full bg-page object-cover" />
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <button type="button" disabled={first || busy} onClick={() => onMove(-1)} className="btn-plain min-h-10 px-3" aria-label="Move earlier">
            <Icon name="left" className="size-4" strokeWidth={2.6} />
          </button>
          <button type="button" disabled={last || busy} onClick={() => onMove(1)} className="btn-plain min-h-10 px-3" aria-label="Move later">
            <Icon name="right" className="size-4" strokeWidth={2.6} />
          </button>
          <div className="flex-1" />
          <button type="button" onClick={remove} disabled={busy} className="btn-danger min-h-10 px-3" aria-label="Delete banner">
            <Icon name="trash" />
          </button>
        </div>
        <div>
          <label className="label" htmlFor={`alt-${b.id}`}>What the banner says (for screen readers)</label>
          <input id={`alt-${b.id}`} className="field py-2.5" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={160} placeholder="Diwali dry fruit boxes, 10% off" />
        </div>
        <div>
          <label className="label" htmlFor={`link-${b.id}`}>Opens when tapped (optional)</label>
          <input id={`link-${b.id}`} className="field py-2.5" value={link} onChange={(e) => setLink(e.target.value)} maxLength={300} placeholder="/c/snacks-biscuits" autoCapitalize="none" />
          <p className="hint">A category like /c/oil-ghee, or leave empty.</p>
        </div>
        {dirty && (
          <button type="button" disabled={busy} onClick={() => save({ alt_text: alt.trim() || null, link_url: link.trim() || null }, "Banner saved")} className="btn w-full bg-orange-500 text-white">
            Save banner
          </button>
        )}
        <Switch checked={b.is_active} disabled={busy} onChange={(x) => save({ is_active: x }, x ? "Banner is showing" : "Banner hidden")} label="Show on home page" />
      </div>
    </li>
  );
}

export default function BannersPage() {
  const input = useRef<HTMLInputElement>(null);
  const { run, isBusy: busy } = useAction();
  const { data, error, loading, reload } = useAsync(listBanners);
  const list = data ?? [];

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    await run("upload", () => addBanner(file, list), { success: "Banner added", failure: "Upload failed", refreshStore: true, onSuccess: reload });
    if (input.current) input.current.value = "";
  }

  const move = (i: number, d: -1 | 1) => run("move", () => saveOrder("banners", swapped(list, i, d)), { refreshStore: true, onSuccess: reload });

  return (
    <div className="space-y-4">
      <PageTitle title="Banners" hue="banners" icon="gift" />
      <OfferBannerEditor />

      <h2 className="flex items-center gap-2 pt-3 font-display text-[20px] font-bold">
        <span className="h-6 w-1.5 rounded-full bg-orange-500" aria-hidden /> Home page banners (sliding)
      </h2>
      <Card>
        <CardTitle hint="These slide one after another, below the categories. Wide pictures work best (2:1, like 1600 × 800). Make them in Canva with your offer written big.">Add a sliding banner</CardTitle>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 py-6 text-orange-900">
          <Icon name="camera" className="size-8" />
          <span className="text-[15px] font-bold">{busy ? "Uploading…" : "Choose banner picture"}</span>
        </button>
        <p className="hint mt-2">With no banners, the website shows three ready-made ones (delivery time, free delivery, WhatsApp list).</p>
      </Card>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox text={error} retry={reload} />
      ) : list.length === 0 ? (
        <Empty icon="gift" title="No banners yet" text="Festival offers, new stock, combo deals: a banner is the first thing customers see." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((b, i) => (
            <BannerRow key={b.id} b={b} first={i === 0} last={i === list.length - 1} onMove={(d) => move(i, d)} onChanged={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}
