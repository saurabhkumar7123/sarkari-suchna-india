# FPO-1 — Enterprise Product Consolidation & Performance

**Status:** Complete  
**Scope:** Admin frontend consolidation (PI-1 + PI-2 polish)  
**Behaviour change to publishing / workflow / generator backend / monitoring / scheduler:** None  
**AUTO_PUBLISH:** remains `false`

---

## 1. Objective

Consolidate completed Product Improvements (PI-1 Smart Generator Experience, PI-2
Editorial Workspace Pro) into a maintainable enterprise surface **without** adding
features or changing production behaviour.

This phase is presentation / maintainability only.

---

## 2. What changed

### New shared modules

| File | Role |
|---|---|
| `public/assets/css/admin/workspace-shared.css` | Shared severity tokens, focus rings, completion-dot green, reduced-motion, mobile 44px tap floor, `.ws-state` empty/loading/unavailable surfaces |
| `public/assets/js/admin-workspace-ui.js` | Shared `escapeHtml`, `bandClass`, `storageGet`/`storageSet`, `stateHtml`, `emptyRow`, friendly `MESSAGES` |
| `tests/phaseFPO1.consolidation.test.js` | Contract tests (AUTO_PUBLISH, wiring, no-fetch, helper API) |
| `docs/fpo1-enterprise-consolidation-report.md` | This report |

### Modified (presentation / wiring only)

| File | Change |
|---|---|
| `public/assets/css/admin/generator-workspace.css` | Tokens aliased to `--ws-*`; focus / reduced-motion / shared tap floor moved to shared CSS |
| `public/assets/css/admin/editorial-workspace.css` | Same token aliasing; bare `.is-high/.is-medium/.is-low` scoped under `#editorialWorkspacePro`; shared tap floor |
| `public/assets/css/admin/admin-design-system.css` | Dark-mode coverage for `#generatorWorkspace` and `#editorialWorkspacePro.ew-card` |
| `public/assets/css/admin/seo-diagnostics.css` | Mobile layout polish (form / card head wrap) |
| `public/assets/js/admin-ui.js` | Expose `AdminUI.escapeHtml` |
| `public/assets/js/generator-workspace.js` | Prefer `AdminWorkspaceUI` helpers; re-init guard via `state.ready` |
| `public/assets/js/editorial-workspace.js` | Prefer shared helpers; `emptyRow`; nav `aria-current` / labels; re-init guard |
| `private/generator.html` | Load `workspace-shared.css` + `admin-workspace-ui.js` |
| `private/admin-editorial-review.html` | Same shared assets; chrome ARIA controls |

### Explicitly untouched

- Production Workflow packages  
- Generator backend / `misc.controller` AI parse behaviour  
- Monitoring logic / polling policy  
- Scheduler  
- Publishing endpoints / decision state machine  
- Database schema / migrations  
- `AUTO_PUBLISH_ENABLED` (stays `false`)  
- New AI logic or additional client API requests  

---

## 3. CSS consolidation

**Approach:** Multi-product shared layer (`workspace-shared.css`) without renaming
`.gw-*` / `.ew-*` classes (preserves markup, tests, and mental model).

| Area | Result |
|---|---|
| Severity hex tokens | Single `--ws-high/medium/low(+soft)` source; both roots alias |
| Focus rings | One `:focus-visible` block for Generator + Editorial controls |
| Completion dots (green) | Shared `.gw-dot--complete` / `.ew-dot.is-complete` |
| Attention dots | **Kept separate** — Generator `#f59e0b` vs Editorial `--ew-medium` (appearance preserved) |
| Badge / pill look | **Kept separate** — Generator bordered chips vs Editorial soft pills |
| Mobile tap targets | Shared 44px floor ≤720px |
| SEO Diagnostics | Narrow-viewport form/input wrap only |

**Size note:** Product CSS is now split across three files
(~20.7 KB + ~11.4 KB + ~3.5 KB shared ≈ 35.6 KB on disk). Net maintainability
improves even where byte count is similar, because tokens/focus/a11y live once.
Aggressive selector deletion of page-local layout CSS was deferred to avoid
visual regressions.

---

## 4. JavaScript consolidation

| Before | After |
|---|---|
| Local `escapeHtml` in both workspace UIs | Prefer `AdminWorkspaceUI.escapeHtml` (fallback kept) |
| Local `storageGet`/`storageSet` (PI-2) | Prefer shared helpers |
| Local `bandClass` (PI-2) | Prefer shared helper |
| Hard-coded empty `<li>None</li>` rows | `emptyRow()` |
| `AdminUI` private escape only | Public `AdminUI.escapeHtml` |
| Possible double-init | Guarded by `state.ready` |

**Preserved:** All analysis stays in `generator-workspace-core.js` /
`editorial-workspace-core.js`. No merge of AI pipelines. No new `fetch`.

---

## 5. Shared UI component standardization

Standardized via shared tokens + helpers (class names unchanged):

| Surface | Shared treatment |
|---|---|
| Cards / panels | Product CSS retained; dark-mode design-system coverage added |
| Badges / pills | Shared severity **tokens**; product-specific badge chrome kept |
| Timeline | PI-1 only (unchanged) |
| Progress / quality chips | PI-1 only (unchanged) |
| Issue lists / suggestion cards | Rendering helpers + empty-row helper |
| Empty / loading / AI unavailable | `.ws-state` + `MESSAGES` / `stateHtml()` |
| Buttons | Shared focus + mobile tap floor |
| Dialogs | Existing `AdminUI` confirms (unchanged) |

---

## 6. Accessibility summary

| Check | Status |
|---|---|
| Keyboard navigation | Existing Alt/Ctrl shortcuts retained |
| Focus states | Shared `:focus-visible` on workspace buttons / nav / jumps |
| ARIA | Editorial chrome: `aria-controls`, `aria-haspopup`; nav `aria-current`; issue counts labelled; decorative dots `aria-hidden` |
| Reduced motion | Shared preference block for pulse / flash |
| Contrast | Severity colors unchanged (existing high/medium/low palette) |
| Tab order | Unchanged DOM order |
| Screen reader | Status regions (`role="status"`) retained |

---

## 7. Performance

| Practice | Status |
|---|---|
| Reuse existing AI results | Yes — still presentation over payload / events |
| No additional API requests | Contract-tested |
| No polling | Unchanged |
| No duplicate listeners | Single delegated click handlers; re-init guarded |
| Debounced / idle analysis (PI-1) | Unchanged |
| Lazy PDF blob URL (PI-1) | Unchanged |
| Signature skip re-analysis (PI-1) | Unchanged |
| Source render length cap (PI-1) | Unchanged |

---

## 8. Mobile & tablet polish

| Page / surface | Action |
|---|---|
| Generator workspace | Shared 44px tap floor; existing ≤1180 / ≤900 / ≤640 grids kept |
| Editorial workspace | Shared tap floor; existing ≤1100 / ≤720 grids kept |
| SEO Diagnostics | Form inputs full-width ≤720; card head stacks |
| Other SaaS admin pages | Already on design-system + shell; no layout regressions introduced |

---

## 9. Error / empty / loading standardization

`AdminWorkspaceUI.MESSAGES` + `stateHtml(kind)` cover:

- Empty  
- Empty OK  
- Loading  
- Timeout  
- AI unavailable  
- Validation unavailable  
- No draft / no sections / no suggestions / no issues  

Workspace UIs continue to use their established copy where product-specific
wording matters; shared helpers are available for new or empty rows.

---

## 10. Testing

```bash
npx jest --runInBand \
  tests/phaseFPO1.consolidation.test.js \
  tests/phasePI1.generatorWorkspaceCore.test.js \
  tests/phasePI1.backwardCompatibility.test.js \
  tests/phasePI2.editorialWorkspaceCore.test.js \
  tests/phasePI2.backwardCompatibility.test.js
```

**Result (this run):** 5 suites, **119 passed**.

Verified contracts:

- Generator + Editorial Review markup / controls  
- No workspace `fetch` / publish / `AUTO_PUBLISH`  
- Shared asset load order  
- Helper escaping + band classes  

---

## 11. Compatibility summary

| Constraint | Met |
|---|---|
| No workflow changes | Yes |
| No publishing changes | Yes |
| No scheduler changes | Yes |
| No monitoring behaviour changes | Yes |
| No new AI logic | Yes |
| No Generator backend changes | Yes |
| No database redesign | Yes |
| Full backward compatibility | Yes (PI-1 + PI-2 suites green) |
| `AUTO_PUBLISH` false | Yes |

---

## 12. Known limitations

1. **Generator SaaS CSS (`generator-saas.css` / `generator.css`) not merged** — high
   risk to layout; deferred beyond FPO-1.
2. **Recruitment badge prefixes not folded into design-system** — already partially
   shared via `recruitment-module.css`; further rename avoided.
3. **`.gw-*` / `.ew-*` class rename deferred** — would break markup/tests for little gain.
4. **Attention-dot colors remain product-specific** by design (appearance lock).
5. **Aggressive unused-selector deletion deferred** — requires visual QA per page.
6. **`escapeHtml` still duplicated in older non-workspace admin scripts** —
   opportunistic cleanup only where touched; full sweep is a follow-up.

---

## 13. Expected result

A cleaner, easier-to-maintain enterprise admin product with **identical**
Generator / Editorial / Monitoring / Publishing behaviour, shared workspace
primitives, stronger accessibility focus handling, and contract tests locking
the consolidation.
