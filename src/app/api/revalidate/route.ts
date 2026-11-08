import { revalidatePath } from "next/cache";
import { requireOwner } from "@/server/db";
import { ok, route } from "@/server/http";

/**
 * POST /api/revalidate (owner only). Called by the panel after catalogue or settings
 * changes so the cached store pages refresh now instead of within 15 minutes.
 */
export const POST = route("revalidate", async (req) => {
  await requireOwner(req);
  revalidatePath("/", "layout");
  return ok({});
});
