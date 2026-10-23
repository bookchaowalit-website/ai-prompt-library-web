"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { createLocalStore } from "@/lib/local-store";
import { AREAS, SEED, STAGES, STORAGE_KEY, buildRecipe, countByStage, editorText, filterRecipes, parseRecipes, pickSelected, removeRecipe as withoutRecipe, reviseRecipe, type Area, type Draft, type PromptRecipe, type Stage } from "@/lib/prompts";

// Saved recipes live in this browser's localStorage; the server render and first paint use the samples.
const store = createLocalStore<PromptRecipe[]>(STORAGE_KEY, SEED, parseRecipes);

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `recipe-${Date.now()}`;
}

export default function Home() {
  const recipes = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "All">("All");
  const [areaFilter, setAreaFilter] = useState<Area | "All">("All");
  const [selectedId, setSelectedId] = useState(SEED[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft>(null);
  const [notice, setNotice] = useState("");
  const [newRecipe, setNewRecipe] = useState({ title: "", purpose: "", content: "", area: "Engineering" as Area, stage: "Draft" as Stage });

  const visible = useMemo(() => filterRecipes(recipes, stageFilter, areaFilter, query), [areaFilter, query, recipes, stageFilter]);
  const stageCounts = countByStage(recipes);

  const selected = pickSelected(recipes, visible, selectedId);
  const editingText = editorText(selected, draft);

  function selectRecipe(recipe: PromptRecipe) {
    setSelectedId(recipe.id);
    setDraft(null);
    setNotice("");
  }

  function saveRevision() {
    if (!selected) return;
    store.update((current) => reviseRecipe(current, selected.id, editingText, Date.now()));
    setDraft(null);
    setNotice("Revision saved in this browser.");
  }

  async function copyRecipe() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(editingText);
      setNotice("Prompt copied. The next handoff starts with this exact text.");
    } catch {
      setNotice("Copy was blocked by the browser. Select the text and copy it manually.");
    }
  }

  function removeRecipe() {
    if (!selected) return;
    const remaining = withoutRecipe(recipes, selected.id);
    store.set(remaining);
    setSelectedId(remaining[0]?.id ?? "");
    setDraft(null);
    setNotice("Recipe removed from this browser.");
  }

  function addRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipe = buildRecipe(newRecipe, createId(), Date.now());
    if (!recipe) return;
    store.update((current) => [recipe, ...current]);
    setStageFilter("All");
    setAreaFilter("All");
    selectRecipe(recipe);
    setNewRecipe({ title: "", purpose: "", content: "", area: "Engineering", stage: "Draft" });
    setNotice("Recipe added to the workbench.");
  }

  return (
    <main className="prompt-workbench">
      <div className="workbench-frame">
        <header className="workbench-header">
          <div className="workbench-mark"><span className="mark-line" aria-hidden="true" />PROMPT / WORKBENCH</div>
          <p>LOCAL RECIPE SHELF · {recipes.length.toString().padStart(2, "0")} CUES</p>
        </header>

        <section className="workbench-hero" aria-labelledby="page-title">
          <div>
            <h1 id="page-title">Make the next prompt easier to trust.</h1>
            <p>Keep the instruction visible, tune it against real work, and hand it off only when its next use is clear.</p>
          </div>
          <div className="hero-readout"><strong>{visible.length.toString().padStart(2, "0")}</strong><span>RECIPES<br />IN CUT</span></div>
        </section>

        <nav className="cue-rail" aria-label="Prompt lifecycle filter">
          <button type="button" aria-pressed={stageFilter === "All"} onClick={() => setStageFilter("All")}><span>ALL CUES</span><small>{recipes.length}</small></button>
          {STAGES.map((stage) => <button key={stage} type="button" className={`stage-${stage.toLowerCase()}`} aria-pressed={stageFilter === stage} onClick={() => setStageFilter(stage)}><span>{stage.toUpperCase()}</span><small>{stageCounts[stage]}</small></button>)}
        </nav>

        <section className="workbench-body" aria-label="Prompt recipe workbench">
          <aside className="recipe-index">
            <div className="index-tools">
              <label className="search-line"><span>FIND A RECIPE</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, purpose, or text" /></label>
              <div className="area-filters" role="group" aria-label="Filter recipes by area">
                {(["All", ...AREAS] as const).map((area) => <button key={area} type="button" aria-pressed={areaFilter === area} onClick={() => setAreaFilter(area)}>{area}</button>)}
              </div>
            </div>
            <div className="index-heading"><p className="label">RECIPE INDEX</p><span>{visible.length} / {recipes.length}</span></div>
            {visible.length > 0 ? (
              <ul className="recipe-list">
                {visible.map((recipe) => <li key={recipe.id}><button type="button" className={`recipe-row${selected?.id === recipe.id ? " is-selected" : ""}`} onClick={() => selectRecipe(recipe)}><span className="recipe-stage">{recipe.stage}</span><strong>{recipe.title}</strong><span className="recipe-area">{recipe.area}</span></button></li>)}
              </ul>
            ) : <div className="empty-index"><strong>No recipe in this cut.</strong><span>Clear a filter or add a new cue.</span></div>}
            <details className="new-recipe">
              <summary>PLACE A NEW CUE</summary>
              <form onSubmit={addRecipe}>
                <label><span>Name</span><input value={newRecipe.title} onChange={(event) => setNewRecipe((current) => ({ ...current, title: event.target.value }))} placeholder="Recipe name" required /></label>
                <label><span>Purpose</span><input value={newRecipe.purpose} onChange={(event) => setNewRecipe((current) => ({ ...current, purpose: event.target.value }))} placeholder="What is it for?" /></label>
                <label><span>Instruction</span><textarea value={newRecipe.content} onChange={(event) => setNewRecipe((current) => ({ ...current, content: event.target.value }))} placeholder="Write the handoff" rows={5} required /></label>
                <div className="new-recipe-row"><label><span>Area</span><select value={newRecipe.area} onChange={(event) => setNewRecipe((current) => ({ ...current, area: event.target.value as Area }))}>{AREAS.map((area) => <option key={area}>{area}</option>)}</select></label><label><span>Stage</span><select value={newRecipe.stage} onChange={(event) => setNewRecipe((current) => ({ ...current, stage: event.target.value as Stage }))}>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label></div>
                <button className="add-cue" type="submit">Add cue</button>
              </form>
            </details>
          </aside>

          <section className="prompt-bay" aria-label="Selected prompt recipe">
            {selected ? <>
              <div className="prompt-meta"><span>{selected.stage}</span><span>{selected.area}</span><span>EDITED {new Date(selected.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span></div>
              <h2>{selected.title}</h2>
              <p className="prompt-purpose">{selected.purpose}</p>
              <label className="instruction-label"><span>INSTRUCTION · EDITABLE</span><textarea value={editingText} onChange={(event) => selected && setDraft({ id: selected.id, text: event.target.value })} rows={13} /></label>
              <div className="prompt-actions"><button type="button" className="save-cue" onClick={saveRevision}>Save revision</button><button type="button" className="copy-cue" onClick={copyRecipe}>Copy exact text</button><button type="button" className="remove-cue" onClick={removeRecipe}>Remove</button></div>
              <p className="prompt-notice" role="status" aria-live="polite">{notice}</p>
              <div className="handoff-note"><span className="label">HANDOFF</span><p>This library stores the instruction only. Choose the model, context, and review standard in the tool where you run it.</p></div>
            </> : <div className="empty-bay"><strong>The workbench is clear.</strong><span>Place a cue on the left to start.</span></div>}
          </section>
        </section>

        <footer className="workbench-footer"><span>PROMPT / WORKBENCH · PRIVATE BY DEFAULT</span><span>No model connection. No output claims. Just reusable instruction.</span></footer>
      </div>
    </main>
  );
}
