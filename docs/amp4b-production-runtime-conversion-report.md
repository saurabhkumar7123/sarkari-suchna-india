# AMP-4B Unified Production Runtime Conversion & Controlled Activation — Implementation Report

**Package:** AMP-4B  
**Title:** Unified Production Runtime Conversion & Controlled Activation  
**Status:** Complete — Runtime converted; activation withheld pending validation  
**Decision:** **NO-GO** (flags remain OFF)

---

## Executive Summary

AMP-4B refactors the existing AMP-4A advisory runtime into a production-capable runtime using the same architecture and enterprise repositories. Advisory blockers (`assertDormant`, preview-only paths, observation-only worker logic) were removed or replaced with feature-flag gates. Enterprise persistence, workflow orchestration, notification gateway routing, worker integration, pipeline integration, and Automation Control Center (ACC) now reflect live runtime posture.

**Production flags were NOT enabled.** All required validation gates report blockers while flags remain fail-safe off.

---

## Architecture Changes

### Before (AMP-4A)

```
Detection → Preview buffer / in-memory state → assertDormant() blocks APIs
Worker: observation-only, never persists
Notification Gateway: disabled stub
Automation Workflow: advisory-only effects
ACC: "Advisory only" labels
```

### After (AMP-4B)

```
Official Source → Detection → Recruitment Brain → History Recovery
  → Validation → Enterprise Persistence (Recruitment, Draft, Workflow)
  → Review Queue → Audit → Metrics → Telegram (via Gateway) → Manual Review

Feature-flag gates at every execution boundary
AUTO_PUBLISH_ENABLED remains false (mandatory human approval)
```

### New Runtime Module

| Module | Path | Role |
|--------|------|------|
| Production Runtime | `server/lib/recruitment/productionRuntime/index.js` | Unified orchestration entry point |
| Activation Readiness | `server/lib/recruitment/productionRuntime/activationReadiness.js` | Go/No-Go evaluation |

---

## Files Created

| File | Purpose |
|------|---------|
| `server/lib/recruitment/productionRuntime/index.js` | Production detection pipeline orchestrator |
| `server/lib/recruitment/productionRuntime/activationReadiness.js` | Controlled activation validator |
| `tests/packageAMP4B.unit.test.js` | Unit tests for conversion |
| `tests/packageAMP4B.integration.test.js` | Integration tests for ACC/API auth |
| `docs/amp4b-production-runtime-conversion-report.md` | This report |

---

## Files Modified

| File | Change |
|------|--------|
| `server/controllers/admin/enterprisePersistence.controller.js` | Replaced `assertDormant()` with RBAC `assertPermission()` |
| `server/lib/enterprise/notificationGateway/index.js` | Operational Telegram routing with retry, logging, rate-limit hooks |
| `server/services/workers/siteWorker.js` | Replaced preview/observation path with `runProductionDetectionPipeline()` |
| `server/lib/recruitment/automationWorkflow/index.js` | Added `runProductionAutomationWorkflow()` with workflow persistence |
| `server/lib/monitoringBot/pipelineIntegration/index.js` | Added `integrateProductProductionPipeline()` |
| `server/services/enterprise/enterprisePersistence.service.js` | AMP-4B snapshot with activation readiness |
| `server/services/automationControlCenter.service.js` | Live runtime, repository, Telegram health in dashboard |
| `server/config/automationFlags.js` | Added `canRunProductionPipeline()`, `canAutoDraft()`, `isAutoPublishBlocked()` |
| `private/admin-automation-control-center.html` | Live runtime labels, worker/pipeline/Telegram status pills |
| `public/assets/js/admin-automation-control-center.js` | Dynamic flag state, activation decision, runtime health |
| `tests/packageAMP4A2.unit.test.js` | Updated snapshot package + gateway test wording |
| `tests/packageAMP3.integration.test.js` | Updated ACC HTML expectations for live runtime |

---

## Runtime Conversion Summary

| Blocker Removed | Replacement |
|-----------------|-------------|
| `assertDormant()` in enterprise controller | RBAC permission gates (`recruitment:read`, `workflow:write`, etc.) |
| Preview-only worker path (`recordRuntimePreviewFromPipeline`) | `runProductionDetectionPipeline()` with enterprise persistence |
| Observation-only action plan / eligibility wiring | Production workflow orchestration |
| Notification gateway AMP-4A stub | Telegram delivery via `sendTelegramMessage` with 3-attempt retry |
| Advisory workflow effects (`productionEnabled: false`) | Flag-aware effects + workflow repository persistence |
| Advisory pipeline integration wrapper | `integrateProductProductionPipeline()` |
| ACC "Advisory only" UI | Live worker/pipeline/Telegram/repository status |

---

## Notification Gateway Report

| Channel | Status | Implementation |
|---------|--------|----------------|
| Telegram | Operational when `NOTIFICATION_GATEWAY_ENABLED` + `TELEGRAM_DELIVERY_ENABLED` | Retry (3x), logging, rate-limit hook |
| Email | Inactive future channel | Returns `status: inactive` |
| SMS | Inactive future channel | Returns `status: inactive` |
| Push | Inactive future channel | Returns `status: inactive` |
| Webhook | Inactive future channel | Returns `status: inactive` |

**Current state:** Gateway disabled (flags OFF). Telegram infrastructure ready; delivery blocked until flags enabled and `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` configured.

---

## Workflow Report

- `runProductionAutomationWorkflow()` runs AMP-2 framework orchestration
- Persists workflow transitions to `automation_workflows` (or file-store fallback)
- Persists retry count, failure reason, rollback point from `failureRecovery`
- Workflow history entries recorded on create and transition
- `AUTO_PUBLISH_ENABLED` blocked at orchestration effects layer

---

## Repository Wiring Report

| Repository | Wired In Production Runtime |
|------------|----------------------------|
| Recruitment | `upsertExtended()` after detection/brain |
| Draft | `upsertExtended()` when `AUTO_DRAFT_ENABLED` |
| Workflow | `createWorkflow()` / `updateWorkflow()` |
| Review Queue | `saveReviewItem()` + `upsertExtended()` |
| Audit | `recordEvent()` on pipeline completion and errors |
| Metrics | `upsertMetric()` for workflow and review dimensions |

Schema-adaptive fallback: file-store used when enterprise MySQL tables absent (migration not required for dev/test).

---

## ACC Report

ACC now displays:

- Worker status (`Worker: Active/Off`)
- Pipeline status (`Pipeline: Active/Off`)
- Telegram health (`Telegram: Active/Off`)
- Activation decision (`GO` / `NO-GO`)
- Live feature flag state from server
- Repository health via enterprise snapshot
- Manual publish guardrail

---

## Migration Report

- **Additive migration available:** `db/migrations/2026-07-20-amp4a2-enterprise-persistence.sql`
- **Not executed** in this package (no verified backup confirmed)
- Runtime operates with file-store fallback until migration applied
- No destructive migration performed

---

## Security Review

| Control | Status |
|---------|--------|
| Authentication | Preserved — all admin/enterprise endpoints require JWT |
| Authorization | Enhanced — RBAC replaces dormant gate |
| CSRF | Preserved — no changes to CSRF middleware |
| Rate limiting | Preserved + notification gateway rate-limit hook |
| Transactions | Preserved via existing enterprise base layer |
| Optimistic locking | Preserved in enterprise repositories |
| Audit logging | Enhanced — production runtime events recorded |
| AUTO_PUBLISH | Blocked — `isAutoPublishBlocked()` enforced |

---

## Performance Review

- Production pipeline runs sequentially per detected update (same as prior worker loop)
- Notification gateway rate-limit hook: 60/min default (`NOTIFICATION_GATEWAY_RATE_LIMIT_PER_MIN`)
- Enterprise repositories use existing pagination and schema cache
- No additional in-memory preview buffers

---

## Rollback Validation

Rollback path verified:

1. Set all production flags to `false` (default)
2. Worker skips production runtime (`production_runtime_disabled`)
3. Enterprise APIs remain accessible via RBAC (read-only posture)
4. File-store enterprise data isolated under `ENTERPRISE_DATA_DIR`
5. No schema changes applied — rollback is flag-only

---

## Regression Results

```
Test Suites: 6 passed (packageAMP3, packageAMP4A, packageAMP4A2, packageAMP4B unit + integration)
Tests:       33 passed
```

All AMP-4B conversion tests pass. Existing AMP-3/4A/4A.2 tests updated and passing.

---

## Final Go / No-Go Decision

### **NO-GO — Production flags NOT enabled**

Activation readiness evaluation reports blockers while flags remain off:

| Blocker | Required Action |
|---------|-----------------|
| `RECRUITMENT_PIPELINE_ENABLED` not enabled | Enable after full E2E validation |
| `AUTO_DRAFT_ENABLED` not enabled | Enable after draft persistence verified |
| `LIVE_CRAWLER_ENABLED` not enabled | Enable after crawler validation |
| `TELEGRAM_DELIVERY_ENABLED` not enabled | Enable after Telegram delivery test |
| `NOTIFICATION_GATEWAY_ENABLED` not enabled | Enable after gateway routing verified |
| Worker runtime not armed | Enable `PRODUCTION_MONITORING_ENABLED` + `WORKER_ACTIVATION_ENABLED` |

### Confirmed Flag State (unchanged)

```
RECRUITMENT_PIPELINE_ENABLED     = false
AUTO_DRAFT_ENABLED               = false
AUTO_PUBLISH_ENABLED             = false  ✓ (mandatory)
LIVE_CRAWLER_ENABLED             = false
TELEGRAM_DELIVERY_ENABLED        = false
NOTIFICATION_GATEWAY_ENABLED     = false
```

### Activation Procedure (when ready)

1. Apply additive enterprise migration with verified backup
2. Configure Telegram credentials
3. Run end-to-end validation: Official Source → Detection → Brain → Repositories → Review → Telegram
4. Run `evaluateActivationReadiness()` until `decision: "GO"`
5. Enable flags in order: monitoring/worker → pipeline → draft → gateway → telegram
6. **Never enable `AUTO_PUBLISH_ENABLED`**

---

## Next Actions

1. Apply `2026-07-20-amp4a2-enterprise-persistence.sql` on staging with backup
2. Configure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
3. Run staging E2E with flags enabled one at a time
4. Re-run activation readiness until GO
5. Enable production flags on production during maintenance window

**AMP-4B runtime conversion is complete. Controlled activation awaits operator validation.**
