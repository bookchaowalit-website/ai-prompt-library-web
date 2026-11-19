import type { MetadataRoute } from "next";

/** The site's own canonical origin, used by metadata, robots.txt and sitemap.xml. */
export const SITE_URL = "https://prompt-library.bookchaowalit.com";

export function buildSitemap(base: string = SITE_URL): MetadataRoute.Sitemap {
  return [{ url: base, changeFrequency: "weekly", priority: 1 }];
}

export function buildRobots(base: string = SITE_URL): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${base}/sitemap.xml` };
}
