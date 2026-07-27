# Phase AI-3 — Recruitment Matching & Recommendation Engine

## 1. Objective

Decide whether a newly detected event belongs to an existing recruitment or represents a
completely new one, and say so as a **recommendation only**.

Nothing in this phase changes behaviour. It does not modify monitoring, does not modify the
Production Workflow, does not enable `AUTO_PUBLISH`, does not publish pages, does not touch
the Generator UI, does not activate the scheduler, and adds no database schema. Every output
carries `advisoryOnly: true` and `appliesChanges: false`, and the whole result is returned
under one new namespaced key.

### Target flow (implemented)

```
Normalized Event  (Phase AI-2, unchanged)
      ↓
Recruitment Matching     candidate search over existing recruitment metadata
      ↓
Similarity Analysis      weighted factors → normalized score 0.00–1.00
      ↓
Recommendation Engine    one of six outcomes + explanation + confidence
      ↓
Production Workflow      (unchanged; receives the same event plus one extra key)
```

## 2. Architecture notes

### New module: `server/lib/recruitmentMatching/`

| File | Lines | Responsibility |
| --- | --- | --- |
| `types.js` | 382 | Taxonomy: six recommendations, twelve update relationships, lifecycle order, factor weights, thresholds, validation codes, reason codes, rule ids |
| `matchingUtils.js` | 649 | Tokenization, bilingual token folding, Devanagari identifier folding, Jaccard / containment / bigram similarity, identifier and organization comparison, title-ambiguity assessment |
| `recruitmentRecord.js` | 444 | Normalizes recruitment metadata through field aliases, infers category and lifecycle stage, builds the in-memory search index, extracts the event identity from a normalized event |
| `candidateSearch.js` | 237 | Blocking strategies that pull a small candidate set out of the index |
| `similarityEngine.js` | 469 | Weighted per-factor scoring, named adjustments, candidate ranking |
| `updateClassification.js` | 415 | Maps an event to one of the twelve relationships, checks lifecycle plausibility, maps the update onto a candidate, detects re-published documents |
| `confidenceEngine.js` | 411 | Three confidence dimensions plus evidence alignment and an overall score |
| `validation.js` | 320 | The advisory flags a reviewer needs |
| `recommendationEngine.js` | 370 | Nineteen ordered decision rules, each with an explanation |
| `recommendation.js` | 203 | Builds and attaches the frozen, namespaced output object |
| `pipeline.js` | 207 | Orchestrates the pass; accepts three input shapes |
| `index.js` | 36 | Public facade |

### Reuse rather than duplication

- Text helpers (`collapse`, `round2`, `deepFreeze`, `toText`) come from
  `server/lib/noticeIntelligence/textUtils.js`.
- `CONFIDENCE_LEVELS`, `CONFIDENCE_THRESHOLDS` and `VALIDATION_SEVERITY` are imported from
  Phase AI-2's `types.js` and re-exported, so both phases speak one vocabulary.
- The event taxonomy is bridged, not restated: `EVENT_TYPE_TO_RELATIONSHIP` maps AI-2 event
  types onto AI-3 relationships.
- The existing `productionWorkflow/recruitmentResolution/` layer is untouched. It performs
  deterministic single-record matching for PWP Phase 2; AI-3 performs fuzzy multi-candidate
  matching and produces advice. Neither calls the other.

### How the decision is reached

1. **Event identity** — title, board, department, advertisement and reference numbers, year,
   category, keywords, post names and fingerprint are read off the normalized event.
2. **Candidate search** — the index is probed by official identifier, board + cycle year,
   board, shared title vocabulary, shared keywords, and (only when nothing else hits)
   category + year. Candidates are prefiltered and capped.
3. **Similarity** — each candidate is scored factor by factor, then adjusted.
4. **Ranking** — candidates are sorted; the winner, runner-up, separation and the set of
   strong matches are recorded.
5. **Relationship and lifecycle** — the event's update relationship is classified and checked
   against how far the winning recruitment has progressed.
6. **Duplicate check** — the event is compared against documents already recorded on the
   winning recruitment.
7. **Validation** — advisory flags are collected.
8. **Rules** — the first rule whose condition holds decides; later matching rules are recorded
   as alternatives considered.
9. **Confidence** — three dimensions are scored and combined.

## 3. Files created

```
server/lib/recruitmentMatching/                     (12 files, 4143 lines)
tests/phaseAI3.recruitmentMatching.test.js          (1055 lines, 103 tests)
tests/fixtures/ai3/recruitmentRepository.js         (377 lines)
docs/ai3-recruitment-matching-recommendation-report.md
```

## 4. Files modified

None. No existing source file, test, configuration, migration or schema was changed. The
phase is reachable only by explicitly requiring `server/lib/recruitmentMatching`, and nothing
in the existing codebase does so yet.

## 5. Candidate search examples

Blocking keys are tried from strongest to weakest, and every candidate records which
strategies found it.

| Event | `identifierBlocked` | Strategies that hit | Candidates from 10 records |
| --- | --- | --- | --- |
| UPPSC admit card, advertisement `A-1/E-1/2026` | yes | `advertisement_number`, `board_and_year`, `board`, `title_tokens`, `keywords` | 4 |
| RRB result quoting notice `RRB/RES/22/2026` | yes | `official_identifier` list on the recruitment | 2 |
| Unnumbered BSSC apply-online notice | no | `board_and_year`, `title_tokens`, `keywords` | 2 |
| BHU assistant professor advertisement | no | none — no candidate at all | 0 |

The RRB case is worth spelling out. The result notice quotes its own document number, not the
recruitment's `CEN-02/2025`. Because the recruitment lists both under
`officialIdentifiers`, the notice still blocks on an identifier and scores 0.95 rather than
falling back to prose.

## 6. Similarity examples

Weights sum to exactly 1.00: advertisement number 0.29, reference number 0.19, title 0.17,
board 0.13, year 0.08, department 0.06, keywords 0.05, category 0.03. Only comparable factors
enter the denominator, so a missing field dilutes nothing — it is instead handled by a named
adjustment.

### An exact identifier match (score 1.00, STRONG)

`UPPSC_UPPER_ADMIT_CARD` against `REC-UPPSC-UPPER-2026`: advertisement number, board,
department, title, year, keywords and category all match, giving 1.00.

### A Hindi notice against a Latin-script record (score 0.84, STRONG)

`HINDI_HEAVY_RESULT` against `REC-UPPSC-RO-ARO-2025`:

| Factor | Weight | Status | Contribution | Detail |
| --- | --- | --- | --- | --- |
| advertisement_number | 0.29 | match | 0.29 | `ए-2/ई-1/2025` folds onto `A-2/E-1/2025` |
| reference_number | 0.19 | not comparable | 0 | absent from the event |
| board | 0.13 | match | 0.13 | matched on code `UPPSC` |
| department | 0.06 | match | 0.06 | matched on name |
| title | 0.17 | mismatch | 0.05 | similarity 0.32; shared tokens `review`, `officer` |
| year | 0.08 | match | 0.08 | 2025 = 2025 |
| keywords | 0.05 | match | 0.04 | shared `review officer`, `uppsc`, `assistant review officer` |
| category | 0.03 | match | 0.03 | both `state_psc` |

The Devanagari advertisement number is the decisive factor. Without identifier folding the
same pair would have been read as an identifier conflict and sent to review.

### Same title, different year (score 0.50, WEAK)

`UPPSC_UPPER_NEW_CYCLE` against `REC-UPPSC-UPPER-2026`: title similarity is 1.00 because the
year is stripped before tokenization, but `A-1/E-1/2027` conflicts with `A-1/E-1/2026`. The
conflict caps the score at 0.55 and the year mismatch subtracts a further 0.08.

### Same board, different recruitment (score 0.44, WEAK)

`UPPSC_SAME_BOARD_OTHER_RECRUITMENT` (Staff Nurse) against `REC-UPPSC-UPPER-2026`: board,
department, year and category all agree — the shared board alone is worth a lot — but title
similarity is 0.17 and the advertisement numbers differ, so the pair never approaches a match.

### Named adjustments

| Adjustment | Impact | When |
| --- | --- | --- |
| `NO_IDENTIFIER_COMPARABLE` | −0.10 | neither side offers a comparable identifier |
| `IDENTIFIER_PARTIAL` | −0.04 | identifiers agree only on a prefix |
| `LOW_FACTOR_COVERAGE` | −0.12 | comparable weight is below 0.45 of the total |
| `YEAR_MISMATCH` | −0.08 | cycle years differ |
| `IDENTIFIER_CONFLICT_CAP` | ceiling 0.55 | identifiers of the same kind disagree |

An event quoting an identifier that appears nowhere in a recruitment's records is treated as
disagreement rather than missing data — unless the other identifier field already matched, in
which case the notice is simply quoting one number and not the other.

## 7. Recommendation examples

Nineteen ordered rules produce the six permitted outcomes. Every rule declares a base
confidence and whether it depends on the presence of a match, the absence of one, or neither.

| Event | Relationship | Recommendation | Best match | Score | Confidence | Rule |
| --- | --- | --- | --- | --- | --- | --- |
| `UPPSC_NEW_RECRUITMENT` | notification | `POSSIBLE_DUPLICATE` | REC-UPPSC-UPPER-2026 | 1 | 0.94 | `DUPLICATE_OF_RECORDED_DOCUMENT` |
| `UPPSC_UPPER_ADMIT_CARD` | admit_card | `UPDATE_EXISTING` | REC-UPPSC-UPPER-2026 | 1 | 0.99 | `STRONG_MATCH_UPDATE` |
| `UPPSC_APPLY_ONLINE` | apply_online | `UPDATE_EXISTING` | REC-UPPSC-UPPER-2026 | 1 | 0.99 | `STRONG_MATCH_UPDATE` |
| `UPPSC_ANSWER_KEY` | answer_key | `UPDATE_EXISTING` | REC-UPPSC-RO-ARO-2025 | 0.99 | 0.99 | `STRONG_MATCH_UPDATE` |
| `NTA_EXAM_CITY` | exam_city | `UPDATE_EXISTING` | REC-NTA-CUET-UG-2026 | 0.98 | 0.99 | `STRONG_MATCH_UPDATE` |
| `BPSC_EXTENSION` | extension | `UPDATE_EXISTING` | REC-BPSC-71CCE-2026 | 0.98 | 0.99 | `STRONG_MATCH_UPDATE` |
| `SSC_EXAM_DATE` | exam_date | `UPDATE_EXISTING` | REC-SSC-GD-2026 | 0.98 | 0.99 | `STRONG_MATCH_UPDATE` |
| `UP_POLICE_JOINING` | joining | `UPDATE_EXISTING` | REC-UPPRPB-CONST-2025 | 0.98 | 0.99 | `STRONG_MATCH_UPDATE` |
| `UP_POLICE_FINAL_RESULT` | final_result | `UPDATE_EXISTING` | REC-UPPRPB-CONST-2025 | 0.96 | 0.98 | `STRONG_MATCH_UPDATE` |
| `NTA_CORRECTION_WINDOW` | correction | `UPDATE_EXISTING` | REC-NTA-CUET-UG-2026 | 0.96 | 0.98 | `STRONG_MATCH_UPDATE` |
| `RAILWAY_TECHNICIAN_RESULT` | result | `UPDATE_EXISTING` | REC-RRB-TECH-2025 | 0.95 | 0.98 | `STRONG_MATCH_UPDATE` |
| `DSSSB_CORRIGENDUM` | correction | `UPDATE_EXISTING` | REC-DSSSB-JE-2025 | 0.95 | 0.98 | `STRONG_MATCH_UPDATE` |
| `SSC_ADMIT_CARD` | admit_card | `UPDATE_EXISTING` | REC-SSC-GD-2026 | 0.9 | 0.93 | `STRONG_MATCH_UPDATE` |
| `MIXED_LANGUAGE_EXTENSION` | extension | `UPDATE_EXISTING` | REC-UPSSSC-LEKHPAL-2026 | 0.89 | 0.93 | `STRONG_MATCH_UPDATE` |
| `RRB_DV_SCHEDULE` | dv | `UPDATE_EXISTING` | REC-RRB-TECH-2025 | 0.86 | 0.68 | `STRONG_MATCH_UPDATE` |
| `HINDI_HEAVY_RESULT` | result | `UPDATE_EXISTING` | REC-UPPSC-RO-ARO-2025 | 0.84 | 0.92 | `STRONG_MATCH_UPDATE` |
| `UNNUMBERED_FIELD_ASSISTANT_NOTICE` | apply_online | `HUMAN_REVIEW` | REC-BSSC-FIELD-ASSISTANT-A | 0.86 | 0.43 | `AMBIGUOUS_MULTIPLE_STRONG_MATCHES` |
| `PRESS_RELEASE` | none | `IGNORE` | REC-UPPSC-UPPER-2026 | 0.61 | 0.62 | `NON_RECRUITMENT_EVENT` |
| `UPPSC_UPPER_NEW_CYCLE` | notification | `CREATE_NEW` | REC-UPPSC-UPPER-2026 | 0.5 | 0.61 | `NEW_CYCLE_OF_KNOWN_RECRUITMENT` |
| `ORPHAN_ADMIT_CARD` | admit_card | `HUMAN_REVIEW` | REC-SSC-GD-2026 | 0.47 | 0.57 | `ORPHAN_UPDATE_EVENT` |
| `PDF_BROKEN_HEADINGS` | notification | `CREATE_NEW` | REC-UPPRPB-CONST-2025 | 0.46 | 0.79 | `NEW_CYCLE_OF_KNOWN_RECRUITMENT` |
| `SHORT_NOTICE_TEXT` | notification | `CREATE_NEW` | REC-BPSC-71CCE-2026 | 0.44 | 0.72 | `WEAK_MATCH_NEW_RECRUITMENT` |
| `UPPSC_SAME_BOARD_OTHER_RECRUITMENT` | notification | `CREATE_NEW` | REC-UPPSC-UPPER-2026 | 0.44 | 0.72 | `WEAK_MATCH_NEW_RECRUITMENT` |
| `HINDI_NEW_RECRUITMENT` | notification | `CREATE_NEW` | REC-BPSC-71CCE-2026 | 0.41 | 0.66 | `WEAK_MATCH_NEW_RECRUITMENT` |
| `TENDER_NOTICE` | none | `IGNORE` | — | 0 | 0.4 | `NON_RECRUITMENT_EVENT` |
| `RAILWAY_APPRENTICE` | notification | `CREATE_NEW` | REC-RRB-TECH-2025 | 0.29 | 0.8 | `NO_MATCH_NEW_RECRUITMENT` |
| `AIIMS_NURSING_WALK_IN` | notification | `CREATE_NEW` | REC-UPPSC-UPPER-2026 | 0.1 | 0.68 | `NO_MATCH_NEW_RECRUITMENT` |
| `BHU_ASSISTANT_PROFESSOR` | notification | `CREATE_NEW` | — | 0 | 0.66 | `NO_MATCH_NEW_RECRUITMENT` |
| `UNKNOWN_NOTICE` | unknown | `HUMAN_REVIEW` | — | 0 | 0.24 | `VERY_LOW_EVENT_CONFIDENCE` |

`MERGE_CANDIDATE` covers the case where a recruitment is probably already known but no
identifier corroborates it — a fuller announcement of something already tracked. No fixture
in the shipped repository lands there naturally, so it is proved by a unit test over
`evaluateRecommendation` (`PROBABLE_MATCH_WITHOUT_IDENTIFIER`).

### Explanations

Every recommendation names the evidence that produced it.

> **UPDATE_EXISTING** — The notice carries an Admit Card update and matches recruitment
> REC-UPPSC-UPPER-2026 ("UPPSC Combined State / Upper Subordinate Services Examination 2026")
> at similarity 1, matching advertisement_number, board, department, title, year, keywords,
> category. It belongs to that existing recruitment.

> **CREATE_NEW** — The event title matches recruitment REC-UPPSC-UPPER-2026 ("UPPSC Combined
> State / Upper Subordinate Services Examination 2026") closely (title similarity 1), but the
> event is for 2027 while that recruitment is for 2026. A repeated recruitment name in a new
> year is a new recruitment cycle, not an update to the old one.

> **POSSIBLE_DUPLICATE** — A Notification document with identifier a1e12026 dated 2025-09-04
> is already recorded.

> **HUMAN_REVIEW** — An Admit Card notice only exists for a recruitment that has already been
> announced, but the best candidate is REC-SSC-GD-2026 at similarity 0.47. Either the parent
> recruitment was never captured or this notice belongs to a recruitment outside the supplied
> metadata.

## 8. Update classification

Twelve relationships, each with a lifecycle position:

| Relationship | Order | Requires an existing recruitment |
| --- | --- | --- |
| Notification | 10 | no |
| Apply Online | 20 | yes |
| Correction | 25 | yes (any stage) |
| Extension | 26 | yes (any stage) |
| Exam Date | 30 | yes |
| Exam City | 35 | yes |
| Admit Card | 40 | yes |
| Answer Key | 50 | yes |
| Result | 60 | yes |
| Final Result | 70 | yes |
| Document Verification | 80 | yes |
| Joining | 90 | yes |

Relationships are resolved from the AI-2 event type, refined by sub-type where the primary
type is generic, and — when the event type is unusable — inferred from bilingual title
patterns (`उत्तर कुंजी` → Answer Key, `नियुक्ति पत्र` → Joining, and so on).

A result notice that happens to mention document verification stays a Result: sub-type
overrides are restricted to generic primary types, so a result page is never reinterpreted as
a DV notice.

### Mapping onto the candidate

```json
{
  "mapped": true,
  "relationship": "admit_card",
  "recruitmentId": "REC-UPPSC-UPPER-2026",
  "similarity": 1,
  "fromLifecycleStage": "apply_online",
  "toLifecycleStage": "admit_card",
  "isNewStageForRecruitment": true,
  "plausibility": {
    "plausible": true,
    "level": "plausible",
    "delta": 20,
    "reason": "Admit Card moves the recruitment forward from \"apply_online\"."
  }
}
```

Forward movement is plausible. A single step back is plausible too — multi-tier exams reissue
admit cards after a first-stage result — but two or more steps back is flagged.

## 9. Confidence report

Three dimensions, each a clamped sum of signed impacts with reason codes.

```
candidateSelection  1.00  HIGH
  +0.50  IDENTIFIER_BLOCKED          Candidates were found by official identifier, the strongest available key.
  +0.25  BOARD_AND_YEAR_BLOCKED      Candidates were found by recruiting body and cycle year.
  +0.20  TITLE_TOKEN_BLOCKED         Candidates were found by shared recruitment vocabulary.
  +0.10  KEYWORD_BLOCKED             Candidates were found by shared keywords.
  +0.12  CLEAR_SEPARATION            The winning candidate leads the runner-up by 0.5.

matchQuality        0.98  HIGH
  +0.70  MATCH_SIMILARITY            Weighted similarity is 1 (STRONG).
  +0.15  EXACT_ADVERTISEMENT_NUMBER  Advertisement number "A-1/E-1/2026" matches exactly.
  +0.08  TITLE_STRONG                Title similarity is 1.
  +0.05  LIFECYCLE_PLAUSIBLE         Admit Card moves the recruitment forward from "apply_online".

recommendation      0.99  HIGH
  +0.45  RULE_BASE_CONFIDENCE        Rule STRONG_MATCH_UPDATE carries a base confidence of 0.9.
  +0.29  MATCH_QUALITY_SUPPORT       The recommendation rests on the match, whose quality confidence is 0.98.
  +0.20  CANDIDATE_SELECTION_SUPPORT Candidate selection confidence is 1.
  +0.05  EVENT_CONFIDENCE_HIGH       The upstream normalized event is itself confident (0.97).

overall             0.99  HIGH   (0.25 candidateSelection + 0.25 evidenceAlignment + 0.50 recommendation)
```

The overall score uses **evidence alignment** rather than raw match quality, because a weak
match is strong evidence *for* `CREATE_NEW` and weak evidence for `UPDATE_EXISTING`. Which way
round it counts is decided by the rule that fired. Without this, a correct `CREATE_NEW` on an
empty repository scored 0.27 despite being unambiguously right; it now scores 0.66.

## 10. Validation report

All five required flags are produced, plus six more.

| Code | Example |
| --- | --- |
| `MULTIPLE_STRONG_MATCHES` | `UNNUMBERED_FIELD_ASSISTANT_NOTICE`: two BSSC records matched at 0.86, separation 0 |
| `MISSING_ADVERTISEMENT_NUMBER` | the same notice carries no identifier at all |
| `CONFLICTING_DEPARTMENTS` | a UPSSSC Lekhpal notice against a Bihar SSC Lekhpal record |
| `LOW_CONFIDENCE` | `UNKNOWN_NOTICE`: upstream event confidence 0.24 |
| `AMBIGUOUS_TITLE` | "Important Notice" cannot identify a recruitment |
| `IDENTIFIER_CONFLICT` | `UPPSC_UPPER_NEW_CYCLE`: `A-1/E-1/2027` versus `A-1/E-1/2026` |
| `YEAR_MISMATCH_ON_MATCHING_TITLE` | the same event: titles agree at 1.00, years differ |
| `ORPHAN_UPDATE_EVENT` | `ORPHAN_ADMIT_CARD`: an admit card with no parent recruitment |
| `IMPLAUSIBLE_LIFECYCLE_TRANSITION` | a notification matched against a recruitment already at admit-card stage |
| `NO_CANDIDATES_FOUND` / `EMPTY_RECRUITMENT_REPOSITORY` | `BHU_ASSISTANT_PROFESSOR` |
| `DUPLICATE_DOCUMENT_FINGERPRINT` | `UPPSC_NEW_RECRUITMENT` re-posted |
| `UNRESOLVED_UPDATE_RELATIONSHIP` / `NON_RECRUITMENT_EVENT` | `UNKNOWN_NOTICE`, `TENDER_NOTICE` |

Validation never raises an error severity, because it is advisory — across all 29 fixtures,
`errorCount` is 0 and `ok` is true. Conflicts with a candidate that scored below the weak
threshold are reported as information rather than as warnings, so an irrelevant candidate
cannot inflate `requiresHumanReview`.

## 11. Compatibility report

| Guarantee | How it is enforced | Test |
| --- | --- | --- |
| Production Workflow unchanged | no existing file was modified | `git status` shows only additions |
| Recommendation is namespaced | attached under `recruitmentMatching`, alongside AI-2's `noticeIntelligence` | "uses a namespace of its own" |
| Enrichment is additive | every original key keeps its original value; key count grows by exactly one | "enrichment is additive and preserves every original key" |
| No mutation | attaching does not touch the input event; matching does not touch the recruitment metadata | two tests compare JSON snapshots |
| Identical workflow behaviour | the same event run with and without a recommendation produces the same status, final state, publish flag and per-stage statuses | "Production Workflow behaves identically with and without a recommendation" |
| Advice never publishes | an `UPDATE_EXISTING` recommendation leaves the run exactly where the baseline left it | "a recommendation of UPDATE_EXISTING changes nothing about the run" |
| `AUTO_PUBLISH` still false | asserted against both the flags module and the publishing policy | "AUTO_PUBLISH remains disabled" |
| Output is immutable | the recommendation is deep-frozen; assignment throws in strict mode | "is immutable and advisory" |

The pipeline accepts an AI-2 normalized event, an already-enriched monitoring event, or a raw
monitoring event (which it runs through AI-2 first), and all three produce the same
recommendation for the same notice.

## 12. Test report

`tests/phaseAI3.recruitmentMatching.test.js` — **103 tests, all passing.**

| Group | Tests | Covers |
| --- | --- | --- |
| Record normalization | 4 | field aliases, category and year inference, index construction, event identity |
| Candidate search | 6 | identifier blocking, alternate identifiers, prose fallback, empty repository, explicit hint, capping |
| Similarity engine | 12 | weights sum to 1.00, range 0–1 over every fixture, exact identifiers, conflict ceiling, unrecorded identifiers, coverage penalty, ranking, title similarity, Devanagari folding, organization comparison |
| Update classification | 9 | all twelve relationships, title fallback, sub-type restraint, candidate mapping, plausibility, duplicate detection |
| Recommendation engine | 7 | six outcomes only, rule id integrity, explanations everywhere, per-outcome cases, alternatives, prose quality |
| Confidence | 6 | three dimensions with reasons, range over every fixture, identifier effects, evidence alignment, crowded candidates, validation penalties |
| Validation | 9 | the five required flags plus year mismatch, orphan updates, severity discipline |
| Required scenarios | 13 | the eleven scenarios named in the brief, plus final result and a second Hindi case |
| Output contract | 6 | required fields, immutability, three input shapes, no mutation, prebuilt index, empty input |
| Workflow compatibility | 7 | additivity, namespacing, identical behaviour, no publishing, `AUTO_PUBLISH` |

Required scenario coverage:

| Scenario | Fixture |
| --- | --- |
| New recruitment | `BHU_ASSISTANT_PROFESSOR` |
| Existing recruitment update | `BPSC_EXTENSION` |
| Duplicate notice | `UPPSC_NEW_RECRUITMENT` re-posted |
| Admit card | `SSC_ADMIT_CARD`, `UPPSC_UPPER_ADMIT_CARD` |
| Result | `RAILWAY_TECHNICIAN_RESULT`, `UP_POLICE_FINAL_RESULT` |
| Correction | `NTA_CORRECTION_WINDOW`, `DSSSB_CORRIGENDUM` |
| Extension | `BPSC_EXTENSION`, `MIXED_LANGUAGE_EXTENSION` |
| Same title, different year | `UPPSC_UPPER_NEW_CYCLE` |
| Same board, different recruitment | `UPPSC_SAME_BOARD_OTHER_RECRUITMENT` |
| Hindi notices | `HINDI_NEW_RECRUITMENT` (new), `HINDI_HEAVY_RESULT` (update) |
| Mixed-language notices | `MIXED_LANGUAGE_EXTENSION` |

Fixtures: 10 recruitment records with deliberately mixed field spellings, 2 deliberately
duplicated records for the ambiguity case, and 11 AI-3 notices reused alongside the 18 AI-2
notices, giving 29 notices in total.

### Suite-level result

| Run | Result |
| --- | --- |
| `tests/phaseAI3.recruitmentMatching.test.js` | 103 passed |
| AI-1 + AI-2 + AI-3 together | 205 passed |
| `eslint server/lib/recruitmentMatching tests/phaseAI3* tests/fixtures/ai3` | clean |
| Full suite without AI-3 | 43 suites failed, 256 passed; 62 tests failed, 6410 passed |
| Full suite with AI-3 | 43 suites failed, 257 passed; 62 tests failed, 6512 passed |

The failure counts are identical with and without this phase, so nothing regressed. Those 43
suites were already failing before this work: they are source-text assertions from earlier
phases (for example, a Phase 34 test that greps `siteWorker.js` for a comment that no longer
exists) and are unrelated to recruitment matching.

## 13. Known limitations

1. **Board identity is inherited from Phase AI-2.** AI-2 resolves an organization against a
   registry by name, so "Jharkhand Staff Selection Commission" is reported as "Staff Selection
   Commission" with code `SSC`. AI-3 therefore cannot tell those two bodies apart on the board
   factor. `ORPHAN_ADMIT_CARD` still reaches `HUMAN_REVIEW`, but via the identifier evidence
   rather than the board. Fixing this belongs in the AI-2 registry.
2. **Title similarity across scripts is shallow.** Hindi titles match through a hand-written
   alias table, so a Hindi notice against a Latin record scores on the order of 0.3 even when
   both name the same recruitment. Such pairs currently depend on the identifier or the
   keywords to reach a strong score. A transliteration or embedding approach would be a
   genuine improvement.
3. **No transitive or historical reasoning.** Each event is matched independently. The engine
   cannot notice that three notices in a row all point at the same unrecorded recruitment and
   propose creating it once.
4. **Duplicate detection needs recorded documents.** A re-published notice is only recognised
   when the recruitment metadata carries the earlier document's identifier, date or
   fingerprint. Records without a document history fall back to fingerprint comparison alone.
5. **Adjacent-year matching is deliberately conservative.** Advertisements that span fiscal
   years get partial year credit, but a recruitment renamed *and* moved to a new year will look
   like two unrelated recruitments.
6. **Lifecycle plausibility uses a single linear order.** Multi-tier recruitments with parallel
   stages (separate mains and skill-test tracks) are approximated by allowing one backward
   step, which is a heuristic rather than a model of the real process.
7. **Thresholds and weights are tuned against 29 fixtures.** They are honest for this set but
   have not met production traffic. They are all constants in `types.js` for exactly that
   reason.
8. **The candidate index is in-memory and rebuilt per call** unless the caller passes a
   prebuilt index. That is fine for the hundreds of records this system holds and would need
   revisiting at a much larger scale.
9. **Nothing consumes this phase yet.** Wiring the recommendation into the review queue or the
   Production Workflow is deliberately out of scope, since that would change behaviour.
