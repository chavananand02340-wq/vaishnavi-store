import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vaishnavi Store",
    short_name: "Vaishnavi",
    description: "Order groceries from Vaishnavi Store for home delivery.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f7",
    theme_color: "#1f6b3d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
