# AMP-3 Automation Control Center Report

## Summary

AMP-3 delivers a premium SaaS-style Automation Control Center (ACC) as the primary admin surface for Sarkari Suchna India.

This package is advisory-only:

- `RECRUITMENT_PIPELINE_ENABLED` remains `false`
- No publishing activation
- No worker activation
- No scheduler activation
- No crawler activation
- No Telegram sending
- No runtime automation changes
- No DB migration
- No API behavior changes

## Primary Route

- `/admin`
- `/admin/dashboard`
- `/admin/automation-control-center`

All of the above now serve the ACC UI.

## Implemented Screens

1. Automation Dashboard
2. Official Source Manager
3. Recruitment Explorer
4. Review Center
5. Draft Viewer
6. Workflow Queue
7. AI Insights
8. Monitoring Dashboard
9. Audit Center
10. Settings

## Navigation Map

- Automation Control Center
- Page Manager
- Monitoring
- PDF Alerts
- Content Import
- Sessions
- Activity
- Recruitment Operations
- Editorial Review
- Events
- Shared Preview
- SEO Diagnostics
- Page Generator
- Upload PDF
- Trash
- Homepage Management
- Recruitment Testing
- Review Queue
- Runtime Preview

## UI Architecture

### View

- `private/admin-automation-control-center.html`

### Client Behavior

- `public/assets/js/admin-automation-control-center.js`

### Styling

- `public/assets/css/admin/automation-control-center.css`

### Routing

- `server/app.js`

### Shared Navigation / Discovery

- `public/assets/js/admin-nav.js`
- `public/assets/js/admin-command-palette.js`

## Component Tree

- ACC Shell
  - Sticky Header
  - Sticky Section Navigation
  - Hero / Global Search
  - Dashboard KPI Grid
  - Chart Panels
  - Source Manager Table + CRUD Dialog
  - Recruitment Explorer List + Detail Panel
  - Review Center List + Comparison Workspace
  - Draft Navigator + Preview
  - Workflow Queue Table
  - AI Insight Panels
  - Monitoring Cards
  - Audit Search + Table
  - Advisory Settings + Locked Flag List

## State Strategy

- Uses existing authenticated admin shell
- Uses current admin dashboard API opportunistically for summary numbers
- Uses local advisory state for:
  - official source CRUD
  - advisory settings persistence
  - feature flag display
- Uses static advisory data models for:
  - recruitment explorer
  - review center
  - workflow queue
  - AI insights
  - audit center

This keeps the package safe while still delivering a complete high-fidelity UI.

## Test Coverage Added

- Route auth coverage for ACC routes
- ACC page module presence coverage
- Navigation and command palette wiring coverage
- Server route wiring coverage
- Fail-safe feature flag coverage

## Test Result

- `tests/packageAMP3.integration.test.js`: passing

Note: Jest completed successfully but the process required manual termination because of an existing open-handle issue outside ACC scope.

## Created Files

- `private/admin-automation-control-center.html`
- `public/assets/css/admin/automation-control-center.css`
- `public/assets/js/admin-automation-control-center.js`
- `tests/packageAMP3.integration.test.js`
- `docs/amp3-automation-control-center-report.md`

## Modified Files

- `server/app.js`
- `public/assets/js/admin-nav.js`
- `public/assets/js/admin-command-palette.js`

## Future Integration Notes

1. Replace advisory local source CRUD with authenticated source registry APIs.
2. Bind Recruitment Explorer to live recruitment operations endpoints.
3. Bind Review Center to queue detail, diff, and reviewer action APIs.
4. Replace static AI analytics with real aggregation services.
5. Add server-backed export endpoints for audit and monitoring datasets.
6. Add end-to-end browser coverage when a stable admin UI test harness is available.
