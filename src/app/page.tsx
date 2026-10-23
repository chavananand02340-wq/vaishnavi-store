import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

type PublicSettings = {
  store_name: string;
  tagline: string | null;
  address: string | null;
  phone_primary: string | null;
  whatsapp_number: string | null;
  open_time: string;
  close_time: string;
  announcement: string | null;
};

async function loadSettings(): Promise<PublicSettings | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_settings")
    .select("store_name, tagline, address, phone_primary, whatsapp_number, open_time, close_time, announcement")
    .eq("id", 1)
    .maybeSingle();
  return data as PublicSettings | null;
}

function hhmm(t: string) {
  const [h, m] = t.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

// Temporary landing page until the storefront (Phase 3) is built.
export default async function Home() {
  const s = await loadSettings();
  const name = s?.store_name ?? "Vaishnavi Store";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="card text-center">
        <p className="text-sm font-medium text-brand-600">Online ordering coming soon</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">{name}</h1>
        {s?.tagline && <p className="mt-1 text-neutral-600">{s.tagline}</p>}
        {s?.announcement && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{s.announcement}</p>}
        {s && (
          <p className="mt-4 text-sm text-neutral-600">
            Open {hhmm(s.open_time)} – {hhmm(s.close_time)}
          </p>
        )}
        {s?.address && <p className="mt-1 text-sm text-neutral-600">{s.address}</p>}
        <div className="mt-6 flex flex-col gap-2">
          {s?.whatsapp_number && (
            <a className="btn-primary" href={`https://wa.me/91${s.whatsapp_number}`} rel="noopener">
              Order on WhatsApp
            </a>
          )}
          {s?.phone_primary && (
            <a className="btn-ghost" href={`tel:+91${s.phone_primary}`}>
              Call {s.phone_primary}
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
