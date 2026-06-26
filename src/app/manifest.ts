import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ajosave — Rotating Savings on Stellar",
    short_name: "Ajosave",
    description: "Trustless Ajo/Esusu savings circles powered by Stellar and USDC.",
    start_url: "/",
    display: "standalone",
    background_color: "#080f0b",
    theme_color: "#0f7a4a",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
    categories: ["finance", "utilities"],
    screenshots: [],
  };
}
