# Monitoring Policy Report — RC-1 Production Rollout

**Status:** ENFORCED  
**Verified:** 2026-07-20T07:00:25Z (approx)  
**Host:** production `/root/sarkari-suchna-india`

## Policy

Monitoring Bot may monitor **only approved official government recruitment sources**.

Permanently disabled (no crawl / schedule / fetch / retry / queue / parse / health for these hosts):

- `https://sarkariresult.com.cm/*` (all pages, including admit-card)
- Any other non-approved third-party/private recruitment websites

## Before

| id | active | name | url |
|----|--------|------|-----|
| 1 | 0 | SSC | https://ssc.gov.in/ |
| 2 | 1 | UPSC | https://www.upsc.gov.in/ |
| 3 | 0 | SarkariResult Results | https://sarkariresult.com.cm/result/ |
| 4 | **1** | SarkariResult Latest Jobs | https://sarkariresult.com.cm/latest-jobs/ |
| 5 | 0 | SarkariResult Admit Card | https://sarkariresult.com.cm/admit-card/ |
| 6 | 0 | SarkariResult Answer Key | https://sarkariresult.com.cm/answer-key/ |

## Actions

1. Hard-disabled all `sarkariresult.com.cm` rows (`is_active=0`, `broken=1`, `fail_count=999`, cleared content/retry)
2. Renamed rows with `[DISABLED-THIRD-PARTY]` prefix (retained for audit; not deleted)
3. Ensured approved official sources active: SSC, UPSC, IBPS, RRB
4. Kept NTA inactive (approved inactive)
5. Removed 4 BullMQ `site-check-queue` completed/queued jobs tied to disabled site IDs 3–6

## After — Active whitelist only

| id | name | url |
|----|------|-----|
| 1 | SSC | https://ssc.gov.in/ |
| 2 | UPSC | https://www.upsc.gov.in/ |
| 11 | IBPS | https://www.ibps.in/ |
| 12 | RRB | https://www.rrbcdg.gov.in/ |

Inactive retained:

- NTA → https://nta.ac.in/ (`is_active=0`)
- All `[DISABLED-THIRD-PARTY] SarkariResult *` rows (`is_active=0`)

## Verification

- `third_party_active_count = 0`
- Queue third-party jobs = 0
- Monitoring Bot does not schedule/fetch `sarkariresult.com.cm/*`

**Monitoring Policy Status:** ENFORCED  
