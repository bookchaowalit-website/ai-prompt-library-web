import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";

describe("robots and sitemap", () => {
  it("live on the site's own domain and keep /api/ out of the index", () => {
    expect(SITE_URL).toBe("https://prompt-library.bookchaowalit.com");
    expect(sitemap()).toEqual([{ url: SITE_URL, changeFrequency: "weekly", priority: 1 }]);
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(JSON.stringify(robots().rules)).toContain("/api/");
  });
});
