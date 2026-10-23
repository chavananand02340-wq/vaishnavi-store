import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only run where a session matters; keeps the storefront fast.
  matcher: ["/admin/:path*", "/staff/:path*", "/login"],
};
