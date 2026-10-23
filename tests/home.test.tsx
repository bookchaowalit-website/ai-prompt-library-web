import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the workbench with the sample recipes and the no-model notice", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Make the next prompt easier to trust.");
    expect(html).toContain("Review a diff for behavior, not just style");
    expect(html).toContain("Expose the decision inside a messy memo");
    expect(html).toContain("No model connection. No output claims.");
  });
});
