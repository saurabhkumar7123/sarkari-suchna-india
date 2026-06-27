"use strict";

const MAX_GENERATOR_DRAFTS = 20;

function isGeneratorDraftsEnabled() {
  const raw = String(process.env.GENERATOR_DRAFTS_ENABLED ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

module.exports = {
  MAX_GENERATOR_DRAFTS,
  isGeneratorDraftsEnabled
};
