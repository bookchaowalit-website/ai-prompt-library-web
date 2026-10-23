import { describe, expect, it } from "vitest";
import { SEED, buildRecipe, countByStage, filterRecipes, parseRecipes, pickSelected, removeRecipe, reviseRecipe, serializeRecipes } from "@/lib/prompts";

describe("filterRecipes", () => {
  it("returns everything with no filters", () => {
    expect(filterRecipes(SEED, "All", "All", "")).toHaveLength(SEED.length);
  });

  it("combines stage, area and a case-insensitive query over the instruction text", () => {
    expect(filterRecipes(SEED, "Ready", "All", "").map((r) => r.id)).toEqual(["review-diff", "plain-language"]);
    expect(filterRecipes(SEED, "All", "Research", "").map((r) => r.id)).toEqual(["research-brief", "decision-memo"]);
    expect(filterRecipes(SEED, "All", "All", "FALSIFIABLE").map((r) => r.id)).toEqual(["research-brief"]);
    expect(filterRecipes(SEED, "Ready", "Research", "")).toEqual([]);
  });
});

describe("countByStage", () => {
  it("counts every stage, including empty ones", () => {
    expect(countByStage(SEED)).toEqual({ Draft: 1, Refine: 1, Ready: 2, Retired: 0 });
  });
});

describe("pickSelected", () => {
  it("keeps the selection, then falls back to the first visible, then the first overall", () => {
    expect(pickSelected(SEED, SEED, "plain-language")?.id).toBe("plain-language");
    expect(pickSelected(SEED, SEED.slice(2), "gone")?.id).toBe("plain-language");
    expect(pickSelected(SEED, [], "gone")?.id).toBe("review-diff");
    expect(pickSelected([], [], "gone")).toBeUndefined();
  });
});

describe("recipe edits", () => {
  it("builds a trimmed recipe with a default purpose, and refuses blank name or text", () => {
    const recipe = buildRecipe({ title: "  T  ", purpose: " ", content: " body ", area: "Writing", stage: "Draft" }, "x", 5);
    expect(recipe).toEqual({ id: "x", title: "T", purpose: "A local recipe waiting for a clearer purpose.", content: "body", area: "Writing", stage: "Draft", updatedAt: 5 });
    expect(buildRecipe({ title: " ", purpose: "", content: "body", area: "Writing", stage: "Draft" }, "y", 5)).toBeNull();
    expect(buildRecipe({ title: "T", purpose: "", content: "  ", area: "Writing", stage: "Draft" }, "z", 5)).toBeNull();
  });

  it("revises only the target recipe and removes by id", () => {
    const revised = reviseRecipe(SEED, "research-brief", "new", 99);
    expect(revised.find((r) => r.id === "research-brief")).toMatchObject({ content: "new", updatedAt: 99 });
    expect(revised.find((r) => r.id === "review-diff")).toBe(SEED[0]);
    expect(removeRecipe(SEED, "review-diff").map((r) => r.id)).not.toContain("review-diff");
  });
});

describe("storage format", () => {
  it("round-trips recipes", () => {
    expect(parseRecipes(serializeRecipes(SEED))).toEqual(SEED);
  });

  it("returns null for missing, corrupt or non-array data so the page keeps its list", () => {
    expect(parseRecipes(null)).toBeNull();
    expect(parseRecipes("{not json")).toBeNull();
    expect(parseRecipes('{"a":1}')).toBeNull();
  });

  it("drops malformed entries instead of crashing the page", () => {
    const raw = JSON.stringify([SEED[0], { id: "bad", title: 3 }, { ...SEED[1], stage: "Shipped" }]);
    expect(parseRecipes(raw)?.map((r) => r.id)).toEqual(["review-diff"]);
  });
});

describe("editorText", () => {
  it("shows the selected recipe's own text unless there is an unsaved draft for that same recipe", async () => {
    const { editorText } = await import("@/lib/prompts");
    const selected = SEED[1];
    expect(editorText(selected, null)).toBe(selected.content);
    expect(editorText(selected, { id: selected.id, text: "draft" })).toBe("draft");
    // A draft typed for another recipe must never be shown (or saved) on the fallback selection.
    expect(editorText(selected, { id: SEED[0].id, text: SEED[0].content })).toBe(selected.content);
    expect(editorText(undefined, { id: "x", text: "draft" })).toBe("");
  });
});
