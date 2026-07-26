"use strict";

/**
 * CIP Stage 3A — Official / mirror domain rules (deterministic, no network).
 *
 * Reuses Program MB-1 government source registry domains as read-only
 * advisory hints. Does not modify that registry or perform HTTP.
 */

const {
  DEFAULT_SOURCE_CONFIG
} = require("../../project/monitoringBot/governmentSourceRegistry");

/** Host suffixes treated as official Indian government surfaces. */
const OFFICIAL_HOST_SUFFIXES = Object.freeze([
  ".gov.in",
  ".nic.in",
  ".gov",
  ".mil.in"
]);

/**
 * Additional official / quasi-official hosts from known boards
 * that may not end with .gov.in (e.g. NTA, IBPS).
 * Built once from the frozen government registry + explicit extras.
 */
const EXTRA_OFFICIAL_HOSTS = Object.freeze([
  "nta.ac.in",
  "ibps.in",
  "sbi.co.in",
  "indianarmy.nic.in"
]);

/**
 * Known aggregator / mirror hosts. Never invent beyond this list.
 * Matching is exact hostname or subdomain-of.
 */
const KNOWN_MIRROR_HOSTS = Object.freeze([
  "sarkariresult.com",
  "sarkariresults.info",
  "sarkari-result.com",
  "freejobalert.com",
  "rojgarresult.com",
  "sarkarinaukriblog.com",
  "govtjobsblog.in",
  "resultbharat.com",
  "indiagovtjobs.in"
]);

function extractHostname(urlOrHost) {
  if (urlOrHost == null) return null;
  const raw = String(urlOrHost).trim().toLowerCase();
  if (!raw) return null;
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/^www\./, "") || null;
  } catch {
    const cleaned = raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split("?")[0]
      .trim();
    return cleaned || null;
  }
}

function hostMatches(host, candidate) {
  if (!host || !candidate) return false;
  return host === candidate || host.endsWith(`.${candidate}`);
}

function buildRegistryOfficialHosts() {
  const hosts = [];
  const seen = Object.create(null);
  for (const source of DEFAULT_SOURCE_CONFIG) {
    const urls = [
      source.baseUrl,
      source.recruitmentUrl,
      source.resultUrl,
      source.noticeUrl
    ];
    for (const url of urls) {
      const host = extractHostname(url);
      if (!host || seen[host]) continue;
      seen[host] = true;
      hosts.push(host);
    }
  }
  for (const host of EXTRA_OFFICIAL_HOSTS) {
    if (seen[host]) continue;
    seen[host] = true;
    hosts.push(host);
  }
  return Object.freeze(hosts.slice().sort());
}

const REGISTRY_OFFICIAL_HOSTS = buildRegistryOfficialHosts();

function isOfficialHostSuffix(host) {
  if (!host) return false;
  for (const suffix of OFFICIAL_HOST_SUFFIXES) {
    if (host === suffix.slice(1) || host.endsWith(suffix)) return true;
  }
  return false;
}

function isRegistryOfficialHost(host) {
  if (!host) return false;
  for (const candidate of REGISTRY_OFFICIAL_HOSTS) {
    if (hostMatches(host, candidate)) return true;
  }
  return false;
}

function isKnownMirrorHost(host) {
  if (!host) return false;
  for (const candidate of KNOWN_MIRROR_HOSTS) {
    if (hostMatches(host, candidate)) return true;
  }
  return false;
}

/**
 * Resolve official domain for a source when deterministically known.
 * @param {string|null} sourceDomain
 * @param {string|null} [hintOfficialDomain]
 * @returns {{ officialDomain: string|null, isOfficial: boolean, reason: string|null }}
 */
function resolveOfficialDomain(sourceDomain, hintOfficialDomain) {
  const hintHost = extractHostname(hintOfficialDomain);
  if (hintHost && sourceDomain && hostMatches(sourceDomain, hintHost)) {
    return {
      officialDomain: hintHost,
      isOfficial: true,
      reason: "source_domain_matches_official_domain_hint"
    };
  }

  if (sourceDomain && isOfficialHostSuffix(sourceDomain)) {
    return {
      officialDomain: sourceDomain,
      isOfficial: true,
      reason: "source_domain_has_official_host_suffix"
    };
  }

  if (sourceDomain && isRegistryOfficialHost(sourceDomain)) {
    return {
      officialDomain: sourceDomain,
      isOfficial: true,
      reason: "source_domain_in_government_source_registry"
    };
  }

  if (hintHost && (isOfficialHostSuffix(hintHost) || isRegistryOfficialHost(hintHost))) {
    return {
      officialDomain: hintHost,
      isOfficial: false,
      reason: "official_domain_hint_provided_source_differs"
    };
  }

  return {
    officialDomain: hintHost || null,
    isOfficial: false,
    reason: null
  };
}

module.exports = {
  OFFICIAL_HOST_SUFFIXES,
  EXTRA_OFFICIAL_HOSTS,
  KNOWN_MIRROR_HOSTS,
  REGISTRY_OFFICIAL_HOSTS,
  extractHostname,
  hostMatches,
  isOfficialHostSuffix,
  isRegistryOfficialHost,
  isKnownMirrorHost,
  resolveOfficialDomain
};
