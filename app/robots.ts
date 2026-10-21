import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/config/site";

/** robots.txt: public pages are crawlable; private areas and system routes are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/feed/", "/*/workspace", "/*/submissions", "/*/submit", "/*/manage", "/*/reviews", "/*/settings", "/*/inbox", "/*/chair", "/*/admin", "/*/search"],
    }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
