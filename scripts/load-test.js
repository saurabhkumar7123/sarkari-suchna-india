#!/usr/bin/env node
"use strict";

const autocannon = require("autocannon");

const BASE_URL = (process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const DURATION_SEC = Math.max(5, Number(process.env.LOAD_TEST_DURATION_SEC || 20));
const CONNECTIONS_SET = [50, 100, 200];
const ENDPOINTS = [
  { name: "Home/List API", path: "/api/jobs?page=1&limit=20" },
  { name: "Finder API", path: "/api/finder-data" }
];
let globalClientCounter = Math.floor(Date.now() / 1000) % 50000;

function fmtMs(n) {
  return `${Number(n || 0).toFixed(2)} ms`;
}

function fmtNum(n) {
  return Number(n || 0).toFixed(2);
}

function runSingle({ url, connections, duration }) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url,
        method: "GET",
        connections,
        duration,
        pipelining: 1,
        // Simulate production traffic behind TLS-terminating proxy + many real users.
        // Avoid single-IP throttling artifacts by assigning a unique forwarded IP per client.
        setupClient: (client) => {
          globalClientCounter += 1;
          const octet3 = Math.floor(globalClientCounter / 200) % 255;
          const octet4 = (globalClientCounter % 200) + 1;
          client.setHeaders({
            "x-forwarded-proto": "https",
            "x-forwarded-for": `10.50.${octet3}.${octet4}`
          });
        }
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}

async function main() {
  console.log(`\nLoad test base URL: ${BASE_URL}`);
  console.log(`Duration per run: ${DURATION_SEC}s`);
  console.log(`Concurrency levels: ${CONNECTIONS_SET.join(", ")}\n`);

  for (const endpoint of ENDPOINTS) {
    console.log(`\n=== Endpoint: ${endpoint.name} (${endpoint.path}) ===`);
    for (const c of CONNECTIONS_SET) {
      const fullUrl = `${BASE_URL}${endpoint.path}`;
      process.stdout.write(`\nRunning ${c} users -> ${fullUrl}\n`);

      try {
        const r = await runSingle({
          url: fullUrl,
          connections: c,
          duration: DURATION_SEC
        });

        const p50 = r.latency && r.latency.p50 != null ? r.latency.p50 : 0;
        const p95 = r.latency && r.latency.p95 != null ? r.latency.p95 : 0;
        const p99 = r.latency && r.latency.p99 != null ? r.latency.p99 : 0;
        const avgLatency = r.latency && r.latency.average != null ? r.latency.average : 0;
        const avgRps = r.requests && r.requests.average != null ? r.requests.average : 0;
        const totalErrors = Number(r.errors || 0) + Number(r.timeouts || 0) + Number(r.non2xx || 0);

        console.log(`RPS(avg): ${fmtNum(avgRps)}`);
        console.log(
          `Latency: avg ${fmtMs(avgLatency)} | p50 ${fmtMs(p50)} | p95 ${fmtMs(p95)} | p99 ${fmtMs(p99)}`
        );
        console.log(
          `Errors: ${totalErrors} (errors=${Number(r.errors || 0)}, timeouts=${Number(
            r.timeouts || 0
          )}, non2xx=${Number(r.non2xx || 0)})`
        );
      } catch (err) {
        console.error(`Failed run for ${endpoint.path} @ ${c}:`, err.message || String(err));
      }
    }
  }

  console.log("\nLoad test complete.\n");
}

main().catch((err) => {
  console.error("Load test crashed:", err.message || String(err));
  process.exit(1);
});
