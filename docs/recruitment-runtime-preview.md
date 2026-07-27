# Recruitment Runtime Preview — Known Limitations

Phase 30 introduced an in-memory preview buffer for administrators to inspect
`RECRUITMENT_PIPELINE_ENABLED` pipeline output without writing to the database
or `recruitment_review_queue`.

Phase 31.B documents operational limits; it does **not** solve process topology.

## Process-local memory

The preview buffer lives in **process-local memory** (Node module singleton).

When running under PM2:

- Web app: `sarkari-suchna` → `server/server.js` (cluster)
- Worker: `worker` → `server/services/workers/siteWorker.js` (separate fork)

Entries recorded by the **worker process** are **not** visible to the **web
process** admin UI/API. Admin APIs only list previews created in the same Node
process that serves `/api/admin/recruitment-runtime-preview`.

This is intentional for Phase 30/31.B. Do not assume cross-process visibility.
No Redis / MySQL / shared store is used for preview.

## Runtime notice fields

Monitoring (`siteChecker`) items expose only:

- `title`
- `link`

There is no separate body/content field in the monitoring flow. The runtime
pipeline therefore sets `notice.content` equal to `title`. This phase does
not scrape or fetch additional notice content.

## Traceability (`updateId`)

When `insertDetectedUpdate` returns an `updates.id`, that value is carried on
the pipeline outcome and preview entry as `updateId` for traceability only.
It does **not** cause review-queue or automatic persistence.

## Empty candidates

Runtime performs Phase 26 read-only candidate lookup when
`RECRUITMENT_PIPELINE_ENABLED` is on and the notice has sufficient criteria
(advertisement number, org+exam, org+post, or org+year). Lookup failures and
insufficient criteria continue with `candidateRecruitments=[]` — the worker
never fails. Preview entries include a `lookupSummary` (status, strategy,
candidate count).

## What remains out of scope

- Automatic review creation
- Persisting runtime pipeline output
- Redis / MySQL preview stores
- Cross-process PM2 preview visibility

## Phase 60 — second business consumer decision

No additional Preview Integration Contract consumer is integrated in Phase 60.

The existing workflow step after Preview Advisory preparation is
`recordRuntimePreviewFromPipeline` in the runtime preview buffer. That component
receives only the already-projected lifecycle advisory metadata; it does not
receive the internal Phase 55 context-read snapshot required to fulfill the
contract. Supplying that snapshot would require changing worker or pipeline
wiring, exposing internal runtime state, or accessing a prohibited capability
layer from the preview buffer.

The preview buffer also creates observable in-memory entries. Adding capability
data to its input, stored entries, or output would change runtime state or
metadata. Therefore it is not a suitable observation-only second business
consumer under the Phase 60 constraints. Preview Advisory remains the sole
business consumer, and runtime, metadata, rendering, workers, adapters, and
pipelines remain unchanged.
