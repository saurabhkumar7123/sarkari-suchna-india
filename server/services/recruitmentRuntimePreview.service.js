"use strict";

/**
 * Phase 31.B — thin service layer for Recruitment Runtime Preview.
 *
 * Backed by the process-local in-memory FIFO buffer (Phase 30).
 * No Redis, no MySQL, no review-queue writes.
 *
 * Known limitation: buffer state is process-local. Under PM2 (separate
 * web cluster vs worker process), admin APIs only see entries recorded
 * in the same Node process. See docs/recruitment-runtime-preview.md.
 */

const runtimePreviewBuffer = require("../lib/recruitment/runtimePreviewBuffer");

function listRuntimePreviews(query = {}) {
  return runtimePreviewBuffer.listRuntimePreviews(query);
}

function getRuntimePreviewById(id) {
  return runtimePreviewBuffer.getRuntimePreviewById(id);
}

function clearRuntimePreviewBuffer() {
  return runtimePreviewBuffer.clearRuntimePreviewBuffer();
}

function recordRuntimePreviewFromPipeline(input) {
  return runtimePreviewBuffer.recordRuntimePreviewFromPipeline(input);
}

function getRuntimePreviewSize() {
  return runtimePreviewBuffer.getRuntimePreviewSize();
}

function getRuntimePreviewCapacity() {
  return runtimePreviewBuffer.getRuntimePreviewCapacity();
}

module.exports = {
  listRuntimePreviews,
  getRuntimePreviewById,
  clearRuntimePreviewBuffer,
  recordRuntimePreviewFromPipeline,
  getRuntimePreviewSize,
  getRuntimePreviewCapacity
};
