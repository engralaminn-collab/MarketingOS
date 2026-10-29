import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The application is a single-page workspace behind authentication, so the
 * public surface is the landing route only. The origin comes from the canonical
 * site configuration instead of a per-file hard-coded host.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];
}
