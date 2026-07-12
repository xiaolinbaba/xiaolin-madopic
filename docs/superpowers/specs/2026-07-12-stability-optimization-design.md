# Madopic Stability Optimization Design

## Goal

Fix the confirmed data-loss, rendering, undo, responsive-ratio, and dependency-policy issues without changing the current UI, DOM structure, user-facing controls, export formats, or public `window.MadopicApp` API.

## Scope

- Preserve the existing static HTML/CSS/JavaScript architecture and CDN-based deployment.
- Preserve current visual styling and all toolbar, keyboard, image, chart, formula, preview, and export entry points.
- Fix local-image draft persistence while continuing to read existing text drafts.
- Prevent formula shortcuts from rewriting fenced code, inline code, links, and existing math.
- Ensure every programmatic editor mutation participates in undo/redo and autosave.
- Recalculate fixed-ratio preview frames when width or restored settings change.
- Permit KaTeX fonts under CSP and pin the unversioned Marked dependency.
- Add regression tests for each repaired behavior.
- Do not split `script.js`, introduce a build system, or redesign the UI in this change.

## Design

### Markdown preprocessing

Protect fenced code, inline code, links/images, and existing `$...$` or `$$...$$` spans with temporary tokens before applying shortcut replacements. Restore protected spans afterward. Shortcut replacements remain available in plain text, preserving current convenience while avoiding content corruption.

### Editor history

Introduce one editor mutation helper that records the current state, applies the new value and selection, records the resulting state, updates line numbers and preview, and optionally focuses the editor. Toolbar actions, clearing, template insertion, and image insertion will use it. Native typing will continue to use the existing debounced history listener.

### Local images

Use stable `madopic-image://<id>` references in editor Markdown. Keep the existing in-memory map for immediate rendering and persist the map in IndexedDB. During startup, load saved images before restoring/rendering the draft. Existing drafts containing ordinary Markdown or full data URLs remain readable. Legacy truncated Base64 markers without saved image data cannot be reconstructed and will remain unchanged rather than being silently altered.

If IndexedDB is unavailable or quota-limited, image insertion still works for the current page through the memory map and shows a warning that the image will not survive a refresh.

### Fixed-ratio layout

Centralize mode-frame recalculation after mode changes, width changes, and settings restoration. Free mode behavior stays unchanged. XHS remains 3:4 and PYQ remains 1290:2796.

### Dependency policy

Pin Marked to an explicit compatible version. Extend `font-src` to include jsDelivr so the already referenced KaTeX font files load. Avoid broad CDN or module changes that could affect Prism autoloading, charts, exports, or page startup.

## Error handling

- IndexedDB failures degrade to memory-only images and a non-blocking warning.
- Corrupt persisted image records are ignored individually.
- Existing draft and settings error handling remains in place.
- No new blocking dialogs are introduced.

## Testing

- Static tests verify CSP and pinned dependency declarations.
- Pure regression tests verify protected Markdown preprocessing and editor-history semantics.
- Source-contract tests verify image persistence is loaded before draft restoration and all programmatic editor mutations use the shared helper.
- Browser regression checks verify formula rendering, undo after clear, XHS/PYQ ratios after width changes, KaTeX font availability, and unchanged primary controls/layout.
- Existing syntax, static-site, whitespace, and git-status checks remain required.

## Compatibility constraints

- No visual CSS changes.
- No element IDs, button labels, mode names, storage keys, export filenames, or public global API names are removed or renamed.
- No third-party package installation or Python environment is required.
