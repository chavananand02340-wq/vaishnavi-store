import { requireOwner } from "@/server/db";
import { route } from "@/server/http";
import { runHealthChecks, testOrderEmail } from "@/server/health";

export const dynamic = "force-dynamic";

/** GET /api/health (owner only): connection checks. ?email=1 sends a test email instead. */
export const GET = route("health", async (req) => {
  const sb = await requireOwner(req);
  if (new URL(req.url).searchParams.get("email") === "1") return Response.json(await testOrderEmail(sb));
  return Response.json(await runHealthChecks(sb));
});
