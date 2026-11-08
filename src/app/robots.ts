import type { MetadataRoute } from "next";
import { publicEnv } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  const site = publicEnv.siteUrl;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/staff", "/login", "/cart", "/checkout", "/order", "/search"],
      },
    ],
    sitemap: site ? `${site}/sitemap.xml` : undefined,
  };
}
