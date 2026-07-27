# Phase AI-4 — Editorial Intelligence & Draft Quality Engine

## 1. Objective

Analyse AI-generated recruitment drafts **before** they reach the Editorial Review
Queue, and return actionable editorial advice only.

Nothing in this phase changes behaviour. It does not publish pages, does not modify
the Generator UI, does not modify the Production Workflow, does not change
Monitoring, does not enable `AUTO_PUBLISH`, does not activate the scheduler, and
adds no database schema. Every output carries `advisoryOnly: true` and
`appliesChanges: false`, and the whole result is returned under one new
namespaced key: `editorialIntelligence`.

### Target flow (implemented)

```
Notice Intelligence          (Phase AI-2, unchanged)
      ↓
Recruitment Matching         (Phase AI-3, unchanged)
      ↓
Editorial Intelligence       completeness → validation → missing info →
                             language → links → order → scores → suggestions
      ↓
Generator Draft              (PWP Phase 3, unchanged)
      ↓
Editorial Review             (PWP Phase 4, unchanged)
```

## 2. Architecture notes

### New module: `server/lib/editorialIntelligence/`

| File | Lines | Responsibility |
| --- | --- | --- |
| `types.js` | 312 | Taxonomy: profiles, severities, score weights, validation / missing / language codes, preferred section order |
| `draftUtils.js` | 349 | Section parsing, date / fee / vacancy / identifier / link extraction, placeholder-link hygiene |
| `draftModel.js` | 300 | Normalizes publisher text, AI-1 structured docs, draft objects and enriched events into one model |
| `completeness.js` | 79 | Expected-section coverage %; unknown sections preserved outside the denominator |
| `crossSectionValidation.js` | 354 | Dates, fees, vacancy totals, eligibility vs qualification, identifiers, terminology |
| `missingInformation.js` | 214 | Severity-tagged gaps (Critical / High / Medium / Low) |
| `languageQuality.js` | 136 | Mixed Hindi/English, broken Unicode, repeated sentences, OCR artifacts, formatting |
| `linkValidation.js` | 112 | Notification PDF, Apply Online, Official Website, Registration, Login, Correction, Admit Card, Result, Answer Key, Syllabus — broken / duplicate flags (no HTTP fetch) |
| `sectionOrdering.js` | 104 | Preferred order recommendation; never reorders |
| `suggestions.js` | 248 | Structured editor suggestions; `appliesChanges: false` on every item |
| `qualityScores.js` | 204 | Completeness, Consistency, Readability, Structure, Link Quality, Section Coverage, Overall — each with explanation |
| `summary.js` | 102 | Concise editor briefing + estimated manual editing effort |
| `report.js` | 83 | Builds and attaches the frozen `editorialIntelligence` object |
| `pipeline.js` | 173 | Orchestrates the pass; `analyzeEditorialDraft` / `enrichWithEditorialIntelligence` |
| `index.js` | 39 | Public facade |

### Reuse rather than duplication

- Text helpers (`collapse`, `round2`, `deepFreeze`, `detectLanguage`, …) come from
  `server/lib/noticeIntelligence/textUtils.js`.
- Section and link taxonomies come from Phase AI-1
  (`generatorIntelligence/types.js`, `linkClassification.js`).
- `CONFIDENCE_LEVELS` / `CONFIDENCE_THRESHOLDS` and event-type bridging come from
  Phase AI-2.
- Optional context from attached `noticeIntelligence` / `recruitmentMatching` keys
  is read when present; neither AI-2 nor AI-3 is modified.
- Production Workflow, Generator UI, Monitoring Bot, automation flags and
  publishing policy are **not imported for mutation** — only required in tests to
  prove identical behaviour.

### How the analysis is reached

1. **Draft model** — accept publisher `[Section: …]` text, AI-1 structured JSON,
   draft objects, or enriched monitoring events; resolve a draft profile
   (new recruitment / admit card / result / correction / extension / …).
2. **Completeness** — score present vs profile-expected sections; preserve unknowns.
3. **Cross-section validation** — dates, fees, vacancy totals, eligibility,
   identifiers, link/event fit.
4. **Missing information** — severity-tagged gaps (start date, last date, fee,
   links, FAQ, …).
5. **Language quality** — mixed script, Unicode, OCR, repetition, formatting
   (suggestions only).
6. **Link validation** — category coverage, duplicates, placeholders (no network).
7. **Section ordering** — recommend preferred Generator order; never apply it.
8. **Suggestions** — structured, severity-sorted, never applied.
9. **Quality scores** — six dimensions + weighted overall, each explained.
10. **Editor summary** — briefing, critical issues, effort estimate, confidence.

## 3. Files created

```
server/lib/editorialIntelligence/                     (15 files)
tests/phaseAI4.editorialIntelligence.test.js          (58 tests)
tests/fixtures/ai4/editorialDrafts.js                 (16 draft fixtures)
docs/ai4-editorial-intelligence-report.md
```

## 4. Files modified

None. No existing source file, test, configuration, migration or schema was
changed. The phase is reachable only by explicitly requiring
`server/lib/editorialIntelligence`, and nothing in the existing codebase does so
yet.

## 5. Quality score examples

### Healthy new recruitment (`NEW_RECRUITMENT`)

| Dimension | Score | Level | Why |
| --- | --- | --- | --- |
| Completeness | 100 | HIGH | 14/14 expected sections present |
| Consistency | ~95 | HIGH | At most trivial hygiene findings |
| Readability | high | HIGH | Clean English prose |
| Structure | 100 | HIGH | Preferred order, no empty known sections |
| Link Quality | 100 | HIGH | Notification PDF + Apply Online + Official Website |
| Section Coverage | 100 | HIGH | Full profile coverage |
| **Overall** | **~90+** | **HIGH** | Weighted blend |

### Inconsistent draft (`INCONSISTENT_DRAFT`)

Overall falls to the **50–60** band: vacancy total mismatch, fee mismatch,
advertisement / reference conflicts, missing age-as-on date, placeholder links
and duplicate dates all deduct.

### Incomplete notification (`INCOMPLETE_NOTIFICATION`)

Overall stays **below 50**: most expected sections absent, critical missing-info
penalties applied after the weighted blend.

## 6. Editorial summary examples

Healthy draft briefing (shape):

> Profile: new_recruitment. Overall quality 90+/100 (HIGH). No critical issues
> detected. Expected information appears present for this profile. Estimated
> manual editing effort: minimal. Analysis confidence: ~80% (HIGH). Advisory
> only — draft was not modified.

Incomplete draft briefing (shape):

> Profile: new_recruitment. Overall quality &lt;50/100 (LOW). N critical issue(s)
> need attention before approval. M missing-information item(s) flagged.
> Estimated manual editing effort: heavy. … Advisory only — draft was not
> modified.

`editorSummary` always includes: `overallQuality`, `criticalIssues`,
`recommendedImprovements`, `missingInformation`, `confidence`,
`estimatedManualEditingEffort`, `briefing`, `advisoryOnly: true`,
`appliesChanges: false`.

## 7. Validation examples

| Finding | Code | Severity | Example |
| --- | --- | --- | --- |
| Date in Short Info missing from Important Dates | `DATE_MISSING_FROM_IMPORTANT_DATES` | High | `04 September 2025` |
| Duplicate date rows | `DUPLICATE_DATE_ENTRIES` | Medium | repeated last date |
| Fee mismatch | `FEE_VALUE_MISMATCH` | High | Short Info Rs 200 vs Fee section Rs 125 |
| Vacancy total mismatch | `VACANCY_TOTAL_MISMATCH` | Critical | rows sum 220, stated 300 |
| Eligibility vs Qualification | `ELIGIBILITY_QUALIFICATION_CONFLICT` | High | PG vs 10th |
| Advertisement number drift | `ADVERTISEMENT_NUMBER_INCONSISTENT` | Critical | `A-1/E-1/2026` vs `B-9/E-9/2027` |
| Reference number drift | `REFERENCE_NUMBER_INCONSISTENT` | Critical | `REF/100/2026` vs `REF/999/2027` |
| Duplicate / placeholder links | `DUPLICATE_LINK` / `BROKEN_OR_PLACEHOLDER_LINK` | Medium / High | repeated Apply URL, `example.com` |

## 8. Suggestion examples

| Type | Example title | Applies changes? |
| --- | --- | --- |
| `add_section` | Add missing FAQ | No |
| `add_content` | Application start date is missing | No |
| `resolve_inconsistency` | Vacancy table rows sum to 220 but stated total is 300 | No |
| `remove_duplicate_dates` | Remove duplicate dates | No |
| `fix_link` / `remove_duplicate_link` | Fix broken or placeholder link | No |
| `convert_paragraph_to_bullet_list` | Convert How To Apply paragraph into a bullet list | No |
| `reorder_sections` | Recommend preferred section order | No |
| `improve_language` | OCR artifacts / mixed Hindi-English | No |
| `correct_inconsistent_terminology` | Apply Online vs Registration | No |

## 9. Compatibility report

| Check | Result |
| --- | --- |
| Production Workflow status with vs without enrichment | Identical |
| Final workflow state | Identical (`READY_FOR_REVIEW` in fixture run) |
| `published` | `false` in both runs |
| Stage status map | Identical |
| Original event keys after `enrichWithEditorialIntelligence` | Preserved; +1 key only |
| Generator pipeline output shape | Unchanged |
| `getAutomationFlags().AUTO_PUBLISH_ENABLED` | `false` |
| `PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED` | `false` |
| Existing source files modified | **None** |
| DB schema / migrations | **None** |
| Scheduler / Monitoring / Generator UI | **Untouched** |

## 10. Test report

```
npx jest --runInBand tests/phaseAI4.editorialIntelligence.test.js
→ Test Suites: 1 passed
→ Tests:       58 passed
```

Fixture coverage required by the brief:

| Scenario | Fixture |
| --- | --- |
| New recruitment | `NEW_RECRUITMENT` |
| Admit Card | `ADMIT_CARD` |
| Result | `RESULT` |
| Correction | `CORRECTION` |
| Extension | `EXTENSION` |
| Mixed Hindi-English | `MIXED_HINDI_ENGLISH` |
| OCR-heavy PDF text | `OCR_HEAVY` |
| Incomplete notification | `INCOMPLETE_NOTIFICATION` |
| Duplicate links | `DUPLICATE_LINKS` |
| Missing dates | `MISSING_DATES` |
| Missing fee | `MISSING_FEE` |
| Missing eligibility | `MISSING_ELIGIBILITY` |
| Large vacancy tables | `LARGE_VACANCY_TABLE` |
| Plus | `INCONSISTENT_DRAFT`, `BROKEN_UNICODE`, `OUT_OF_ORDER` |

## 11. Known limitations

- Link validation is **syntactic** (scheme, placeholders, duplicates). It does not
  HTTP-fetch URLs, so live 404s are not detected.
- Vacancy total checks are heuristic over CSV / pipe tables; unusual layouts may
  under-count.
- Mixed Hindi/English detection is script-ratio based; intentional bilingual
  official wording can be flagged as Low severity advice.
- Profile inference from prose can mis-label edge notices; callers should pass
  `profile` or `eventType` (or attach AI-2 `noticeIntelligence`) when known.
- Section reorder is advisory only — editors must move sections themselves.
- The engine never writes back to Generator drafts, review queues, or the
  database.

## 12. Success criteria

| Criterion | Status |
| --- | --- |
| High-quality editorial recommendations | Met |
| Actionable structured suggestions | Met |
| Completeness / consistency / quality scores with explanations | Met |
| Editor briefing with effort estimate | Met |
| Zero production behaviour changes | Met (compatibility suite) |
| `AUTO_PUBLISH` remains false | Met |
| No Generator / PWP / Monitoring / Scheduler changes | Met |
| All phase tests pass | Met (58/58) |
