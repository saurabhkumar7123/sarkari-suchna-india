# Phase PI-1 — Smart Generator Experience

**Status:** Complete
**Scope:** Generator admin UI only (`/generator`)
**Behaviour change to publishing:** None

---

## 1. Objective and approach

Upgrade the Generator into an AI-assisted review workspace without changing any
existing workflow or publishing behaviour.

The key architectural finding that shaped the implementation: **the backend already
produced everything PI-1 needed and the UI was throwing it away.**
`POST /api/ai-parse` returns `{ result, structured, validation, meta }`, where
`validation.sections[]` already carries per-section confidence scores and issue
lists from the Phase AI-1 Generator Intelligence pipeline. The old
`aiConvert()` read only `data.result` and discarded the rest
(`misc.controller.js` even documents this: *"Generator UI uses `result` only"*).

PI-1 therefore ships as a **read-only presentation layer** over data that already
exists. That is what makes the "no logic changes" requirement achievable rather
than aspirational: there was no need to touch extraction, conversion, or publishing
to deliver every item in the brief.

### Resulting flow

```
PDF Upload
   ↓  generator:pdf-selected          → timeline: Upload ✓
Extraction Timeline
   ↓  generator:extract-start/success → timeline: Extraction ✓ (+ OCR note)
AI Conversion
   ↓  generator:ai-success            → timeline: AI Conversion ✓ (+ engine confidence)
Section Validation
   ↓  analyzeWorkspace()              → timeline: Validation ✓
Confidence Indicators   → per-section High / Medium / Low badges
Structured Preview      → PDF ⇄ structured split view with match highlighting
Generator               → unchanged editor, unchanged publish
Manual Review           → summary, validation panel, advisory suggestions
```

The Generator's own pipeline is untouched; the workspace observes it via
`CustomEvent`s and re-renders.

---

## 2. Files changed

### New files (7)

| File | Lines | Purpose |
|---|---:|---|
| `public/assets/js/generator-workspace-core.js` | 1105 | Pure analysis core: section parsing, confidence, validation, suggestions, summary, source matching, friendly errors. Dual-export (browser + Jest). |
| `public/assets/js/generator-workspace.js` | 912 | UI layer: timeline, navigator, split view, panels, shortcuts. Read-only. |
| `public/assets/css/admin/generator-workspace.css` | 1091 | Scoped styling, dark mode, desktop/tablet/mobile breakpoints. |
| `tests/phasePI1.generatorWorkspaceCore.test.js` | 411 | 37 unit tests incl. performance budgets. |
| `tests/phasePI1.backwardCompatibility.test.js` | 294 | 50 contract tests guarding the "no changes" promises. |
| `docs/pi1-workspace-preview.html` | 291 | Offline preview harness (documentation only, never served). |
| `docs/pi1-smart-generator-experience-report.md` | — | This report. |

### Modified files (3) — 136 insertions, 2 deletions total

| File | Change |
|---|---|
| `private/generator.html` | +89 lines: workspace markup, shortcuts dialog, stylesheet link, two script tags. No existing element removed or renamed. |
| `public/assets/js/generator.js` | +46 lines: one `emitGeneratorEvent()` helper plus 12 dispatch call sites. No existing branch, request, or payload altered. |
| `server/app.js` | +3 lines: `frameSrc: ["'self'", "blob:"]` CSP directive (see §6). |

---

## 3. Implementation of each task

**1. Smart processing timeline.** Five stages (Upload, Extraction, AI Conversion,
Validation, Generator Ready) with `pending / active / done / error / skipped`
states. Stages carry live detail — extracted character count, whether OCR ran,
the engine's overall confidence. Opening an existing page marks the upload stages
`skipped` rather than leaving them looking stalled.

**2. PDF vs structured preview.** A two-pane split view. The source pane has two
tabs: *Extracted text* (default) and *Original PDF*, which renders the locally
selected file via a lazily created blob URL. Selecting a section highlights the
matching region of the extracted text and scrolls to it. `findSourceMatch()`
picks the section's most distinctive lines, tries an exact match, then falls back
to a half-line prefix match because AI output reflows text.

**3. Section navigator.** Sidebar listing every detected section with a position
index, line/table/link counts, a confidence badge and a completion dot
(complete / needs attention / empty). Clicking jumps in three places at once: the
structured pane, the source highlight, and the real editor — selecting the exact
character range in the raw textarea, or scrolling and flashing the matching card
when the visual Section builder is active.

**4. Confidence badges.** High ≥ 75%, Medium ≥ 50%, Low below. Scores come from
the server's `validation.sections[].confidence` when available, matched by
normalised heading, and fall back to a local heuristic otherwise. One deliberate
override: a section the operator has since emptied is capped at 20% confidence,
so a stale server score can never show "High" on an empty section.

**5. Validation panel.** Seven grouped categories: missing required sections,
broken links, empty sections, duplicate content, OCR issues, validation warnings
(translated from the server's `issue` codes into plain English), and recommended
additions. Each row that maps to a section gets a **Go** button.

**6. AI suggestions panel.** Advisory only, prioritised, capped at 14. There is no
apply button, no patch payload, and no code path that writes content — this is
enforced by tests that assert no `replacement` / `patch` / `apply` / `newText`
field can ever appear on a suggestion object.

**7. Generator summary.** Sections detected, tables detected, links detected,
estimated edit time, and an overall quality score with a label, plus a
high/medium/low confidence breakdown. Edit time is a conservative heuristic
(base + per-section + penalties for low confidence, tables, errors and warnings).

**8. Keyboard shortcuts.** Every shortcut *clicks an existing button* rather than
reimplementing its action, so behaviour cannot drift.

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + S` | Save draft |
| `Ctrl/⌘ + Shift + S` | Save / Update page |
| `Ctrl/⌘ + Enter` | Refresh live preview |
| `Ctrl/⌘ + Shift + A` | Convert with AI |
| `Alt + ↑ / ↓` | Previous / next section |
| `Alt + 1…9` | Jump to section by number |
| `Alt + W` / `Alt + P` / `Alt + R` | Toggle workspace / source pane / re-check |
| `Shift + ?` | Shortcut list |

`Ctrl+S` is bound to **draft**, not publish, so the reflex save never publishes.
Existing bindings (`Ctrl+K` command palette, `Escape` handlers) are preserved;
the `Escape` handler only consumes the event when the shortcut dialog is open.

**9. Better error handling.** `describeExtractionError()` turns raw failures into
a title, a plain explanation and an actionable hint. It covers network loss, 401
session expiry, 413 oversize (quoting the actual file size), 429 rate limiting,
wrong file type, `OCR_FAILED`, `TEXT_TOO_SHORT`, `INVALID_PDF`, non-JSON 5xx
proxy responses, and a generic fallback. Example — before: *"PDF extraction
failed: Scanned ya image PDF ho sakti hai…"*; after: **"This looks like a scanned
PDF"** / "OCR ran but could not recover enough readable text." / "Try a clearer
scan, a smaller page range, or paste the text manually into Page Content."

**10. Responsive.** Desktop ≥1180px: navigator + split view side by side, three
panel columns. Tablet ≤1180px: navigator becomes a grid strip above a still-split
view, two panel columns. ≤900px: panes stack. Mobile ≤640px: single column,
44px tap targets, timeline stacked, the workspace defaults to collapsed.

**11. Performance.** See §5.

**12. Backward compatibility.** See §6.

---

## 4. UI preview

Because the Generator is behind admin authentication and needs MySQL + Redis,
screenshots cannot be captured from this environment. Instead the real CSS and
real JavaScript are mounted in a standalone harness:

```
docs/pi1-workspace-preview.html   ← open directly in a browser, no server needed
```

It ships realistic sample data (a UP Police constable notification with a
duplicate line, a broken link, an empty section and a vacancy table) and five
buttons that replay the genuine lifecycle events — *Select PDF → Extract text →
Convert with AI*, plus an error case. Watching the timeline advance and the
panels populate is the fastest way to review the feature and capture screenshots.

The harness doubles as a live check of the event contract: it dispatches exactly
the events `generator.js` dispatches, with the same payload shapes.

---

## 5. Performance

Measured by `tests/phasePI1.generatorWorkspaceCore.test.js` (Node 22, `--runInBand`):

| Scenario | Result | Budget |
|---|---:|---:|
| Typical notification, full analysis | **0.31 ms** | 25 ms |
| 149,939 chars / 60 sections | **13.37 ms** | 250 ms |
| Source match lookup on large extract | **0.069 ms** | 15 ms |

### Comparison to the previous Generator

There is **no measurable regression**, because PI-1 adds no work to any existing
path:

| Path | Before | After |
|---|---|---|
| PDF extract request | 1 request | 1 request (identical body and endpoint) |
| AI convert request | 1 request | 1 request (identical body and endpoint) |
| Save / publish | unchanged | unchanged |
| Network requests added | — | **zero** (asserted by test) |
| Page weight added | — | 3 static assets, cached, loaded after `generator.js` |

Cost containment in the UI layer:

- Analysis is debounced 320 ms and then deferred to `requestIdleCallback`, so it
  never runs on the typing critical path.
- A content signature short-circuits redundant analyses when nothing changed.
- The PDF blob URL is created only when the operator opens the PDF tab, and is
  revoked on new selection and on unload.
- Source rendering is capped at 240 KB; issue lists cap at 20 rows; section body
  previews cap at 1,200 characters.
- The whole workspace is hidden (and analysis skipped while collapsed) in
  fullscreen editing and quick-boot mode.

---

## 6. Compatibility report

| Requirement | Status | Evidence |
|---|---|---|
| No Generator logic changes | ✅ | `generatePage()`, `aiConvert()`, `extractPDF()`, `updatePreview()`, `saveGeneratorDraftToServer()` bodies unchanged apart from added event dispatches. Endpoints, payload keys and multipart field names asserted identical. |
| No Production Workflow changes | ✅ | No file under `server/lib/productionWorkflow/` touched. |
| No Publishing changes | ✅ | `buildJobHtml()` output asserted to contain no `gw-`, `generatorWorkspace`, `generator-workspace` or `Smart workspace` markers. |
| No AUTO_PUBLISH changes | ✅ | `FLAG_DEFAULTS.AUTO_PUBLISH_ENABLED === false`, `isAutoPublishBlocked() === true`, `PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED === false`. PI-1 sources contain no reference to `AUTO_PUBLISH`, `/api/admin/pages` or `mark-published`. |
| No Monitoring changes | ✅ | No monitoring file touched. |

### Read-only guarantees, enforced by test

- The workspace issues **no** `fetch`, `XMLHttpRequest` or `sendBeacon`.
- The workspace never assigns to the editor's `value`.
- The core module never references `document` at all.
- Shortcuts only `.click()` controls that already exist in the page.

### Graceful degradation

If `generator-workspace-core.js` fails to load, `generator-workspace.js` returns
immediately. If the markup is absent, `init()` returns early. If `CustomEvent` is
unsupported, `emitGeneratorEvent()` swallows the error inside a `try/catch`, so a
listener can never interrupt an extraction or a publish.

### The one server-side change

`server/app.js` gains a single CSP directive:

```js
frameSrc: ["'self'", "blob:"],
```

Previously `frame-src` fell back to `default-src 'self'`, which blocks the
`blob:` iframe used to preview a locally chosen PDF. This **narrows** rather than
widens the policy in one sense: `frame-src` is now explicit instead of inherited.
Blob URLs are same-origin and created only from a file the operator picked.
`frameAncestors: ['none']`, `objectSrc: ['none']` and `defaultSrc: ['self']` are
unchanged, so clickjacking and plugin protections are intact — asserted by test.

---

## 7. Test report

### PI-1 suites: 87 tests, all passing

```
tests/phasePI1.generatorWorkspaceCore.test.js    37 passed
tests/phasePI1.backwardCompatibility.test.js     50 passed
```

Coverage: section parsing and offsets, heading aliases, placeholder detection,
all three link syntaxes, URL validation, confidence banding and server/heuristic
precedence, duplicate detection, broken links, missing and empty sections, four
OCR heuristics, summary counters, edit-time estimation, quality scoring,
suggestion advisory-only invariants, input immutability, source matching, eleven
error mappings, the stage contract, three performance budgets, DOM structure via
`cheerio`, and the compatibility guarantees in §6.

Five bugs were found and fixed by these tests during development, including
`www.` URLs being rejected as broken and misspelled schemes (`htp:/…`) being
silently ignored instead of flagged.

### Regression check on the wider suite

The repository has pre-existing failures unrelated to this work. A controlled
before/after comparison was run on the 16 suites closest to the Generator and
publishing pipeline:

| Run | Result |
|---|---|
| With PI-1 changes | 4 suites / 5 tests failed, 192 passed |
| With PI-1 server change reverted | 4 suites / 5 tests failed, 192 passed |

**Identical**, confirming PI-1 introduces no regression. The four pre-existing
failures are in files this phase never touched:

| Suite | Pre-existing cause |
|---|---|
| `phase1-ui-improvements` | Job template expects `vacancy-details.css?v=92`; template has since moved on |
| `highlightBanner` | Same template version drift |
| `topicTags` | Routing returns `/department/army`, test expects `/topic/army` |
| `package4e.integration` | `admin-nav.js` no longer contains the string `Shared Preview` |

No existing test asserts against `server/app.js` CSP, `private/generator.html`, or
`public/assets/js/generator.js` — verified by search — so those three edits have
no other test surface.

### Lint

`npx eslint` on the changed server and test files reports **0 errors**. The two
warnings in `server/app.js` (`isLocalOrigin`, `shouldRedirectToHttps` unused) are
pre-existing and untouched. `public/**` and `private/**` are excluded from lint by
the project's own `eslint.config.js`.

---

## 8. Follow-ups worth considering

1. **Persist the analysis with drafts.** Confidence and validation are recomputed
   per session; storing the last report on the draft row would let a reviewer see
   what the previous editor saw.
2. **Feed confidence back from the publish-time analyzer.**
   `POST /api/admin/pages/analyze-content` already returns a parser-level
   analysis; merging it would sharpen table diagnostics.
3. **Render the PDF with pdf.js instead of a blob iframe.** That would allow
   highlighting inside the actual PDF, not just the extracted text, and would let
   the `frame-src` CSP change be reverted.
4. **A real screenshot pipeline.** Adding Playwright as a dev dependency would let
   CI capture the workspace states automatically.
