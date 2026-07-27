# Phase AI-2 — Government Website Intelligence & Event Classification

**Status:** Implemented (intelligence only, advisory output)
**Date:** 2026-07-26
**Engine:** `notice_intelligence_event_v1` / `ai2.1.0`
**Non-goals honored:** No Generator redesign, no Production Workflow Engine changes, no monitoring scheduler changes, no deployment changes, no publishing changes, no database schema changes, `AUTO_PUBLISH` untouched.

---

## 1. Objective

Understand an official government website update *before* it reaches the existing Production Workflow, and express that understanding as one structured, normalized event object.

### Target flow (implemented)

```
Official Government Website
 ↓
Change Detection                      (unchanged — MB-2)
 ↓
Content Analysis                      (HTML / PDF text / plain text → normalized view)
 ↓
Event Detection                       (weighted signal scoring across content zones)
 ↓
Recruitment Matching Candidate        (is this a recruitment-relevant notice?)
 ↓
Event Classification                  (winner + sub-type + normalized title)
 ↓
Priority                              (CRITICAL / HIGH / MEDIUM / LOW)
 ↓
Confidence                            (per-field score + explanations)
 ↓
Normalized Event                      (frozen, advisory-only object)
 ↓
Production Workflow                   (unchanged — receives original event + one new key)
```

The whole pass is pure: it never fetches, schedules, persists, or publishes.

---

## 2. Architecture notes

### New module: `server/lib/noticeIntelligence/`

| File | Lines | Role |
|------|-------|------|
| `types.js` | 357 | Taxonomy: 29 event types, 26 sub-types, 28 canonical sections, priorities, confidence levels, validation codes, AI-1 section bridge |
| `textUtils.js` | 178 | Shared text helpers, script statistics, language detection, deep freeze |
| `contentAnalysis.js` | 303 | HTML/PDF/text intake → normalized text, lines, title candidates, headings, links, language |
| `headingIntelligence.js` | 745 | EN/HI/mixed heading detection, numbering, nesting, broken-heading repair, canonical mapping |
| `departmentDetection.js` | 461 | 21-organization registry plus generic patterns for unknown bodies |
| `referenceIntelligence.js` | 364 | Advertisement number, reference number, publication date, date schedule, year |
| `eventSignals.js` | 419 | Weighted EN/HI pattern dictionary for every event type and sub-type |
| `eventDetection.js` | 279 | Zone-weighted scoring, noisy-OR evidence combination, recruitment candidate scoring |
| `eventClassification.js` | 265 | Specificity and supersede rules, sub-type scoping, title normalization |
| `keywordIntelligence.js` | 235 | 76-entry keyword dictionary; normalized keyword plus original wording |
| `priorityEngine.js` | 216 | Base priority per event type plus recency/confidence/recruitment modifiers |
| `confidenceEngine.js` | 391 | Per-field scores with reason codes and a weighted overall score |
| `fingerprint.js` | 126 | Stable SHA-256 duplicate-candidate fingerprint plus identifier/title variants |
| `validation.js` | 217 | 13 validation codes across ERROR / WARNING / INFO |
| `normalizedEvent.js` | 169 | Builds the frozen event; attaches it additively to a monitoring event |
| `pipeline.js` | 236 | Orchestrator (`analyzeGovernmentNotice`, `enrichMonitoringEvent`) |
| `index.js` | 46 | Public facade (118 exported symbols) |

Total: **5,007 lines** of library code.

### Reuse rather than duplication

- PDF and OCR text is normalized through AI-1's `advancedNormalize` (`server/lib/generatorIntelligence/textNormalization.js`), so both phases see identical text.
- AI-1 section types are bridged to AI-2 canonical sections through `AI1_SECTION_TYPE_TO_CANONICAL`, so a Generator-parsed document and a monitored page describe sections with the same vocabulary.
- HTML parsing uses `cheerio`, already a dependency of the content-intelligence layer, and degrades to a regex-based reader if it cannot be loaded.

### How the classifier decides

Event detection scores each candidate type by matching weighted patterns across six zones — title, heading, URL, link text, lead paragraph, and body — where a title match counts far more than a body match. Matches are combined with noisy-OR so several weak signals never outweigh one decisive one. Classification then applies:

- **Supersede rules** — `final_result` beats `result`, `corrigendum` beats `correction`, `exam_city` beats `exam_date` when both fire on the same page.
- **Specificity tie-breaks** — a more specific type wins an otherwise equal score.
- **Sub-type scoping** — `document_verification` may attach to a result, not to a tender.

When nothing matches, the type is `unknown`, and the original wording is preserved verbatim in `rawEventLabel` rather than discarded.

---

## 3. Files created

**Library (17 files)** — every file listed in the table above, under `server/lib/noticeIntelligence/`.

**Tests and fixtures (2 files)**

- `tests/fixtures/ai2/governmentNotices.js` (316 lines) — 18 representative notices.
- `tests/phaseAI2.noticeIntelligence.test.js` (705 lines) — 82 tests.

**Documentation (1 file)**

- `docs/ai2-government-notice-intelligence-report.md` — this report.

## 4. Files modified

**None.** Phase AI-2 is entirely additive. `git status` shows only new untracked paths for this work; no existing source, test, config, migration, or deployment file was touched.

---

## 5. Sample normalized event

`analyzeGovernmentNotice(NOTICES.UPPSC_NEW_RECRUITMENT).normalizedEvent` (abridged to the contract fields):

```json
{
  "formatId": "notice_intelligence_event_v1",
  "engineVersion": "ai2.1.0",
  "advisoryOnly": true,
  "eventType": "new_recruitment",
  "eventSubType": null,
  "sourceTitle": "UPPSC Combined State / Upper Subordinate Services Examination 2026 — Recruitment Advertisement",
  "normalizedTitle": "UPPSC Combined State / Upper Subordinate Services Examination 2026 — Recruitment Advertisement",
  "sourceDepartment": "Uttar Pradesh Public Service Commission",
  "sourceBoard": "Uttar Pradesh Public Service Commission",
  "departmentCode": "UPPSC",
  "publicationDate": "2025-09-04",
  "referenceNumber": null,
  "advertisementNumber": "A-1/E-1/2026",
  "year": 2026,
  "keywords": ["UPPSC", "Block Development Officer", "Naib Tehsildar", "Uttar Pradesh", "Graduate"],
  "confidence": 0.91,
  "priority": "HIGH",
  "language": "en",
  "recruitmentCandidate": { "isRecruitmentCandidate": true, "score": 1 },
  "sections": {
    "canonicalSections": ["important_dates", "vacancy_details", "qualification", "important_links"],
    "knownHeadingCount": 6
  }
}
```

Alongside the contract fields the object carries supporting detail: `lifecycleStage`, `classificationCandidates`, `ambiguity`, `dates`, `keywordDetails`, `confidenceReport`, `priorityReport`, `sections.headings`, `fingerprint`, `validation`, and a `source` summary. The object is deep-frozen.

### Classification across the fixture set

| Fixture | Event type | Sub-type | Department | Priority | Confidence |
|---------|-----------|----------|------------|----------|-----------|
| UPPSC new recruitment | `new_recruitment` | — | UPPSC | HIGH | 0.91 |
| SSC admit card | `admit_card` | — | SSC | CRITICAL | 0.97 |
| Railway apprentice | `apprentice` | — | RRB | MEDIUM | 0.98 |
| Railway technician result | `result` | `document_verification` | RRB | CRITICAL | 0.97 |
| UP Police final result | `final_result` | `document_verification` | UPPRPB | CRITICAL | 0.89 |
| NTA exam city | `exam_city` | `city_intimation` | NTA | HIGH | 0.91 |
| NTA correction window | `correction` | `form_correction` | NTA | MEDIUM | 0.93 |
| BPSC extension | `extension_notice` | `date_extension` | BPSC | MEDIUM | 0.93 |
| AIIMS nursing walk-in | `walk_in` | `interview` | AIIMS | MEDIUM | 0.86 |
| DSSSB corrigendum | `corrigendum` | `revised` | DSSSB | MEDIUM | 0.91 |
| BHU assistant professor | `detailed_advertisement` | — | BHU | HIGH | 0.94 |
| Hindi-heavy result | `result` | `prelims` | UPPSC | CRITICAL | 0.97 |
| Mixed-language extension | `extension_notice` | `date_extension` | UPSSSC | MEDIUM | 0.80 |
| Press release | `press_release` | — | UPPSC | LOW | 0.68 |
| Tender notice | `tender` | — | AIIMS | LOW | 0.73 |
| Unknown notice | `unknown` | — | — | LOW | 0.01 |
| Broken-heading PDF | `detailed_advertisement` | `physical_test` | UPPRPB | HIGH | 0.92 |
| Short notice (plain text) | `short_notice` | — | BPSC | MEDIUM | 0.91 |

The Hindi-heavy fixture resolves `language: "hi"` and extracts the Devanagari advertisement number `ए-2/ई-1/2025`; the mixed fixture resolves `language: "hi-en"`.

---

## 6. Sample confidence report

Confidence is reported per field with reason codes and signed impacts, so every score can be explained. For the UPPSC fixture:

| Field | Score | Level | Leading reasons |
|-------|-------|-------|-----------------|
| Title | 0.95 | HIGH | `TITLE_PRESENT` (+0.40), `TITLE_DESCRIPTIVE` (+0.20), `TITLE_AUTHORITATIVE_SOURCE` (+0.20) |
| Department | 1.00 | HIGH | `DEPARTMENT_REGISTRY_MATCH` (+0.65), `DEPARTMENT_URL_MATCH` (+0.15), `DEPARTMENT_MULTI_SOURCE` (+0.10) |
| Event type | 0.79 | MEDIUM | `EVENT_TYPE_SIGNAL_STRENGTH` (+0.64), `EVENT_TYPE_TITLE_EVIDENCE` (+0.15), `EVENT_TYPE_AMBIGUOUS` (−0.15) |
| Dates | 1.00 | HIGH | `PUBLICATION_DATE_FOUND` (+0.50), `DATE_SCHEDULE_FOUND` (+0.35), `YEAR_RESOLVED` (+0.15) |
| Reference number | 0.60 | MEDIUM | `ADVERTISEMENT_NUMBER_FOUND` (+0.60) |
| **Overall** | **0.91** | **HIGH** | Weighted average 0.86, plus `STRUCTURED_DOCUMENT` (+0.05) |

Field weights are title 0.20, department 0.20, event type 0.35, dates 0.10, reference 0.15. Overall modifiers cover empty content (−0.30), thin content (−0.10), unclassified event (−0.10), and well-structured documents (+0.05).

A representative low-confidence report — the unknown-notice fixture — scores 0.01 overall and explains itself with `TITLE_MISSING`, `DEPARTMENT_MISSING`, `EVENT_TYPE_UNKNOWN`, `NO_DATES_FOUND`, `NO_IDENTIFIER_FOUND`, and the overall penalties `EMPTY_CONTENT` and `UNCLASSIFIED_EVENT`.

### Priority explanation

Priority is likewise explained. The UPPSC fixture reports base `HIGH` for `new_recruitment`, plus `recruitment_candidate` (+0.06) and `strong_classification` (+0.04), for a score of 0.80. Thresholds are CRITICAL ≥ 0.86, HIGH ≥ 0.62, MEDIUM ≥ 0.40, LOW below that. Results and admit cards start critical; corrections, corrigenda and extensions start medium; press releases and tenders start low.

---

## 7. Fingerprint examples

Fingerprints combine normalized title, department, advertisement number, reference number, and year into a canonical string, then SHA-256 it. **No duplicate decision is made in this phase** — `duplicateDecision` is always `null` and `advisoryOnly` is always `true`.

```json
{
  "algorithm": "AI2FP-SHA256",
  "fingerprint": "AI2FP-SHA256:9f7e7ee71a697abb205d91c2af265b3bd9d6005f8c2ef4276bb78e7a326cc213",
  "canonicalString": "uppsc combined state upper subordinate services examination 2026 recruitment advertisement|uppsc|a1e12026|-|2026",
  "components": {
    "normalizedTitle": "uppsc combined state upper subordinate services examination 2026 recruitment advertisement",
    "department": "uppsc",
    "advertisementNumber": "a1e12026",
    "referenceNumber": "",
    "year": "2026"
  },
  "presentComponents": ["normalizedTitle", "department", "advertisementNumber", "year"],
  "missingComponents": ["referenceNumber"],
  "strength": "strong",
  "variants": {
    "identifier": "AI2FP-SHA256:2ad32377b73bca2b6b1fb657f697cc85a0f388b5677b5d0f0bcf0c071b9e7d1d",
    "title": "AI2FP-SHA256:e71389be6125f47178e77a9666cf5c70fd8c4942e84a0746ed919171e90e2810"
  },
  "duplicateDecision": null,
  "advisoryOnly": true
}
```

Other fixture fingerprints:

| Fixture | Fingerprint |
|---------|-------------|
| SSC admit card | `AI2FP-SHA256:00d1b321b2c36468b84a6d14ea0d040d7ad01bf60cc0c1babd765e6ecb636027` |
| Railway technician result | `AI2FP-SHA256:7a6e132a4e754763ee7ef85ca49101f5326da87f7540e87a4817fbf07e2679e3` |
| Hindi-heavy result | `AI2FP-SHA256:c6df2ff3cb5eb55c25ab37c9a6238037f13a06b9e557664a4769523f78b531d0` |

Identifier normalization strips punctuation and case, so `A-1/E-1/2026`, `a1/e1/2026`, and `A 1 / E 1 / 2026` collapse to the same `identifier` variant. The two variants exist so a future deduplication phase can match on identifier alone (strongest) or on title alone (when a notice carries no number) without recomputing anything.

Fingerprint strength is reported as `strong`, `moderate`, or `weak` depending on how many components were present, which lets a later phase set different match thresholds per strength.

---

## 8. Compatibility report

| Rule | Status | Evidence |
|------|--------|----------|
| No Generator redesign | Honored | No file under `server/lib/generatorIntelligence/` or the Generator UI was modified; AI-1's normalizer is imported read-only |
| No Production Workflow modifications | Honored | `server/lib/productionWorkflow/` untouched; all 5 `productionWorkflow.phase*` suites pass |
| No Monitoring Scheduler changes | Honored | `server/lib/monitoringBot/` and `siteWorker.js` untouched |
| No deployment changes | Honored | No change to `package.json`, Dockerfiles, PM2/systemd config, or environment handling |
| No database schema changes | Honored | No migration added; no repository or model touched |
| No publishing changes | Honored | Publishing services untouched |
| `AUTO_PUBLISH` remains false | Honored | The flag is never read or written by this module |
| Backward compatible | Honored | Output is additive under a single new key; see below |

### How additivity is guaranteed

`enrichMonitoringEvent(event)` returns `{ ...event, noticeIntelligence: normalizedEvent }`. Every original key keeps its original value, and the one new key is namespaced. Any existing workflow stage that reads the event sees exactly what it saw before.

The test suite asserts this directly rather than assuming it: `runProductionWorkflow` is executed twice — once with the raw monitoring event, once with the enriched one — and the resulting per-stage status map is compared for equality. The enriched run produces identical stage outcomes.

No dependency was added to `package.json`. `cheerio` is already present, and the module falls back gracefully if it is unavailable.

---

## 9. Validation report

Thirteen validation codes are emitted across three severities:

| Severity | Codes |
|----------|-------|
| ERROR | `MISSING_TITLE`, `MISSING_DEPARTMENT`, `BROKEN_REFERENCE`, `EMPTY_CONTENT` |
| WARNING | `WEAK_TITLE`, `UNVERIFIED_DEPARTMENT`, `MISSING_DATES`, `MISSING_PUBLICATION_DATE`, `UNKNOWN_CLASSIFICATION`, `AMBIGUOUS_CLASSIFICATION`, `LOW_CONFIDENCE` |
| INFO | `MISSING_REFERENCE`, `NO_HEADINGS_DETECTED` |

Each issue carries a code, severity, field, and human-readable message. The result exposes `ok` (no errors), counts per severity, a `requiresManualReview` flag, and a summary of which contract fields were resolved.

Across the 18 fixtures: 17 validate as `ok`, and the deliberately degenerate unknown-notice fixture does not. Five fixtures set `requiresManualReview` — four for `AMBIGUOUS_CLASSIFICATION` (where the runner-up event type scored within 0.05) and one for the unknown notice. Ambiguity is surfaced rather than hidden: the event still classifies, but it is flagged so a reviewer sees the close call.

Nothing in this phase blocks, drops, or gates a notice. Validation output is advisory metadata attached to the event.

---

## 10. Test report

```
tests/phaseAI2.noticeIntelligence.test.js   82 passed
```

Twelve suites cover content analysis, heading intelligence, department detection, reference and date extraction, event classification, priority, confidence, keywords, fingerprints, validation, normalized event output, and Production Workflow compatibility.

Fixture coverage matches the requested list: UPPSC, SSC, Railway (apprentice and result), UP Police, NTA (exam city and correction), BPSC (extension and short notice), AIIMS (walk-in and tender), DSSSB, BHU, Hindi-heavy, mixed-language, correction, result, admit card, extension, press release, plus an unknown notice and a broken-heading PDF.

Regression runs:

| Suite | Result |
|-------|--------|
| `phaseAI2.noticeIntelligence` | 82 passed |
| `phaseAI1.generatorIntelligence` | 20 passed |
| `productionWorkflow.phase1`–`phase5` | 5 suites passed |
| `packageMB2` + `packageMB5` (unit + integration) | passed |

ESLint is clean across all new files.

The repository has pre-existing failures unrelated to this phase (for example `package4e.integration` and several `runtimeCapability*` suites assert against `siteWorker` source text that Phase AI-2 never touches). These fail identically before and after this work.

---

## 11. Known limitations

1. **Patterns, not a model.** Classification is a weighted rule engine. It generalises well across the boards in the registry but a board with unusual phrasing will land on `unknown` until signals are added. That is the designed failure mode — the wording is preserved, not discarded.
2. **Registry coverage is 21 organizations.** Anything outside it is reported through generic patterns as `isKnownOrganization: false` with the detected text kept verbatim, so downstream consumers can still see who issued the notice.
3. **Ambiguity between adjacent types.** Recruitment advertisements that lead with an apply-online call, and walk-in notices that read like advertisements, score close. The winner is chosen deterministically and the runner-up is exposed via `ambiguity` and the `AMBIGUOUS_CLASSIFICATION` warning.
4. **Publication date depends on a label.** Only labelled dates (`Dated`, `Date of Publication`, `प्रकाशन तिथि`, …) become `publicationDate`; a bare date in a corner of the page is collected into `dates` but not promoted, to avoid confusing an exam date with a publication date.
5. **Heading repair is deliberately conservative.** A wrapped heading is only rejoined when the merged line stays under 60 characters and resolves to a known canonical section, so genuinely broken PDF headings that split into three or more fragments may remain separate.
6. **Hindi month and numeral coverage is common-form only.** Regional spellings outside the common variants will not parse into a date, though the surrounding text is still classified.
7. **No duplicate decisions.** Fingerprints are generated but never compared. Matching, merging, and lifecycle correlation are out of scope for this phase.
8. **Not yet wired into the runtime.** The pipeline is complete and tested but is not called from `siteWorker` or any scheduler, because wiring it would change monitoring behaviour. Activation is a one-line call to `enrichMonitoringEvent` whenever a future phase chooses to enable it.
