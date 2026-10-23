import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/staff", "/login", "/cart", "/checkout", "/order/", "/search"],
      },
    ],
    sitemap: site ? `${site}/sitemap.xml` : undefined,
  };
}
