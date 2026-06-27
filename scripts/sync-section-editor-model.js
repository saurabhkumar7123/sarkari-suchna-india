"use strict";

const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "../server/utils/sectionEditorModel.js");
const browserPath = path.join(__dirname, "../public/assets/js/sectionEditorModel.js");

let body = fs.readFileSync(serverPath, "utf8");
body = body.replace(/^"use strict";\s*/, "").replace(/^\/\*\*[\s\S]*?\*\/\s*/, "");

const expMatch = body.match(/module\.exports = \{([\s\S]*)\};\s*$/);
if (!expMatch) {
  throw new Error("module.exports not found");
}

const exportBlock = expMatch[1];
const core = body.replace(/module\.exports = \{[\s\S]*\};\s*$/, "");

const out = `/**
 * Browser mirror of server/utils/sectionEditorModel.js — keep in sync.
 */
(function (global) {
  "use strict";

${core}  global.SectionEditorModel = {${exportBlock}};
})(typeof window !== "undefined" ? window : globalThis);
`;

fs.writeFileSync(browserPath, out);
console.log("Synced sectionEditorModel.js", out.length, "bytes");
