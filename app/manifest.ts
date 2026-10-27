import type { MetadataRoute } from "next";
import { getBrand } from "@/lib/config/brand";

/** Web app manifest: makes Plenary installable (home screen / dock) and launch like an app. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getBrand();
  return {
    id: "/",
    name: `${brand} — paper submission & review`,
    short_name: brand,
    description: "Submit, review and run conferences, workshops and journals.",
    start_url: "/workspace?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#F5F6F3",
    theme_color: "#0E1B3D",
    categories: ["productivity", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "My submissions", short_name: "Submissions", url: "/workspace/submissions?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Find a call for papers", short_name: "Venues", url: "/events?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
