# RC-1 Checklists

## Release Checklist

- [ ] Final assessment is `RELEASE_CANDIDATE_READY`
- [ ] Review `deployment-manifest.json` (whitelist only; everything else excluded)
- [ ] Confirm `generator/` runtime is included
- [ ] Confirm `server/lib/monitoringBot/**` is excluded
- [ ] Confirm tests / logs / tmp / generated / samples are excluded
- [ ] Confirm `.env.example` covers required production variables
- [ ] Confirm unused deps removed (`fuse.js`, npm `dompurify`); vendor DOMPurify retained
- [ ] Operator authorization recorded before any production action

## Migration Checklist

- [ ] Full MySQL backup taken
- [ ] Follow `db/migrations/MIGRATION_ORDER.txt` exactly
- [ ] Skip already-applied migrations
- [ ] Apply parent tables before FK linkage alters
- [ ] Treat `suggested_indexes.sql` as optional (explicit approval)
- [ ] Verify schema + smoke queries after batch
- [ ] No SQL executed by RC-1 itself

## Deployment Checklist

- [ ] Deploy **only** files listed in `docs/release-candidate/deployment-manifest.json`
- [ ] On target: `npm ci --omit=dev` from committed `package-lock.json`
- [ ] Supply production `.env` out-of-band (never from git)
- [ ] Health check `/ready` before enabling traffic features
- [ ] Do not activate scheduler / Telegram until post-deploy verification
- [ ] PM2 reload / Nginx reload only in the final authorized deploy request
- [ ] No push/deploy performed by RC-1

## Rollback Checklist

- [ ] Retain previous release artifact / git SHA before deploy
- [ ] Restore previous application file set from last known good package
- [ ] If migrations applied: restore DB from pre-migration backup
- [ ] Reload PM2 to previous revision
- [ ] Verify `/ready`, homepage, admin login, one job page
- [ ] Disable feature flags (`RECRUITMENT_PIPELINE_ENABLED`, lifecycle flags) if regression
- [ ] Confirm Telegram/scheduler quiet after rollback
