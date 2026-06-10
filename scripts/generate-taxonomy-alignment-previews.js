"use strict";

const fs = require("fs");
const path = require("path");
const { renderTaxonomySSRPage } = require("../server/lib/renderTaxonomySSRPage");

const outDir = path.join(process.cwd(), "audit-screenshots", "taxonomy-alignment");

const homepageRowSample = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Homepage Row Preview — With Badges</title>
<link rel="stylesheet" href="/css/pages/home.css?v=5">
<style>body{font-family:system-ui,sans-serif;padding:24px;background:#f8fafc}.wrap{max-width:420px;margin:0 auto;background:#fff;border-radius:18px;padding:24px 18px;box-shadow:0 8px 25px rgba(0,0,0,.08)}h1{font-size:14px;color:#64748b;margin:0 0 16px}</style>
</head>
<body class="page-home">
<div class="wrap">
<h1>Homepage #dynamicSections (badges preserved)</h1>
<div id="dynamicSections">
<div class="card"><div class="card-content">
<ul class="job-list">
<li><a href="#">CTET September Online Form 2026 <span class="home-card-badge-group"><span class="home-card-badge-sep" aria-hidden="true">–</span><span class="home-badge home-badge--new">NEW</span></span></a></li>
<li><a href="#">SSC CGL Online Form (12256 posts) <span class="home-card-badge-group"><span class="home-card-badge-sep" aria-hidden="true">–</span><span class="home-badge home-badge--new">NEW</span></span></a></li>
<li><a href="#">UP Police Constable Admit Card 2026 <span class="home-card-badge-group"><span class="home-card-badge-sep" aria-hidden="true">–</span><span class="home-badge home-badge--out">OUT</span></span></a></li>
</ul>
</div></div>
</div>
</div>
</body>
</html>`;

const samples = [
  {
    file: "preview-homepage-with-badges.html",
    html: homepageRowSample
  },
  {
    file: "preview-department-ssc.html",
    html: renderTaxonomySSRPage({
      title: "SSC Government Jobs 2026",
      description: "SSC updates.",
      h1: "SSC Jobs",
      sub: "Latest SSC recruitment updates.",
      canonicalPath: "/department/ssc",
      items: [
        { title: "SSC CGL 2026 Online Form", slug: "ssc-cgl-2026", status: "new form" },
        { title: "SSC GD Constable Admit Card 2026", slug: "ssc-gd-2026", status: "admit card" }
      ]
    })
  },
  {
    file: "preview-qualification-12th.html",
    html: renderTaxonomySSRPage({
      title: "12th Government Jobs 2026",
      description: "12th pass jobs.",
      h1: "12th Jobs",
      sub: "Latest 12th qualification updates.",
      canonicalPath: "/qualification/12th",
      items: [
        { title: "Railway Group D 12th Pass Form", slug: "rrb-group-d-2026", status: "new form" },
        { title: "SSC MTS 12th Online Form", slug: "ssc-mts-2026", status: "new form" }
      ]
    })
  },
  {
    file: "preview-state-uttar-pradesh.html",
    html: renderTaxonomySSRPage({
      title: "Uttar Pradesh Government Jobs 2026",
      description: "UP state jobs.",
      h1: "Uttar Pradesh Jobs",
      sub: "Latest UP state updates.",
      canonicalPath: "/state/uttar-pradesh",
      items: [
        { title: "UP Police Constable 2026", slug: "up-police-2026", status: "admit card" },
        { title: "UPSSSC Lower PCS Online Form 2026", slug: "upsssc-lower-pcs-2026", status: "new form" }
      ]
    })
  }
];

fs.mkdirSync(outDir, { recursive: true });
for (const sample of samples) {
  fs.writeFileSync(path.join(outDir, sample.file), sample.html, "utf8");
}
console.log(`Wrote ${samples.length} preview files to ${outDir}`);
