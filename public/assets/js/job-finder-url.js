/**
 * Job Finder URL state — single source of truth for filter query params.
 * Param names match /api/jobs: qualification, state, department.
 */
(function initJobFinderUrl(global) {
  "use strict";

  const MIN_REQUIRED_FILTERS = 2;
  const JOBS_PATH = "/jobs.html";
  const FILTER_KEYS = ["qualification", "state", "department"];

  const ALLOWED_QUALIFICATIONS = new Set([
    "10th",
    "12th",
    "iti",
    "diploma",
    "graduation",
    "post graduation",
    "phd"
  ]);

  const ALLOWED_STATES = new Set([
    "central",
    "uttar pradesh",
    "bihar",
    "madhya pradesh",
    "rajasthan",
    "other",
    "delhi",
    "uttarakhand"
  ]);

  function normalizeStateSlug(value) {
    const n = normalize(value);
    if (n === "all india") return "central";
    return n;
  }

  const ALLOWED_DEPARTMENTS = new Set([
    "ssc",
    "railway",
    "upsc",
    "bank",
    "police",
    "teaching",
    "defence",
    "health"
  ]);

  function normalize(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** Placeholder / default dropdown values — never count as active filters. */
  function isPlaceholderValue(value) {
    const n = normalize(value);
    if (!n) return true;
    if (n === "all" || n === "select") return true;
    if (/^select(\s|$)/.test(n)) return true;
    if (n === "all departments" || n === "all states" || n === "central" || n === "all india") return true;
    return false;
  }

  function resolveFilterValue(value, allowedSet) {
    if (isPlaceholderValue(value)) return "";
    const n = allowedSet === ALLOWED_STATES ? normalizeStateSlug(value) : normalize(value);
    return allowedSet.has(n) ? n : "";
  }

  function isActiveFilter(key, value) {
    if (!FILTER_KEYS.includes(key)) return false;
    const allowed =
      key === "qualification"
        ? ALLOWED_QUALIFICATIONS
        : key === "state"
          ? ALLOWED_STATES
          : ALLOWED_DEPARTMENTS;
    return resolveFilterValue(value, allowed) !== "";
  }

  function emptyState() {
    return {
      qualification: "",
      state: "",
      department: "",
      jobType: "",
      status: "",
      source: "",
      page: 1,
      limit: 10
    };
  }

  function parseUrl(search) {
    const params = new URLSearchParams(
      search != null ? search : global.location.search
    );
    return {
      qualification: normalize(params.get("qualification")),
      state: normalizeStateSlug(params.get("state")),
      department: normalize(params.get("department")),
      jobType: normalize(params.get("jobType")),
      status: normalize(params.get("status")),
      source: normalize(params.get("source")),
      page: Math.max(1, parseInt(params.get("page"), 10) || 1),
      limit: Math.max(1, Math.min(50, parseInt(params.get("limit"), 10) || 10))
    };
  }

  function validateState(raw) {
    const state = { ...emptyState(), ...raw };
    state.qualification = resolveFilterValue(
      state.qualification,
      ALLOWED_QUALIFICATIONS
    );
    state.state = resolveFilterValue(state.state, ALLOWED_STATES);
    state.department = resolveFilterValue(state.department, ALLOWED_DEPARTMENTS);
    state.jobType = isPlaceholderValue(state.jobType) ? "" : normalize(state.jobType);
    state.status = isPlaceholderValue(state.status) ? "" : normalize(state.status);
    state.source = state.source === "finder" ? "finder" : "";
    state.page = Math.max(1, parseInt(state.page, 10) || 1);
    state.limit = Math.max(1, Math.min(50, parseInt(state.limit, 10) || 10));
    return state;
  }

  function countActiveFilters(state) {
    const validated = validateState(state);
    return FILTER_KEYS.reduce(
      (count, key) => count + (validated[key] ? 1 : 0),
      0
    );
  }

  /**
   * @param {object} state
   * @param {{ fromFinder?: boolean }} options
   * @returns {string} query string without leading ?
   */
  function serializeUrl(state, options) {
    const fromFinder = Boolean(options && options.fromFinder);
    const validated = validateState(state);
    const params = new URLSearchParams();
    const activeCount = countActiveFilters(validated);

    FILTER_KEYS.forEach((key) => {
      if (validated[key]) params.set(key, validated[key]);
    });

    if (validated.jobType) params.set("jobType", validated.jobType);
    if (validated.status) params.set("status", validated.status);

    if (
      (fromFinder || validated.source === "finder") &&
      activeCount >= MIN_REQUIRED_FILTERS
    ) {
      params.set("source", "finder");
    }

    if (validated.page > 1) params.set("page", String(validated.page));
    if (validated.limit !== 10) params.set("limit", String(validated.limit));

    return params.toString();
  }

  function buildJobsPagePath(state, options) {
    const query = serializeUrl(state, { fromFinder: true, ...(options || {}) });
    return query ? `${JOBS_PATH}?${query}` : JOBS_PATH;
  }

  function readFromInputs(inputs) {
    return {
      qualification: normalize(inputs && inputs.qualification),
      state: normalize(inputs && inputs.state),
      department: normalize(inputs && inputs.department)
    };
  }

  global.JobFinderUrl = {
    MIN_REQUIRED_FILTERS,
    JOBS_PATH,
    FILTER_KEYS,
    ALLOWED_QUALIFICATIONS,
    ALLOWED_STATES,
    ALLOWED_DEPARTMENTS,
    normalize,
    isPlaceholderValue,
    isActiveFilter,
    resolveFilterValue,
    parseUrl,
    validateState,
    countActiveFilters,
    serializeUrl,
    buildJobsPagePath,
    readFromInputs
  };
})(window);
