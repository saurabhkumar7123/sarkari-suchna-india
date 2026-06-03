#!/usr/bin/env node
"use strict";

/**
 * One-off verification page for rich inline text. Safe to delete after QA.
 * Usage: node scripts/generate-rich-text-verify-page.js
 */
const path = require("path");
const pipeline = require("../generator/pipeline/generatePage");

const VERIFY_SLUG = "rich-text-verify";

const VERIFY_TEXT = `[Section: Rich Text Verification]
This paragraph tests [b]bold text[/b], [highlight]highlighted text[/highlight], and a [br]line break below.
Next line after break.

[Section: All Supported Colors]
[color=red]Red sample text[/color]
[color=green]Green sample text[/color]
[color=blue]Blue sample text[/color]
[color=orange]Orange sample text[/color]
[color=purple]Purple sample text[/color]
[color=gray]Gray sample text[/color]
[color=yellow]Yellow sample text[/color]

[Section: Nested Tags]
[color=red][b]Important nested bold in red[/b][/color]
[color=green][highlight]Application Started nested[/highlight][/color]

[Section: Important Dates]
Last Date: [color=red][b]22 June 2026[/b][/color]
Notification Date: [color=blue]21 May 2026[/color]

[Section: Application Fee]
For General: [color=orange]Rs. 100/-[/color]
For SC/ST: [color=gray]0/-[/color]

[Section: Important Links]
Apply Online: [highlight]Link Active Soon[/highlight]
Official Website=https://example.com

[Section: FAQ]
Q: What is the [b]last date[/b] for apply?
A: The last date is [color=red]22 June 2026[/color]. Read [Official Notice](/files/sample.pdf) for details.

[Section: Table Demo | table]
Item,Detail
Fee,[color=purple][b]Rs. 500[/b][/color]
Link,Apply Online=https://example.com/apply
Note,Line one[br]Line two

[Section: Invalid Color (must stay literal)]
[color=black]Should appear as plain brackets[/color]
`;

async function main() {
  const html = await pipeline.buildJobHtml({
    title: "Rich Text Verification Page",
    text: VERIFY_TEXT,
    slug: VERIFY_SLUG,
    category: "general",
    normalizedStatus: "general",
    postName: "Verification",
    totalPosts: "1"
  });

  await pipeline.writeJobHtmlFile(VERIFY_SLUG, html);
  const filePath = path.join(process.cwd(), "generated", "jobs", `${VERIFY_SLUG}.html`);
  console.log(`Wrote ${filePath}`);
  console.log(`URL path: /${VERIFY_SLUG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
