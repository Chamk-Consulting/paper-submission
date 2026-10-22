import type { MetadataRoute } from "next";

/** Web app manifest: makes Plenary installable (home screen / dock) and launch like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Plenary — paper submission & review",
    short_name: "Plenary",
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
      { name: "My papers", short_name: "Papers", url: "/workspace/submissions?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Find a call for papers", short_name: "Venues", url: "/venues?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
