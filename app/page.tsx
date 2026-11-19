"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, Pill, PlusIcon, type Tone } from "@/components/app-shell";
import { createLocalStore } from "@/lib/local-store";
import { AREAS, SEED, STAGES, STORAGE_KEY, buildRecipe, countByStage, editorText, filterRecipes, parseRecipes, reviseRecipe, type Area, type Draft, type PromptRecipe, type Stage } from "@/lib/prompts";

// Saved recipes live in this browser's localStorage; the server render and first paint use the samples.
const store = createLocalStore<PromptRecipe[]>(STORAGE_KEY, SEED, parseRecipes);

/** One tone per stage, used by the sidebar dot and the row pill alike (text + tint, never colour alone). */
const STAGE_TONE: Record<Stage, Tone> = { Draft: "grey", Refine: "amber", Ready: "green", Retired: "red" };

const SOURCE = "https://github.com/bookchaowalit-website/ai-prompt-library-web";
const EMPTY_FORM = { title: "", purpose: "", content: "", area: "Engineering" as Area, stage: "Draft" as Stage };
const UNDO_MS = 6000;

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `recipe-${Date.now()}`;
}

const plural = (n: number) => `${n} ${n === 1 ? "recipe" : "recipes"}`;

export default function Home() {
  const recipes = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "All">("All");
  const [areaFilter, setAreaFilter] = useState<Area | "All">("All");
  const [openId, setOpenId] = useState(SEED[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft>(null);
  const [notice, setNotice] = useState("");
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [removed, setRemoved] = useState<{ recipe: PromptRecipe; index: number } | null>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);

  const visible = useMemo(() => filterRecipes(recipes, stageFilter, areaFilter, query), [areaFilter, query, recipes, stageFilter]);
  const stageCounts = countByStage(recipes);
  const filtered = stageFilter !== "All" || areaFilter !== "All" || query.trim() !== "";

  useEffect(() => {
    if (composing) firstField.current?.focus();
  }, [composing]);

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [removed]);

  function toggle(recipe: PromptRecipe) {
    setOpenId((current) => (current === recipe.id ? "" : recipe.id));
    setDraft(null);
    setNotice("");
  }

  function saveRevision(recipe: PromptRecipe, text: string) {
    store.update((current) => reviseRecipe(current, recipe.id, text, Date.now()));
    setDraft(null);
    setNotice("Revision saved in this browser.");
  }

  async function copyRecipe(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Prompt copied. The next handoff starts with this exact text.");
    } catch {
      setNotice("Copy was blocked by the browser. Select the text and copy it manually.");
    }
  }

  function remove(recipe: PromptRecipe) {
    const index = recipes.findIndex((r) => r.id === recipe.id);
    store.set(recipes.filter((r) => r.id !== recipe.id));
    setRemoved({ recipe, index });
    setOpenId("");
    setDraft(null);
    setNotice("");
  }

  function undo() {
    if (!removed) return;
    store.update((current) => {
      const next = [...current];
      next.splice(Math.min(removed.index, next.length), 0, removed.recipe);
      return next;
    });
    setOpenId(removed.recipe.id);
    setRemoved(null);
  }

  function closeComposer() {
    setComposing(false);
    setForm(EMPTY_FORM);
    newButton.current?.focus();
  }

  function addRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipe = buildRecipe(form, createId(), Date.now());
    if (!recipe) return;
    store.update((current) => [recipe, ...current]);
    setStageFilter("All");
    setAreaFilter("All");
    setQuery("");
    setOpenId(recipe.id);
    setDraft(null);
    setNotice("Recipe added.");
    closeComposer();
  }

  const canAdd = form.title.trim() !== "" && form.content.trim() !== "";
  const heading = stageFilter === "All" ? "All recipes" : `${stageFilter} recipes`;

  return (
    <div className="as" style={removed ? ({ "--as-toast-space": "72px" } as React.CSSProperties) : undefined}>
      <a className="as-skip" href="#recipes">Skip to the recipes</a>
      <AppTop name="Prompt Library" tagline="Reusable prompt recipes" />

      <div className="as-body">
        <nav className="as-side" aria-label="Recipe stages">
          <h2>Stages</h2>
          <ul className="as-lists">
            <ListButton label="All" count={recipes.length} current={stageFilter === "All"} onSelect={() => setStageFilter("All")} />
            {STAGES.map((stage) => (
              <ListButton key={stage} label={stage} count={stageCounts[stage]} tone={STAGE_TONE[stage]} current={stageFilter === stage} onSelect={() => setStageFilter(stage)} />
            ))}
          </ul>
        </nav>

        <main className="as-main" id="recipes" tabIndex={-1}>
          <div className="as-head">
            <div>
              <h1>{heading}</h1>
              <p aria-live="polite">{filtered ? `Showing ${visible.length} of ${plural(recipes.length)}` : plural(recipes.length)} · kept in this browser</p>
            </div>
            <div className="as-tools">
              <label className="as-search">
                <span className="as-sr">Search recipes</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, purpose or text" />
              </label>
              <button ref={newButton} type="button" className="as-button" onClick={() => setComposing(true)} disabled={composing}><PlusIcon />New recipe</button>
            </div>
          </div>

          <div className="as-segmented-wrap pl-areas">
            <span id="area-label">Area</span>
            <div className="as-segmented" role="group" aria-labelledby="area-label">
              {(["All", ...AREAS] as const).map((area) => (
                <button key={area} type="button" aria-pressed={areaFilter === area} onClick={() => setAreaFilter(area)}>{area}</button>
              ))}
            </div>
          </div>

          {composing ? (
            <form className="as-composer" onSubmit={addRecipe} aria-label="New recipe">
              <label className="as-field">Name<input ref={firstField} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Recipe name" required /></label>
              <label className="as-field">Purpose<input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="What is it for?" /></label>
              <label className="as-field">Instruction<textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Write the prompt you want to reuse" rows={5} required /></label>
              <div className="pl-pair">
                <label className="as-field">Area<select value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value as Area }))}>{AREAS.map((area) => <option key={area}>{area}</option>)}</select></label>
                <label className="as-field">Stage<select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as Stage }))}>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
              </div>
              <div className="as-composer-foot">
                <span className="pl-meta">Name and instruction are required.</span>
                <div className="as-composer-actions">
                  <button type="button" className="as-plain" onClick={closeComposer}>Cancel</button>
                  <button type="submit" className="as-button" disabled={!canAdd}>Add</button>
                </div>
              </div>
            </form>
          ) : null}

          {visible.length > 0 ? (
            <ul className="as-list">
              {visible.map((recipe) => {
                const open = recipe.id === openId;
                const text = editorText(recipe, draft);
                return (
                  <li className="as-row pl-row" key={recipe.id} data-open={open ? "true" : undefined}>
                    <h3 className="pl-h">
                      <button type="button" className="pl-row-head" aria-expanded={open} aria-controls={`recipe-${recipe.id}`} onClick={() => toggle(recipe)}>
                        <span className="pl-text">
                          <span className="pl-title">{recipe.title}</span>
                          <span className="pl-sub">{recipe.area} · {recipe.purpose}</span>
                        </span>
                        <Pill tone={STAGE_TONE[recipe.stage]}>{recipe.stage}</Pill>
                      </button>
                    </h3>
                    {open ? (
                      <div className="pl-detail" id={`recipe-${recipe.id}`}>
                        <p className="pl-meta">Edited {new Date(recipe.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <label className="as-field">Instruction (editable)
                          <textarea value={text} onChange={(event) => setDraft({ id: recipe.id, text: event.target.value })} rows={10} />
                        </label>
                        <div className="pl-actions">
                          <button type="button" className="as-button" onClick={() => saveRevision(recipe, text)} disabled={text === recipe.content}>Save revision</button>
                          <button type="button" className="as-plain" onClick={() => copyRecipe(text)}>Copy exact text</button>
                          <button type="button" className="as-plain as-danger" aria-label={`Remove ${recipe.title}`} onClick={() => remove(recipe)}>Remove</button>
                        </div>
                        <p className="pl-status" role="status">{notice}</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="as-list as-empty">
              {recipes.length === 0 ? (
                <><strong>No recipes yet</strong>Use <b>New recipe</b> to save a prompt you want to reuse.</>
              ) : (
                <><strong>No recipe matches</strong>Try another stage, area or search term.
                  <div className="as-actions-row" style={{ justifyContent: "center" }}>
                    <button type="button" className="as-plain" onClick={() => { setStageFilter("All"); setAreaFilter("All"); setQuery(""); }}>Clear filters</button>
                  </div>
                </>
              )}
            </div>
          )}

          <p className="as-note">Recipes are stored in this browser only. There is no model connection here: copy a recipe into the tool where you run it, and choose the model, context and review standard there.</p>
        </main>
      </div>

      <AppFoot source={SOURCE} />

      {removed ? (
        <div className="as-toast" role="status">
          <span>Removed “{removed.recipe.title}”</span>
          <button type="button" className="as-plain" onClick={undo}>Undo</button>
        </div>
      ) : null}
    </div>
  );
}
