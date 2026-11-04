import { sendOrderEmails } from "@/lib/email/send";

/**
 * Sends order emails.
 *  event "placed"  → customer receipt + owner alert (once per order)
 *  event "packing" → customer "we're packing" (once, only after the shop accepts)
 * The browser only sends the order's tracking token; details come from the database,
 * which hands them out a single time and only with NOTIFY_SECRET.
 */
export async function POST(req: Request) {
  let token = "";
  let event: "placed" | "packing" = "placed";
  try {
    const b = (await req.json()) as { token?: unknown; event?: unknown };
    token = String(b.token ?? "");
    if (b.event === "packing") event = "packing";
  } catch {
    /* fall through */
  }
  if (!/^[0-9a-f-]{36}$/i.test(token)) return Response.json({ ok: false }, { status: 400 });
  return Response.json(await sendOrderEmails(token, event, new URL(req.url).origin));
}
