"use strict";

/**
 * CIP Stage 3A — Source reliability assessment.
 * Never guesses: official only from deterministic domain rules;
 * mirror only from known mirror host list; else unknown.
 */

const { RELIABILITY_CLASSES } = require("./sourceTypes");
const {
  extractHostname,
  isKnownMirrorHost,
  resolveOfficialDomain
} = require("./officialDomains");

/**
 * @param {object} input
 * @param {string|null} sourceDomain
 * @returns {{
 *   class: string,
 *   confidence: string,
 *   reasons: string[],
 *   warnings: string[],
 *   officialDomain: string|null,
 *   isOfficial: boolean,
 *   isMirror: boolean
 * }}
 */
function assessReliability(input = {}, sourceDomain = null) {
  const reasons = [];
  const warnings = [];
  const declared = String(input.reliabilityHint || input.reliabilityClass || "")
    .trim()
    .toLowerCase();

  const domainResolution = resolveOfficialDomain(
    sourceDomain,
    input.officialDomain || input.officialWebsite || null
  );

  const isMirror = isKnownMirrorHost(sourceDomain);

  if (isMirror) {
    reasons.push("source_domain_matches_known_mirror_host");
    warnings.push("Source domain is a known aggregator/mirror — verify against official site.");
    return {
      class: RELIABILITY_CLASSES.MIRROR,
      confidence: "high",
      reasons,
      warnings,
      officialDomain: domainResolution.officialDomain,
      isOfficial: false,
      isMirror: true
    };
  }

  if (domainResolution.isOfficial) {
    reasons.push(domainResolution.reason);
    return {
      class: RELIABILITY_CLASSES.OFFICIAL,
      confidence: "high",
      reasons,
      warnings,
      officialDomain: domainResolution.officialDomain,
      isOfficial: true,
      isMirror: false
    };
  }

  if (domainResolution.reason === "official_domain_hint_provided_source_differs") {
    reasons.push(domainResolution.reason);
    warnings.push(
      "Official domain hint differs from source domain — treating source as unknown, not official."
    );
  }

  // Declared reliability is advisory only when it does not conflict with domain facts.
  if (
    declared === RELIABILITY_CLASSES.OFFICIAL ||
    declared === "official" ||
    declared === "official_source"
  ) {
    warnings.push(
      "Declared official reliability ignored without deterministic domain evidence."
    );
  }

  if (!sourceDomain) {
    warnings.push("Source domain unavailable — reliability cannot be confirmed.");
    reasons.push("missing_source_domain");
  } else {
    reasons.push("no_deterministic_official_or_mirror_match");
  }

  return {
    class: RELIABILITY_CLASSES.UNKNOWN,
    confidence: sourceDomain ? "medium" : "low",
    reasons,
    warnings,
    officialDomain: domainResolution.officialDomain,
    isOfficial: false,
    isMirror: false
  };
}

module.exports = {
  assessReliability,
  extractHostname
};
