"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
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

// index: where it sat in the stored list when removed. nextShown / prevShown: the recipes shown around it, for focus.
// draft: its unsaved editor text at the time, put back (unsaved) by Undo.
type RemovedEntry = { recipe: PromptRecipe; index: number; nextShown?: string; prevShown?: string; draft?: string };
type RemovedBatch = { items: RemovedEntry[]; viaKeyboard: boolean };
const removedLabel = (items: RemovedEntry[]) => (items.length === 1 ? `Removed “${items[0].recipe.title}”` : `Removed ${plural(items.length)}`);

/** Put removed recipes back where they were, latest removal first so each index matches the list it was taken from. */
function restoreRecipes(current: PromptRecipe[], items: RemovedEntry[]): PromptRecipe[] {
  return items.reduceRight((list, { recipe, index }) => {
    if (list.some((r) => r.id === recipe.id)) return list;
    const next = [...list];
    next.splice(Math.min(index, next.length), 0, recipe);
    return next;
  }, current);
}

export default function Home() {
  const recipes = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "All">("All");
  const [areaFilter, setAreaFilter] = useState<Area | "All">("All");
  const [openId, setOpenId] = useState(SEED[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft>(null);
  // A status line belongs to the recipe it is about, so it never shows under another one (e.g. after Undo).
  const [notice, setNoticeState] = useState<{ id: string; text: string } | null>(null);
  const setNotice = (id: string, text: string) => setNoticeState(text ? { id, text } : null);
  // A revision saved while the recipe drops out of the search: confirmed above the list, since its row has gone.
  const [savedOff, setSavedOff] = useState("");
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // Every removal still inside the Undo window: one Undo puts them all back where they were.
  const [removed, setRemovedState] = useState<RemovedBatch | null>(null);
  // The latest batch, so two removals before a re-render still both land in it.
  const removedRef = useRef<RemovedBatch | null>(null);
  const setRemoved = (batch: RemovedBatch | null) => { removedRef.current = batch; setRemovedState(batch); };
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const firstField = useRef<HTMLInputElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const focusRecipesNext = useRef<string[] | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // A revision just saved: if the edit made the recipe drop out of the current search, focus goes to the search box.
  const savedRecipe = useRef<string | null>(null);
  const wasComposing = useRef(false);
  // Unsaved drafts of recipes not open right now (brought back or set aside by Undo): each returns when its recipe opens.
  const restoredDrafts = useRef(new Map<string, string>());

  const visible = useMemo(() => filterRecipes(recipes, stageFilter, areaFilter, query), [areaFilter, query, recipes, stageFilter]);
  const stageCounts = countByStage(recipes);
  const filtered = stageFilter !== "All" || areaFilter !== "All" || query.trim() !== "";

  // Open the composer on its first field; once it has closed (and New recipe is enabled again), return focus there.
  useEffect(() => {
    if (composing) firstField.current?.focus();
    else if (wasComposing.current) newButton.current?.focus();
    wasComposing.current = composing;
  }, [composing]);

  // A removal made from the keyboard moves focus to Undo (the focused Remove button has just gone).
  useEffect(() => { if (removed?.viaKeyboard) undoRef.current?.focus(); }, [removed]);
  // When the toast closes after Undo or Escape, focus goes back near the removed recipe once the list has re-rendered:
  // the first of these recipes still shown, else New recipe.
  useEffect(() => {
    const ids = focusRecipesNext.current;
    if (removed || !ids) return;
    focusRecipesNext.current = null;
    const shown = [...document.querySelectorAll<HTMLElement>(".pl-row[data-recipe]")];
    const row = ids.map((id) => shown.find((entry) => entry.dataset.recipe === id)).find(Boolean);
    (row?.querySelector<HTMLButtonElement>(".pl-row-head") ?? newButton.current)?.focus();
  }, [removed, recipes]);
  // While the toast shows, reserve its height (plus its 24px offset and a gap) at the bottom of the page and in the
  // document's scroll-padding, so the last recipes and anything focused behind it can scroll clear of it.
  const toastShown = removed !== null;
  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toastShown || !toast) return;
    const rootStyle = document.documentElement.style;
    const reserve = () => rootStyle.setProperty("--as-toast-space", `${toast.offsetHeight + 32}px`);
    reserve();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(reserve) : null;
    observer?.observe(toast);
    return () => { observer?.disconnect(); rootStyle.removeProperty("--as-toast-space"); };
  }, [toastShown]);
  // The Undo toast closes 6 s after the latest removal (each removal restarts it), but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => { removedRef.current = null; setRemovedState(null); }, UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);

  function toggle(recipe: PromptRecipe) {
    setOpenId((current) => (current === recipe.id ? "" : recipe.id));
    // Collapsing (or reopening) a recipe keeps its unsaved draft; opening another recipe drops it, unless Undo
    // brought a draft back for the recipe being opened.
    const waiting = restoredDrafts.current.get(recipe.id);
    restoredDrafts.current.delete(recipe.id);
    setDraft((current) => (current?.id === recipe.id ? current : waiting === undefined ? null : { id: recipe.id, text: waiting }));
    setNoticeState(null);
    setSavedOff("");
  }

  function saveRevision(recipe: PromptRecipe, text: string) {
    store.update((current) => reviseRecipe(current, recipe.id, text, Date.now()));
    setDraft(null);
    setNotice(recipe.id, "Revision saved in this browser.");
    const stillShown = filterRecipes(store.getSnapshot(), stageFilter, areaFilter, query).some((r) => r.id === recipe.id);
    setSavedOff(stillShown ? "" : `Revision of “${recipe.title}” saved in this browser. It is hidden by the current search or filters.`);
    // The row's own status leaves with the row when the new text no longer matches the search: the page-level
    // live region says it too.
    setAnnouncement(`Revision of “${recipe.title}” saved in this browser.`);
    savedRecipe.current = recipe.id;
  }
  useEffect(() => {
    const id = savedRecipe.current;
    if (!id) return;
    savedRecipe.current = null;
    if (!visible.some((r) => r.id === id)) {
      searchRef.current?.focus();
      return;
    }
    // Still shown: Save revision is disabled now (no changes left), so focus held on it (or already dropped to the
    // page) moves to Copy exact text in the same row.
    const active = document.activeElement;
    const row = document.querySelector<HTMLElement>(`.pl-row[data-recipe="${CSS.escape(id)}"]`);
    if (!row || !(active === document.body || (active instanceof HTMLButtonElement && active.disabled && row.contains(active)))) return;
    row.querySelector<HTMLButtonElement>(".pl-copy")?.focus();
  }, [visible]);

  async function copyRecipe(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(id, "Prompt copied. The next handoff starts with this exact text.");
    } catch {
      setNotice(id, "Copy was blocked by the browser. Select the text and copy it manually.");
    }
  }

  function remove(recipe: PromptRecipe, viaKeyboard: boolean) {
    const current = store.getSnapshot();
    const index = current.findIndex((r) => r.id === recipe.id);
    if (index < 0) return;
    store.set(current.filter((r) => r.id !== recipe.id));
    const shownAt = visible.findIndex((r) => r.id === recipe.id);
    const unsaved = draft?.id === recipe.id && draft.text !== current[index].content ? draft.text : restoredDrafts.current.get(recipe.id);
    restoredDrafts.current.delete(recipe.id);
    const entry: RemovedEntry = { recipe: current[index], index, nextShown: visible[shownAt + 1]?.id, prevShown: shownAt > 0 ? visible[shownAt - 1].id : undefined, draft: unsaved };
    const items = [...(removedRef.current?.items ?? []), entry];
    setRemoved({ items, viaKeyboard });
    setAnnouncement(`${removedLabel(items)}. Undo is available for a few seconds.`);
    setOpenId("");
    setDraft(null);
    setNoticeState(null);
    setSavedOff("");
  }

  function closeToast(focusIds?: string[]) {
    const last = removedRef.current?.items.at(-1);
    // Dismissed: the recipe after the removed one, else the one before it.
    focusRecipesNext.current = focusIds ?? [last?.nextShown, last?.prevShown].filter((id): id is string => Boolean(id));
    setRemoved(null);
    setToastFocused(false);
  }

  function undo() {
    const items = removedRef.current?.items;
    if (!items?.length) return;
    store.update((current) => restoreRecipes(current, items));
    const latest = items[items.length - 1].recipe;
    setAnnouncement(items.length === 1 ? `Restored “${latest.title}”.` : `Restored ${plural(items.length)}.`);
    // Undone: back to the restored recipe the user removed last, opened, unless another recipe is open with
    // unsaved edits: that editor (and its draft) stays, and only the restored row takes focus.
    const editingOther = draft !== null && draft.id === openId && draft.id !== latest.id && recipes.some((r) => r.id === draft.id && r.content !== draft.text);
    // Every restored recipe gets its unsaved edit back, still unsaved: the one that opens now in the editor,
    // the others when they are opened.
    for (const item of items) if (item.draft !== undefined) restoredDrafts.current.set(item.recipe.id, item.draft);
    if (!editingOther) {
      // A collapsed recipe can still hold an unsaved draft: park it so it returns when that recipe opens.
      if (draft && draft.id !== latest.id && recipes.some((r) => r.id === draft.id && r.content !== draft.text)) restoredDrafts.current.set(draft.id, draft.text);
      setOpenId(latest.id);
      const lastDraft = restoredDrafts.current.get(latest.id);
      restoredDrafts.current.delete(latest.id);
      setDraft(lastDraft === undefined ? null : { id: latest.id, text: lastDraft });
    }
    closeToast([latest.id]);
  }

  function closeComposer() {
    setComposing(false);
    setForm(EMPTY_FORM);
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
    setNotice(recipe.id, "Recipe added.");
    setSavedOff("");
    closeComposer();
  }

  const canAdd = form.title.trim() !== "" && form.content.trim() !== "";
  const heading = stageFilter === "All" ? "All recipes" : `${stageFilter} recipes`;

  return (
    <div className="as">
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
                <input ref={searchRef} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSavedOff(""); }} placeholder="Search name, purpose or text" />
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

          {savedOff ? <p className="pl-saved">{savedOff}</p> : null}

          {visible.length > 0 ? (
            <ul className="as-list">
              {visible.map((recipe) => {
                const open = recipe.id === openId;
                const text = editorText(recipe, draft);
                return (
                  <li className="as-row pl-row" key={recipe.id} data-recipe={recipe.id} data-open={open ? "true" : undefined}>
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
                          <button type="button" className="as-plain pl-copy" onClick={() => copyRecipe(recipe.id, text)}>Copy exact text</button>
                          <button type="button" className="as-plain as-danger" aria-label={`Remove ${recipe.title}`} onClick={(event) => remove(recipe, event.detail === 0)}>Remove</button>
                        </div>
                        <p className="pl-status" role="status">{notice?.id === recipe.id ? notice.text : ""}</p>
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
                    <button type="button" className="as-plain" onClick={() => { setStageFilter("All"); setAreaFilter("All"); setQuery(""); setSavedOff(""); searchRef.current?.focus(); }}>Clear filters</button>
                  </div>
                </>
              )}
            </div>
          )}

          <p className="as-note">Recipes are stored in this browser only. There is no model connection here: copy a recipe into the tool where you run it, and choose the model, context and review standard there.</p>
        </main>
      </div>

      <AppFoot source={SOURCE} />

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {removed ? (
        <div
          ref={toastRef}
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{removedLabel(removed.items)}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo} aria-label={removed.items.length === 1 ? "Undo remove" : `Undo remove of ${plural(removed.items.length)}`}>Undo</button>
        </div>
      ) : null}
    </div>
  );
}
