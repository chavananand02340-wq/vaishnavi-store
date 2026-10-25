import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vaishnavi E-Mart",
    short_name: "Vaishnavi",
    description: "Order groceries from Vaishnavi Store for home delivery.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f7",
    theme_color: "#e30613",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
