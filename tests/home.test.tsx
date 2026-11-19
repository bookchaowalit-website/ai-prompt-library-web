import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the library on the App shell with the sample recipes and the no-model note", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("All recipes");
    expect(html).toContain('class="as-top"');
    expect(html).toContain("Review a diff for behavior, not just style");
    expect(html).toContain("Expose the decision inside a messy memo");
    expect(html).toContain("There is no model connection here");
    expect(html).toContain('href="https://bookchaowalit.com/"');
    // Stage pills follow the stage, not one colour for all.
    expect(html).toMatch(/data-tone="green"[^>]*>Ready/);
    expect(html).toMatch(/data-tone="amber"[^>]*>Refine/);
    expect(html).toMatch(/data-tone="grey"[^>]*>Draft/);
  });
});
