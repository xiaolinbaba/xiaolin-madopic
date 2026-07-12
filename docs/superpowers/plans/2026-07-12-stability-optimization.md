# Madopic Stability Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the five confirmed stability issues and dependency-policy gaps without changing Madopic's UI, DOM contracts, exports, or public API.

**Architecture:** Keep the static site and single production script. Add Node `vm`-based regression tests that execute the real `script.js` in a minimal browser stub, then make narrowly scoped changes inside the existing functions. Add IndexedDB persistence behind the current in-memory image map with a graceful memory-only fallback.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, IndexedDB, Node.js built-in test utilities (`assert`, `vm`, `fs`).

## Global Constraints

- Do not change visual CSS, DOM structure, labels, element IDs, export filenames, storage keys, mode names, or `window.MadopicApp` names.
- Do not introduce a build system, package manager dependency, Python environment, or third-party test library.
- Existing plain-text drafts and full data-URL images must remain readable.
- XHS remains 3:4; PYQ remains 1290:2796.
- Every behavior fix starts with a failing regression test.

---

### Task 1: Regression harness and safe math preprocessing

**Files:**
- Create: `tests/script-regression.test.mjs`
- Modify: `script.js:363-402`

**Interfaces:**
- Consumes: existing global `mathRenderer.preprocessMath(markdown)`.
- Produces: `protectMarkdownSegments(markdown)` returning `{ text, restore }`, used only by `preprocessMath`.

- [ ] **Step 1: Write failing tests**

Create a Node `vm` harness that evaluates `script.js` with inert `window`, `document`, `localStorage`, and DOM element stubs. Assert:

```js
assert.equal(run('mathRenderer.preprocessMath("$F = ma$")'), '$F = ma$');
assert.equal(
  run('mathRenderer.preprocessMath("```js\\nconst π = 3;\\n```")'),
  '```js\\nconst π = 3;\\n```',
);
assert.equal(run('mathRenderer.preprocessMath("公式 F = ma")'), '公式 $F=ma$');
```

- [ ] **Step 2: Verify RED**

Run: `node tests/script-regression.test.mjs`

Expected: FAIL because existing math preprocessing rewrites existing math and fenced code.

- [ ] **Step 3: Implement protected preprocessing**

Add a helper that tokenizes, in this order, fenced code, inline code, Markdown links/images, block math, and inline math. Apply existing shortcut replacements only to the remaining text and restore exact protected strings afterward.

- [ ] **Step 4: Verify GREEN**

Run: `node tests/script-regression.test.mjs && node tests/static-site.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add script.js tests/script-regression.test.mjs
git commit -m "fix: preserve markdown during math preprocessing"
```

### Task 2: Unified programmatic editor history

**Files:**
- Modify: `tests/script-regression.test.mjs`
- Modify: `script.js:1048-1129, 2311-2764, 2860-2891`

**Interfaces:**
- Produces: `applyEditorChange(nextValue, selectionStart, selectionEnd = selectionStart, options = {})`.
- Preserves: `UndoRedoManager.undo()`, `redo()`, keyboard shortcuts, and native debounced input history.

- [ ] **Step 1: Write failing tests**

Assert that calling the desired helper after seeding history records the resulting state, and that undo after clearing restores the immediate prior value:

```js
run('undoRedoManager.push("before"); markdownInput.value = "before"');
run('applyEditorChange("", 0, 0)');
assert.equal(run('undoRedoManager.undo()'), 'before');
```

Add source assertions that clear, toolbar insertion, template insertion, and image insertion call `applyEditorChange` rather than assigning `textarea.value` directly.

- [ ] **Step 2: Verify RED**

Run: `node tests/script-regression.test.mjs`

Expected: FAIL because `applyEditorChange` does not exist.

- [ ] **Step 3: Implement the shared mutation path**

The helper must apply the value and selection, push the resulting state when distinct, update line numbers, call `updatePreview`, and preserve focus by default. Replace direct assignments in `handleToolbarAction`, `MarkdownHelper.insertAtCursor`, `insertImageIntoMarkdown`, and clear handling. Keep undo/redo assignments internal so they do not create new history entries.

- [ ] **Step 4: Verify GREEN**

Run: `node tests/script-regression.test.mjs && node tests/static-site.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add script.js tests/script-regression.test.mjs
git commit -m "fix: unify editor history updates"
```

### Task 3: Durable local-image drafts

**Files:**
- Modify: `tests/script-regression.test.mjs`
- Modify: `script.js:815-857, 2666-2764, 2985-3080`

**Interfaces:**
- Produces: `ImagePersistence.open()`, `loadAll()`, and `save(id, dataUrl)` returning promises.
- Produces: Markdown references shaped as `madopic-image://<uuid-or-random-id>`.
- Consumes: existing `imageDataStore` and `replaceImageDataForPreview(content)`.

- [ ] **Step 1: Write failing tests**

Assert stable image references and replacement behavior:

```js
run('imageDataStore.set("madopic-image://abc", "data:image/png;base64,AAAA")');
assert.equal(
  run('replaceImageDataForPreview("![x](madopic-image://abc)")'),
  '![x](data:image/png;base64,AAAA)',
);
```

Assert the startup source awaits image restoration before `restoreDraft()` and that persistence failure retains the in-memory mapping.

- [ ] **Step 2: Verify RED**

Run: `node tests/script-regression.test.mjs`

Expected: FAIL because stable references and `ImagePersistence` are absent.

- [ ] **Step 3: Implement IndexedDB persistence**

Create database `madopic`, version `1`, object store `images` with key path `id`. `storeImageData(reference, fullBase64)` must update the map immediately and asynchronously persist `{ id: reference, dataUrl: fullBase64 }`. Make `initOptimizations` async and load all valid records before restoring the draft. On failure, log a warning and show one memory-only notification after image insertion.

- [ ] **Step 4: Verify GREEN**

Run: `node tests/script-regression.test.mjs && node tests/static-site.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add script.js tests/script-regression.test.mjs
git commit -m "fix: persist local images across drafts"
```

### Task 4: Fixed-ratio synchronization

**Files:**
- Modify: `tests/script-regression.test.mjs`
- Modify: `script.js:981-1035, 1394-1475, 2985-3046`

**Interfaces:**
- Consumes: existing `applyPreviewModeFrame()`.
- Preserves: free, XHS, and PYQ mode calculations.

- [ ] **Step 1: Write failing source/behavior tests**

Assert `applyWidth` invokes `applyPreviewModeFrame` after setting width and test both target calculations with stubbed element rectangles.

- [ ] **Step 2: Verify RED**

Run: `node tests/script-regression.test.mjs`

Expected: FAIL because width changes do not update the fixed height.

- [ ] **Step 3: Implement synchronized recalculation**

Call `applyPreviewModeFrame()` at the end of `applyWidth()` after initialization-safe null checks. Remove redundant mode-frame calls only if tests prove behavior remains identical.

- [ ] **Step 4: Verify GREEN**

Run: `node tests/script-regression.test.mjs && node tests/static-site.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add script.js tests/script-regression.test.mjs
git commit -m "fix: synchronize fixed preview ratios"
```

### Task 5: CSP, dependency pinning, and complete regression

**Files:**
- Modify: `tests/static-site.test.mjs`
- Modify: `index.html:15,36`

**Interfaces:**
- Preserves: classic global `marked` script API.
- Produces: explicit Marked version URL and jsDelivr permission in `font-src`.

- [ ] **Step 1: Write failing tests**

```js
assert.match(index, /marked@\d+\.\d+\.\d+\/marked\.min\.js/);
assert.match(index, /font-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
```

- [ ] **Step 2: Verify RED**

Run: `node tests/static-site.test.mjs`

Expected: FAIL because Marked is unpinned and jsDelivr is absent from `font-src`.

- [ ] **Step 3: Pin and permit dependencies**

Use a Marked version compatible with the current synchronous `marked.parse` and `marked.setOptions` calls. Add only `https://cdn.jsdelivr.net` to `font-src`; leave all other CSP directives unchanged.

- [ ] **Step 4: Verify all automated checks**

Run:

```bash
node --check script.js
node tests/script-regression.test.mjs
node tests/static-site.test.mjs
git diff --check
```

Expected: all commands exit 0 with no failures.

- [ ] **Step 5: Browser regression**

Serve the repository locally and verify:

- Primary controls and layout match the pre-change snapshot.
- `$F = ma$` remains inline and fenced `π` text is unchanged.
- Clear then Undo restores the immediately previous editor content.
- XHS remains 3:4 and PYQ remains 1290:2796 after width changes.
- A pasted local image survives page reload through IndexedDB.
- KaTeX font availability reports loaded.
- PNG, PDF, and HTML export buttons remain enabled and callable.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/static-site.test.mjs docs/superpowers/plans/2026-07-12-stability-optimization.md
git commit -m "test: cover stability regressions"
```
