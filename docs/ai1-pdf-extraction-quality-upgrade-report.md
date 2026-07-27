# Phase AI-1 — PDF Extraction & AI Conversion Quality Upgrade

**Status:** Implemented (quality improvement only)  
**Date:** 2026-07-26  
**Scope:** Generator PDF → text → structured conversion path  
**Non-goals honored:** No Generator UI redesign, no publishing changes, no `AUTO_PUBLISH`, no monitoring scheduler changes, no deployment config changes, no Production Workflow Engine changes, no editorial approval flow changes.

---

## 1. Objective

Upgrade the live Generator pipeline so official government notification PDFs convert into high-quality structured data suitable for direct use in the existing Generator, while preserving manual review.

### Target flow (implemented)

```
PDF
 ↓
Advanced Extraction (pdf-parse + multi-column pdfjs + OCR fallback)
 ↓
Section Detection (EN/HI headings + line classification)
 ↓
Structured JSON (generator_intelligence_structured_v1)
 ↓
Field Validation (dates, URLs, tables, confidence)
 ↓
Publisher Compile → existing [Section: …] text
 ↓
Generator Auto Fill (unchanged UI)
 ↓
Manual Review (unchanged)
```

---

## 2. Architecture notes

### New module: `server/lib/generatorIntelligence/`

| File | Role |
|------|------|
| `types.js` | Section / block / table / link taxonomy |
| `textNormalization.js` | Unicode NFC, spacing, broken/merged words, page/header/footer/watermark noise |
| `sectionDetection.js` | Heading + classification detection; preserves unknown sections; FAQ extraction |
| `smartTableDetection.js` | Vacancy / fee / age / dates / qualification / reservation table kinds |
| `linkClassification.js` | Notification PDF, Apply Online, Login, Result, etc. |
| `fieldValidation.js` | Date/URL/table validation + per-section confidence |
| `structuredOutput.js` | Builds normalized structured document |
| `publisherCompile.js` | Compiles structured JSON → Generator `[Section:]` text |
| `pipeline.js` | Orchestrator |
| `index.js` | Public facade |

### Wiring (live Generator path only)

```
POST /api/admin/pdf/extract
  → pdfGeneratorExtract.service.js
      (advancedNormalize + multi-column reading order)

POST /api/ai-parse
  → aiParseJob.service.js
      → runGeneratorIntelligencePipeline(rawText)
      → optional OpenAI refine (unchanged contract)
      → finalizeStructuredJobOutput
      → { result, structured?, validation?, meta? }
```

- Generator UI continues to consume **`result` only** (`[Section:]` publisher text).
- Optional `structured` / `validation` / `meta` are additive for quality inspection and tests.

### Explicitly untouched

- Generator HTML/JS UI, section editor UX
- Publishing / save / draft workflows
- Monitoring bot / scheduler
- Production Workflow Engine / CIP stage runners
- Deployment / PM2 / nginx config
- Editorial approval flow
- `AUTO_PUBLISH` (not enabled)

---

## 3. Files modified / added

### Added

- `server/lib/generatorIntelligence/**` (quality engine)
- `tests/phaseAI1.generatorIntelligence.test.js`
- `tests/fixtures/ai1/notificationSamples.js`
- `docs/samples/ai1-structured-examples.json`
- `docs/ai1-pdf-extraction-quality-upgrade-report.md` (this file)

### Modified

- `server/services/pdfGeneratorExtract.service.js` — multi-column pdfjs layout; AI-1 normalize
- `server/services/aiParseJob.service.js` — quality pipeline integration; richer AI prompt
- `server/controllers/public/misc.controller.js` — optional structured/validation passthrough
- `server/utils/publisherSections.js` — Salary / Helpline / How To Apply / Hindi aliases; preserve only explicit `[Section:]`
- `server/utils/smartClean.js` — stop dropping How To Apply / Syllabus / Instructions
- `server/utils/validateOutput.js` — stop treating those as garbage lines

---

## 4. Feature coverage vs requirements

| Requirement | Status |
|-------------|--------|
| Multi-column PDFs | Yes — X-gap column clustering in pdfjs text extraction |
| Tables | Yes — pipe/tab/CSV runs + kind classification |
| Headers / footers / page numbers | Yes — repeated-line + page-noise filters |
| Watermarks | Heuristic drop for common watermark phrases / repeated glyphs |
| Broken lines / merged words | Yes — hyphen rejoins + `AgeLimit`→`Age Limit` style fixes |
| Hindi + English mixed | Yes — bilingual heading map + FAQ language preserved |
| Unicode / spacing normalization | Yes — NFC + whitespace (without breaking `https://`) |
| Section detection list (Short Info → Instructions) | Yes + Salary / Helpline |
| Unknown sections preserved | Yes — unknown headings kept as custom sections |
| Structured output blocks | paragraph, date_list, table, bullet_list, link_list, faq, notice |
| Smart table kinds | vacancy, fee, age, important_dates, qualification, reservation |
| Link classification | notification_pdf, apply_online, official_website, login, registration, correction, admit_card, result, answer_key, syllabus |
| Validation + confidence | Per-section + overall |
| Generator compatibility | Compiles to existing `[Section:]` publisher format |
| Tests (UPPSC/SSC/Railway/UP Police/BPSC/NTA/Hindi) | Yes |

---

## 5. Sample extraction / structured results

See:

- Fixtures: `tests/fixtures/ai1/notificationSamples.js`
- Structured summaries: `docs/samples/ai1-structured-examples.json`

### Example (UPPSC) — publisher text (Generator-ready)

```text
[Section: Short Information]
Uttar Pradesh Public Service Commission
UPPSC Combined State / Upper Subordinate Services Examination 2026
…

[Section: Important Dates]
Online Apply Start Date : 04 September 2025
…

[Section: Vacancy | table]
Post Name, Category, Vacancy
Naib Tehsildar, General, 120
…

[Section: Important Links]
Apply Online=https://uppsc.up.nic.in
…
```

### Example structured shape

```json
{
  "formatId": "generator_intelligence_structured_v1",
  "engineVersion": "ai1.1.0",
  "metadata": {
    "title": "…",
    "languageHint": "en|hi-en",
    "detectionMode": "heading|classification"
  },
  "sections": [
    {
      "order": 0,
      "sectionType": "important_dates",
      "title": "Important Dates",
      "isKnownSection": true,
      "confidence": 0.92,
      "blocks": [{ "type": "date_list", "items": [{ "label": "…", "value": "…" }] }]
    }
  ],
  "links": [{ "label": "Apply Online", "url": "https://…", "category": "apply_online" }],
  "validation": {
    "ok": true,
    "overallConfidence": 0.8,
    "summary": { "sectionCount": 10, "okSections": 10 }
  }
}
```

---

## 6. Compatibility report

| Surface | Compatible? | Notes |
|---------|-------------|-------|
| Generator `#data` / Section builder | Yes | Still `[Section: Name]` text |
| `parseSectionsFromText` / `sectionBuilder` | Yes | Verified via tests (HTML cards/tables/links) |
| `POST /api/ai-parse` `{ result }` | Yes | Additive optional fields only |
| `POST /api/admin/pdf/extract` `{ text }` | Yes | Same response shape; cleaner text |
| Draft / publish / editorial APIs | Untouched | |
| Production workflow / CIP stages | Untouched | Separate library path remains independent |
| Monitoring bot | Untouched | |

**No Generator redesign.** Existing fields receive cleaner auto-filled section text after Convert with AI.

---

## 7. Test report

Command:

```bash
npx jest tests/phaseAI1.generatorIntelligence.test.js tests/aiParsePublisher.test.js tests/tableDetect.test.js --runInBand
```

**Result:** 3 suites, **29/29 passed**

Coverage includes:

- Normalization (spaced words, merged words, page noise, How To Apply preserve)
- Section / link / table unit checks
- Board samples: UPPSC, SSC, Railway, UP Police, BPSC, NTA, Hindi-heavy
- Generator compatibility via `processJobParse` + `buildDynamicSectionsWithWarnings`
- Regression: existing `aiParsePublisher` + `tableDetect` suites

---

## 8. Known limitations

1. **True scanned image PDFs** still depend on optional OCR deps (`canvas` + `tesseract.js`); quality varies with scan clarity.
2. **Complex 3+ column layouts** use a 2-column gap heuristic; unusual layouts may still interleave.
3. **Watermark removal** is heuristic (phrases / edge page crumbs), not full image watermark separation.
4. **Hindi date values** (e.g. `15 जुलाई 2025`) are preserved as text; strict English month normalization may not rewrite them.
5. **Same-URL link dedupe** keeps the strongest category only (e.g. Apply Online + Official Website sharing one URL → one row).
6. **OpenAI refine** remains optional; deterministic quality pipeline is the primary upgrade when `OPENAI_API_KEY` is absent.
7. **Salary / Helpline** are supported as publisher sections; they are custom titles (Generator already allows custom sections) and are not part of the older AI default skeleton alone.
8. **Binary PDF fixtures** are not stored in-repo; tests use representative text samples of each board style.

---

## 9. Rules compliance checklist

- [x] Do not redesign Generator UI  
- [x] Do not modify publishing workflow  
- [x] Do not touch monitoring bot  
- [x] Do not touch Production Workflow Engine  
- [x] Do not change deployment configuration  
- [x] Do not enable `AUTO_PUBLISH`  
- [x] Quality improvement only  
