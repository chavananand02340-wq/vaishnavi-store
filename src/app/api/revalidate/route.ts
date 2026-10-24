import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

/**
 * Called by the owner panel after catalogue/settings changes so the cached
 * store pages refresh immediately (otherwise they refresh within 60 s).
 * Only a signed-in owner can trigger it.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return Response.json({ ok: false }, { status: 401 });

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isOwner } = await sb.rpc("is_owner");
  if (isOwner !== true) return Response.json({ ok: false }, { status: 403 });

  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
