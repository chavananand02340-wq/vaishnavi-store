/**
 * PIN code → city, district, state and area names (India Post data via api.postalpincode.in).
 * Called by checkout so the customer doesn't have to type city and state.
 */
export const dynamic = "force-dynamic";

type PostOffice = { Name: string; District: string; State: string; Block?: string; Division?: string };

export async function GET(req: Request) {
  const pin = new URL(req.url).searchParams.get("pin") ?? "";
  if (!/^[1-9]\d{5}$/.test(pin)) return Response.json({ ok: false }, { status: 400 });
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: ctl.signal, headers: { "User-Agent": "VaishnaviEMart/1.0" } });
    clearTimeout(t);
    const j = (await r.json()) as { Status: string; PostOffice: PostOffice[] | null }[];
    const offices = j?.[0]?.Status === "Success" ? (j[0].PostOffice ?? []) : [];
    if (!offices.length) return Response.json({ ok: false }, { headers: { "Cache-Control": "public, max-age=86400" } });
    const first = offices[0];
    return Response.json(
      {
        ok: true,
        city: first.District,
        state: first.State,
        areas: [...new Set(offices.map((o) => o.Name))].slice(0, 12),
      },
      { headers: { "Cache-Control": "public, max-age=604800" } },
    );
  } catch {
    return Response.json({ ok: false, reason: "lookup_failed" });
  }
}
