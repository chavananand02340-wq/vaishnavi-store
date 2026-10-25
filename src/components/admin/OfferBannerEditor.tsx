"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { IMAGE_BUCKET, imageUrl } from "@/lib/catalog";
import { shrinkImage } from "@/lib/image";
import { useAsync } from "@/lib/useAsync";
import { refreshStorefront } from "@/components/admin/team";
import { Card, CardTitle, ErrorBox, Spinner, Switch } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

type Theme = "festive" | "red" | "green" | "night";
type Offer = {
  sale_enabled: boolean;
  sale_title: string | null;
  sale_subtitle: string | null;
  sale_percent: number | null;
  sale_coupon_code: string | null;
  sale_theme: Theme;
  sale_image_path?: string | null;
  sale_link_url?: string | null;
};
type F = { enabled: boolean; title: string; subtitle: string; pct: string; code: string; theme: Theme; image: string | null; link: string };

const THEMES: { key: Theme; label: string; cls: string }[] = [
  { key: "festive", label: "Festive", cls: "bg-[#5a0b2e] text-[#ffcf5a]" },
  { key: "red", label: "Red", cls: "bg-brand-600 text-white" },
  { key: "green", label: "Green", cls: "bg-[#0f7a45] text-white" },
  { key: "night", label: "Dark", cls: "bg-ink text-haldi-400" },
];
const PRESETS = ["Diwali Sale", "Dhanteras Offer", "Holi Sale", "Weekend Sale", "Monthly Ration Sale", "New Year Sale"];

const toForm = (o: Offer): F => ({
  enabled: o.sale_enabled ?? false,
  title: o.sale_title ?? "",
  subtitle: o.sale_subtitle ?? "",
  pct: o.sale_percent ? String(o.sale_percent) : "",
  code: o.sale_coupon_code ?? "",
  theme: o.sale_theme ?? "festive",
  image: o.sale_image_path ?? null,
  link: o.sale_link_url ?? "",
});

/** The one big banner at the top of the home page: picture (or text) + "20% OFF" badge. */
export function OfferBannerEditor() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<F | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useAsync(async () => {
    const sb = supabase();
    const [s, c] = await Promise.all([
      sb.from("store_settings").select("*").eq("id", 1).single(),
      sb.from("coupons").select("code, kind, value, is_active").order("created_at", { ascending: false }),
    ]);
    if (s.error) throw new Error(s.error.message);
    const row = s.data as Offer & Record<string, unknown>;
    return { offer: row, hasPicture: "sale_image_path" in row, coupons: (c.data ?? []) as { code: string; kind: string; value: number; is_active: boolean }[] };
  });
  useEffect(() => {
    if (data) setF(toForm(data.offer));
  }, [data]);

  if (loading && !f) return <Spinner />;
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!f || !data) return <Spinner />;
  const dirty = JSON.stringify(f) !== JSON.stringify(toForm(data.offer));

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file || !f) return;
    setBusy(true);
    try {
      const { blob, ext } = await shrinkImage(file, 1600);
      const path = `banners/offer-${crypto.randomUUID()}.${ext}`;
      const up = await supabase().storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (up.error) throw new Error(up.error.message);
      setF({ ...f, image: path, enabled: true });
      toast("Picture ready. Tap Save banner.");
    } catch (e) {
      toast(e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function save() {
    if (!f || !data) return;
    const pct = f.pct.trim() ? Number(f.pct) : null;
    if (pct != null && (!Number.isInteger(pct) || pct < 1 || pct > 90)) return toast("Percent must be a whole number from 1 to 90", "error");
    if (f.enabled && !f.title.trim()) return toast("Write the offer name, e.g. Diwali Sale", "error");
    const patch: Record<string, unknown> = {
      sale_enabled: f.enabled,
      sale_title: f.title.trim() || null,
      sale_subtitle: f.subtitle.trim() || null,
      sale_percent: pct,
      sale_coupon_code: f.code || null,
      sale_theme: f.theme,
    };
    if (data.hasPicture) {
      patch.sale_image_path = f.image;
      patch.sale_link_url = f.link.trim() || null;
    }
    setBusy(true);
    const { error: e } = await supabase().from("store_settings").update(patch).eq("id", 1);
    setBusy(false);
    if (e) return toast(`Couldn't save: ${e.message}`, "error");
    const old = data.offer.sale_image_path;
    if (old && old !== f.image) void supabase().storage.from(IMAGE_BUCKET).remove([old]);
    toast(f.enabled ? "Offer banner is live" : "Offer banner saved (hidden)");
    void refreshStorefront();
    reload();
  }

  const theme = THEMES.find((t) => t.key === f.theme) ?? THEMES[0];
  const pic = imageUrl(f.image);

  return (
    <Card className="ring-orange-300">
      <CardTitle hint="The big banner at the very top of the home page. Upload your own picture, or use the ready-made text design.">Home offer banner (top)</CardTitle>
      <div className="space-y-4">
        <Switch checked={f.enabled} onChange={(x) => setF({ ...f, enabled: x })} label="Show offer banner" hint="Off = the top shows your normal welcome message." />

        {/* Preview */}
        <div className="relative overflow-hidden rounded-2xl">
          {pic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pic} alt="" className="aspect-[2/1] w-full bg-page object-cover" />
          ) : (
            <div className={`flex aspect-[2/1] flex-col justify-center p-5 ${theme.cls}`}>
              <p className="font-display text-[26px] font-extrabold leading-tight">{f.title || "Diwali Sale"}</p>
              {f.subtitle && <p className="mt-1 text-[13px] opacity-90">{f.subtitle}</p>}
              {f.code && <p className="mt-2 text-[13px] font-bold">Use code {f.code}</p>}
            </div>
          )}
          {f.pct && (
            <span className="absolute right-3 top-3 flex size-[70px] rotate-[8deg] flex-col items-center justify-center rounded-full bg-kumkum-600 text-white shadow-lg ring-4 ring-white/90">
              <span className="font-display text-[24px] font-extrabold leading-none">{f.pct}%</span>
              <span className="text-[12px] font-extrabold leading-none">OFF</span>
            </span>
          )}
          {!f.enabled && <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-bold text-white">Hidden</span>}
        </div>

        {data.hasPicture ? (
          <div className="flex gap-2">
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn flex-1 bg-orange-500 text-white">
              <Icon name="camera" className="size-5" /> {busy ? "Uploading…" : pic ? "Change picture" : "Upload picture"}
            </button>
            {pic && (
              <button type="button" onClick={() => setF({ ...f, image: null })} className="btn-danger px-4" aria-label="Remove picture">
                <Icon name="trash" />
              </button>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">To upload a picture here, run SQL part 22 once in Supabase.</p>
        )}
        <p className="hint -mt-2">Wide picture, 2:1 (like 1600 × 800). Without a picture the text design is shown.</p>

        <div>
          <label className="label" htmlFor="o-title">Offer name</label>
          <input id="o-title" className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={60} placeholder="Diwali Sale" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((t) => (
              <button key={t} type="button" onClick={() => setF({ ...f, title: t })} className={`rounded-full px-3 py-1 text-[13px] font-semibold ring-1 ${f.title === t ? "bg-orange-500 text-white ring-orange-500" : "bg-white ring-line"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="o-pct">% off badge</label>
            <input id="o-pct" className="field" inputMode="numeric" value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="20" />
            <p className="hint">Empty = no badge</p>
          </div>
          <div>
            <label className="label" htmlFor="o-code">Coupon (optional)</label>
            <select
              id="o-code"
              className="field"
              value={f.code}
              onChange={(e) => {
                const c = data.coupons.find((x) => x.code === e.target.value);
                setF({ ...f, code: e.target.value, pct: c && c.kind === "percent" && !f.pct ? String(c.value) : f.pct });
              }}
            >
              <option value="">No coupon</option>
              {data.coupons.map((c) => (
                <option key={c.code} value={c.code}>{c.code}{c.is_active ? "" : " (off)"}</option>
              ))}
            </select>
          </div>
        </div>

        {data.hasPicture && (
          <div>
            <label className="label" htmlFor="o-link">Opens when tapped (optional)</label>
            <input id="o-link" className="field" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} maxLength={300} placeholder="/c/snacks-biscuits" autoCapitalize="none" />
          </div>
        )}

        {!pic && (
          <>
            <div>
              <label className="label" htmlFor="o-sub">Small line (optional)</label>
              <input id="o-sub" className="field" value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} maxLength={120} placeholder="On sweets, dry fruits and pooja items. Till 3 Nov." />
            </div>
            <div>
              <span className="label">Colour</span>
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map((t) => (
                  <button key={t.key} type="button" onClick={() => setF({ ...f, theme: t.key })} className={`rounded-xl px-2 py-3 text-[13px] font-bold ${t.cls} ${f.theme === t.key ? "ring-4 ring-orange-400 ring-offset-2" : ""}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {f.pct && !f.code && (
          <p className="rounded-xl bg-orange-50 px-3 py-2.5 text-[13px] text-orange-900">
            The badge only shows the offer. To actually give the discount, make a coupon in <a href="/admin/coupons" className="font-bold underline">Coupons</a> and pick it here, or put sale prices on the products.
          </p>
        )}

        {dirty && (
          <button type="button" onClick={save} disabled={busy} className="btn w-full bg-orange-500 text-[16px] text-white">
            {busy ? "Saving…" : "Save banner"}
          </button>
        )}
      </div>
    </Card>
  );
}
