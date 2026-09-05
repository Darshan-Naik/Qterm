import type { MetadataRoute } from "next";
import { absUrl, SITEMAP_PATHS } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_PATHS.map((path, index) => ({
    url: absUrl(path),
    lastModified: new Date(),
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : path === "/agent-terminal" ? 0.9 : 0.7,
  }));
}
