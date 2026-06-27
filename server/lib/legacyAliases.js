"use strict";

/** Legacy DB / URL values mapped to canonical state slugs on read. */
const LEGACY_STATE_ALIASES = new Map([["all india", "central"]]);

/** Legacy department slugs mapped to canonical board slugs on read. */
const LEGACY_DEPARTMENT_ALIASES = new Map([["defence", "army"]]);

module.exports = {
  LEGACY_STATE_ALIASES,
  LEGACY_DEPARTMENT_ALIASES
};
