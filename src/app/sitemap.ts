import { MetadataRoute } from "next";
const SITE_URL = "https://marketing.alolabs.net";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 }];
}
