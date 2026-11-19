// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { STORAGE_KEY } from "@/lib/prompts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
const button = (text: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const titles = () => [...host.querySelectorAll(".pl-title")].map((t) => t.textContent);
// detail 0 = keyboard (Enter/Space) click, 1 = pointer click.
const press = (el: Element, detail = 1) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
const escape = () => act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
function type(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("filters", () => {
  it("filters by stage, area and search, and offers Clear filters when nothing matches", () => {
    expect(titles()).toHaveLength(4);
    press(button("Ready", $(".as-side")!));
    expect($("h1")!.textContent).toBe("Ready recipes");
    expect(titles()).toHaveLength(2);
    press(button("Writing", $(".as-segmented")!));
    expect(titles()).toEqual(["Rewrite a technical note for a human reader"]);
    type($<HTMLInputElement>("input[type=search]")!, "nothing like this");
    expect(host.textContent).toContain("No recipe matches");
    press(button("Clear filters"));
    expect(titles()).toHaveLength(4);
    expect(host.textContent).toContain("4 recipes");
  });
});

describe("composer", () => {
  it("opens focused, needs a name and instruction, adds on top and opens the new recipe", () => {
    press(button("New recipe"));
    expect(document.activeElement).toBe($(".as-composer input"));
    expect(button("Add", $(".as-composer")!).disabled).toBe(true);
    const [name, purpose] = host.querySelectorAll<HTMLInputElement>(".as-composer input");
    type(name, "Summarise a meeting");
    type(purpose, "Turn notes into actions");
    type($<HTMLTextAreaElement>(".as-composer textarea")!, "List decisions and owners.");
    const [area, stage] = host.querySelectorAll<HTMLSelectElement>(".as-composer select");
    type(area, "Writing");
    type(stage, "Ready");
    act(() => { $("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(titles()[0]).toBe("Summarise a meeting");
    expect($(".pl-row-head")!.getAttribute("aria-expanded")).toBe("true");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0]).toMatchObject({ title: "Summarise a meeting", area: "Writing", stage: "Ready" });
    press(button("New recipe"));
    press(button("Cancel"));
    expect($(".as-composer")).toBeNull();
    expect(document.activeElement?.textContent).toContain("New recipe");
  });
});

describe("recipe detail", () => {
  it("edits, saves, copies, removes with undo and collapses", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const editor = $<HTMLTextAreaElement>(".pl-detail textarea")!;
    expect(button("Save revision").disabled).toBe(true);
    type(editor, "Shorter review prompt");
    press(button("Save revision"));
    expect(host.textContent).toContain("Revision saved in this browser.");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].content).toBe("Shorter review prompt");
    await act(async () => { button("Copy exact text").click(); });
    expect(writeText).toHaveBeenCalledWith("Shorter review prompt");
    expect(host.textContent).toContain("Prompt copied.");
    writeText.mockRejectedValueOnce(new Error("blocked"));
    await act(async () => { button("Copy exact text").click(); });
    expect(host.textContent).toContain("Copy was blocked");

    vi.useFakeTimers();
    press($("[aria-label^='Remove Review a diff']")!);
    expect(titles()).toHaveLength(3);
    expect($(".as-toast")!.textContent).toContain("Removed");
    press(button("Undo", $(".as-toast")!));
    expect(titles()[0]).toBe("Review a diff for behavior, not just style");
    press($("[aria-label^='Remove Review a diff']")!);
    act(() => { vi.advanceTimersByTime(7000); });
    expect($(".as-toast")).toBeNull();

    press($(".pl-row-head")!);
    expect($(".pl-detail")).not.toBeNull();
    press($(".pl-row-head")!);
    expect($(".pl-detail")).toBeNull();
  });

  it("consecutive removes restore together with one Undo", () => {
    vi.useFakeTimers();
    const before = titles();
    expect(before).toHaveLength(4);
    press($("[aria-label^='Remove Review a diff']")!);
    act(() => { vi.advanceTimersByTime(4000); });
    press(host.querySelectorAll(".pl-row-head")[1]);
    press($(`[aria-label='Remove ${before[2]}']`)!);
    expect(titles()).toEqual([before[1], before[3]]);
    expect($(".as-toast span")!.textContent).toBe("Removed 2 recipes");
    expect(button("Undo", $(".as-toast")!).getAttribute("aria-label")).toBe("Undo remove of 2 recipes");
    // The second removal restarted the 6 s window: 4 s later it is still open.
    act(() => { vi.advanceTimersByTime(4000); });
    press(button("Undo", $(".as-toast")!));
    expect(titles()).toEqual(before);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(4);
    expect($(".as-sr[role=status]")!.textContent).toBe("Restored 2 recipes.");
    expect($(".as-toast")).toBeNull();
  });

  it("keyboard remove focuses Undo; Undo focuses the restored recipe, Escape the next one", () => {
    const before = titles();
    press($(`[aria-label='Remove ${before[0]}']`)!, 0);
    expect(document.activeElement).toBe(button("Undo", $(".as-toast")!));
    expect(document.documentElement.style.getPropertyValue("--as-toast-space")).toMatch(/px$/);
    press(button("Undo", $(".as-toast")!), 0);
    expect(titles()).toEqual(before);
    expect(document.activeElement).toBe(host.querySelectorAll(".pl-row-head")[0]);
    expect(document.activeElement!.getAttribute("aria-expanded")).toBe("true");
    expect(document.documentElement.style.getPropertyValue("--as-toast-space")).toBe("");
    press($(`[aria-label='Remove ${before[0]}']`)!, 0);
    escape();
    expect($(".as-toast")).toBeNull();
    expect(document.activeElement!.textContent).toContain(before[1]);
    // The last recipe has no next one: Escape lands on the one before it.
    press(host.querySelectorAll(".pl-row-head")[2]);
    press($(`[aria-label='Remove ${before[3]}']`)!, 0);
    escape();
    expect(document.activeElement!.textContent).toContain(before[2]);
  });

  it("keeps a focused toast open until focus leaves it", () => {
    vi.useFakeTimers();
    press($("[aria-label^='Remove Review a diff']")!, 0);
    act(() => { vi.advanceTimersByTime(7000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { button("New recipe").focus(); });
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
  });

  it("says when the library is empty, and Escape then lands on New recipe", () => {
    for (let i = 0; i < 4; i++) {
      if (!$(".pl-detail")) press($(".pl-row-head")!);
      press($("[aria-label^='Remove']")!, 0);
    }
    expect(host.textContent).toContain("No recipes yet");
    expect($(".as-toast span")!.textContent).toBe("Removed 4 recipes");
    escape();
    expect(document.activeElement?.textContent).toContain("New recipe");
  });
});

describe("review 2026-11-19 (late)", () => {
  it("Undo of a removal keeps another recipe's open editor and its unsaved draft", () => {
    press($("[aria-label^='Remove Review a diff']")!);
    // Open another recipe and start editing it before Undo.
    const head = [...host.querySelectorAll<HTMLButtonElement>(".pl-row-head")].find((b) => b.textContent?.includes("research brief"))!;
    press(head);
    type($<HTMLTextAreaElement>(".pl-detail textarea")!, "Unsaved draft text");
    press(button("Undo", $(".as-toast")!));
    expect(titles()).toHaveLength(4);
    const editor = $<HTMLTextAreaElement>(".pl-detail textarea")!;
    expect(editor.value).toBe("Unsaved draft text");
    expect(editor.closest("li")!.textContent).toContain("research brief");
  });

  it("a saved revision that drops out of the search is still confirmed, and focus goes to the search box", () => {
    const search = $<HTMLInputElement>('input[type="search"]')!;
    type(search, "senior engineer");
    expect(titles()).toEqual(["Review a diff for behavior, not just style"]);
    press($(".pl-row-head")!);
    if (!$(".pl-detail")) press($(".pl-row-head")!);
    type($<HTMLTextAreaElement>(".pl-detail textarea")!, "Review this change for regressions.");
    press(button("Save revision"));
    expect(titles()).toEqual([]);
    expect($('p.as-sr[role="status"]')!.textContent).toBe("Revision of “Review a diff for behavior, not just style” saved in this browser.");
    expect(document.activeElement).toBe(search);
    // Visible too, outside the row that left: not only the screen-reader live region.
    expect($(".pl-saved")!.textContent).toContain("Revision of “Review a diff for behavior, not just style” saved");
    type(search, "");
    expect($(".pl-saved")).toBeNull();
  });

  it("keeps an unsaved draft when its recipe is collapsed and opened again, and drops it when another opens", () => {
    const head = () => $<HTMLButtonElement>(".pl-row-head")!;
    type($<HTMLTextAreaElement>(".pl-detail textarea")!, "Half-written edit");
    press(head());
    expect($(".pl-detail")).toBeNull();
    press(head());
    expect($<HTMLTextAreaElement>(".pl-detail textarea")!.value).toBe("Half-written edit");
    const other = [...host.querySelectorAll<HTMLButtonElement>(".pl-row-head")].find((b) => b.textContent?.includes("research brief"))!;
    press(other);
    press(head());
    expect($<HTMLTextAreaElement>(".pl-detail textarea")!.value).not.toBe("Half-written edit");
  });

  it("shows Prompt copied only under the recipe that was copied", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    press($("[aria-label^='Remove Review a diff']")!);
    const other = [...host.querySelectorAll<HTMLButtonElement>(".pl-row-head")].find((b) => b.textContent?.includes("research brief"))!;
    press(other);
    await act(async () => { button("Copy exact text").click(); });
    expect($(".pl-detail")!.textContent).toContain("Prompt copied.");
    // Undo opens the restored recipe; B's copy message must not appear under it.
    press(button("Undo", $(".as-toast")!));
    const open = $(".pl-detail")!;
    expect(open.closest("li")!.textContent).toContain("Review a diff");
    expect(open.textContent).not.toContain("Prompt copied.");
  });

  it("Undo of a removal brings back the removed recipe's unsaved draft, unsaved", () => {
    type($<HTMLTextAreaElement>(".pl-detail textarea")!, "Typed but not saved");
    press($("[aria-label^='Remove Review a diff']")!);
    press(button("Undo", $(".as-toast")!));
    const editor = $<HTMLTextAreaElement>(".pl-detail textarea")!;
    expect(editor.closest("li")!.textContent).toContain("Review a diff");
    expect(editor.value).toBe("Typed but not saved");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].content).not.toBe("Typed but not saved");
    expect(button("Save revision").disabled).toBe(false);
  });
});
