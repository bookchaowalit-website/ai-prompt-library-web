// Prompt recipes: the sample seed, filter rules, and the browser-storage format used by the page and the MCP route.

export type Stage = "Draft" | "Refine" | "Ready" | "Retired";
export type Area = "Engineering" | "Research" | "Writing";

export type PromptRecipe = {
  id: string;
  title: string;
  area: Area;
  stage: Stage;
  purpose: string;
  content: string;
  updatedAt: number;
};

export const STAGES: Stage[] = ["Draft", "Refine", "Ready", "Retired"];
export const AREAS: Area[] = ["Engineering", "Research", "Writing"];
export const STORAGE_KEY = "prompt-workbench-v2";

export const SEED: PromptRecipe[] = [
  {
    id: "review-diff",
    title: "Review a diff for behavior, not just style",
    area: "Engineering",
    stage: "Ready",
    purpose: "A second pair of eyes for regressions and unclear assumptions.",
    content: "Review the following code change as a senior engineer. Identify behavior regressions, missing edge cases, unsafe assumptions, and tests that should be added. Prioritize findings by impact. If the change is sound, say what evidence supports that conclusion.\n\nDIFF:\n{{paste diff here}}",
    updatedAt: Date.parse("2026-08-20"),
  },
  {
    id: "research-brief",
    title: "Turn a question into a research brief",
    area: "Research",
    stage: "Refine",
    purpose: "Shape an open question before collecting sources or opinions.",
    content: "Help me turn this loose question into a research brief. State the decision it could inform, define what we know and do not know, list three falsifiable sub-questions, and propose evidence that would change the decision. Do not answer the question yet.\n\nQUESTION:\n{{question}}",
    updatedAt: Date.parse("2026-08-17"),
  },
  {
    id: "plain-language",
    title: "Rewrite a technical note for a human reader",
    area: "Writing",
    stage: "Ready",
    purpose: "Keep the technical truth while removing unnecessary ceremony.",
    content: "Rewrite the note below for a capable reader who does not share the author's context. Keep the claim, constraints, and uncertainty intact. Prefer concrete verbs, short paragraphs, and examples where they remove ambiguity. Return only the revised note, followed by a short list of meaningful changes.\n\nNOTE:\n{{paste note here}}",
    updatedAt: Date.parse("2026-08-12"),
  },
  {
    id: "decision-memo",
    title: "Expose the decision inside a messy memo",
    area: "Research",
    stage: "Draft",
    purpose: "Separate evidence, interpretation, and the next reversible move.",
    content: "Read the memo below and return four sections: decision being made, evidence directly observed, interpretation or assumption, and the smallest reversible next move. Flag any sentence that claims more certainty than the evidence allows.\n\nMEMO:\n{{paste memo here}}",
    updatedAt: Date.parse("2026-08-08"),
  },
];

/** Recipes matching the stage and area ("All" for any) whose title, purpose, text or area contains `query`, ignoring case. */
export function filterRecipes(recipes: PromptRecipe[], stage: Stage | "All", area: Area | "All", query: string): PromptRecipe[] {
  const needle = query.trim().toLowerCase();
  return recipes.filter(
    (recipe) =>
      (stage === "All" || recipe.stage === stage) &&
      (area === "All" || recipe.area === area) &&
      (!needle || `${recipe.title} ${recipe.purpose} ${recipe.content} ${recipe.area}`.toLowerCase().includes(needle)),
  );
}

/** Count of recipes per stage, for the lifecycle rail. */
export function countByStage(recipes: PromptRecipe[]): Record<Stage, number> {
  const counts = { Draft: 0, Refine: 0, Ready: 0, Retired: 0 };
  for (const recipe of recipes) counts[recipe.stage] += 1;
  return counts;
}

/** The selected recipe, else the first visible one, else the first overall. */
export function pickSelected(recipes: PromptRecipe[], visible: PromptRecipe[], selectedId: string): PromptRecipe | undefined {
  return recipes.find((recipe) => recipe.id === selectedId) ?? visible[0] ?? recipes[0];
}

export type NewRecipeInput = { title: string; purpose: string; content: string; area: Area; stage: Stage };

/** Builds a recipe from the form, or null when the name or instruction is blank. */
export function buildRecipe(input: NewRecipeInput, id: string, now: number): PromptRecipe | null {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) return null;
  return { id, title, purpose: input.purpose.trim() || "A local recipe waiting for a clearer purpose.", content, area: input.area, stage: input.stage, updatedAt: now };
}

export function reviseRecipe(recipes: PromptRecipe[], id: string, content: string, now: number): PromptRecipe[] {
  return recipes.map((recipe) => (recipe.id === id ? { ...recipe, content, updatedAt: now } : recipe));
}

export function removeRecipe(recipes: PromptRecipe[], id: string): PromptRecipe[] {
  return recipes.filter((recipe) => recipe.id !== id);
}

function isRecipe(value: unknown): value is PromptRecipe {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.title === "string" &&
    typeof r.purpose === "string" &&
    typeof r.content === "string" &&
    typeof r.updatedAt === "number" &&
    AREAS.includes(r.area as Area) &&
    STAGES.includes(r.stage as Stage)
  );
}

/** Parses stored recipes; anything unreadable or malformed yields null so the caller keeps its current list. */
export function parseRecipes(raw: string | null): PromptRecipe[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    return value.filter(isRecipe);
  } catch {
    return null;
  }
}

export function serializeRecipes(recipes: PromptRecipe[]): string {
  return JSON.stringify(recipes);
}

export type Draft = { id: string; text: string } | null;

/** The editor text: an unsaved draft only when it belongs to the selected recipe, else that recipe's saved text. */
export function editorText(selected: PromptRecipe | undefined, draft: Draft): string {
  if (!selected) return "";
  return draft && draft.id === selected.id ? draft.text : selected.content;
}
