"use strict";

const {
  MAX_PREVIEW_ENTRIES,
  pushRuntimePreview,
  recordRuntimePreviewFromPipeline,
  listRuntimePreviews,
  getRuntimePreviewById,
  clearRuntimePreviewBuffer,
  getRuntimePreviewSize,
  resetRuntimePreviewBuffer
} = require("../server/lib/recruitment/runtimePreviewBuffer");

describe("runtimePreviewBuffer", () => {
  beforeEach(() => {
    resetRuntimePreviewBuffer();
  });

  function sampleResult(overrides = {}) {
    return {
      status: "no_match",
      warnings: ["NO_CANDIDATES"],
      eventType: "admit_card",
      selectedRecruitment: null,
      reviewItem: null,
      ...overrides
    };
  }

  test("stores preview entry fields", () => {
    const entry = pushRuntimePreview({
      monitoredSite: { id: 7, name: "SSC", url: "https://ssc.nic.in" },
      notice: {
        title: "SSC CGL 2026 Admit Card",
        content: "SSC CGL 2026 Admit Card",
        url: "https://ssc.nic.in/admit.pdf"
      },
      processorResult: sampleResult({
        selectedRecruitment: { id: 42, exam_name: "CGL" }
      })
    });

    expect(entry.id).toBe("1");
    expect(entry.timestamp).toEqual(expect.any(String));
    expect(entry.monitoredSite).toEqual({
      id: 7,
      name: "SSC",
      url: "https://ssc.nic.in"
    });
    expect(entry.noticeTitle).toBe("SSC CGL 2026 Admit Card");
    expect(entry.normalizedNotice).toEqual(expect.any(String));
    expect(entry.normalizedNotice.toLowerCase()).toContain("admit");
    expect(entry.eventType).toBe("admit_card");
    expect(entry.warnings).toEqual(["NO_CANDIDATES"]);
    expect(entry.selectedRecruitment).toEqual({ id: 42, exam_name: "CGL" });
    expect(entry.processorResult.status).toBe("no_match");
    expect(getRuntimePreviewSize()).toBe(1);
  });

  test("enforces max capacity of 100", () => {
    for (let i = 0; i < MAX_PREVIEW_ENTRIES + 15; i += 1) {
      pushRuntimePreview({
        notice: { title: `Notice ${i}`, content: `Notice ${i}`, url: "" },
        processorResult: sampleResult({ eventType: "result" })
      });
    }

    expect(getRuntimePreviewSize()).toBe(MAX_PREVIEW_ENTRIES);
    const listed = listRuntimePreviews({ limit: 50, page: 1 });
    expect(listed.pagination.bufferSize).toBe(MAX_PREVIEW_ENTRIES);
    expect(listed.pagination.bufferCapacity).toBe(100);
  });

  test("FIFO eviction discards oldest entries first", () => {
    for (let i = 1; i <= MAX_PREVIEW_ENTRIES; i += 1) {
      pushRuntimePreview({
        notice: { title: `Keep ${i}`, content: `Keep ${i}`, url: "" },
        processorResult: sampleResult()
      });
    }

    const oldestKeptId = String(1);
    const newestId = String(MAX_PREVIEW_ENTRIES);
    expect(getRuntimePreviewById(oldestKeptId)).not.toBeNull();
    expect(getRuntimePreviewById(newestId)).not.toBeNull();

    pushRuntimePreview({
      notice: { title: "Overflow", content: "Overflow", url: "" },
      processorResult: sampleResult({ eventType: "result" })
    });

    expect(getRuntimePreviewById(oldestKeptId)).toBeNull();
    expect(getRuntimePreviewById(String(2))).not.toBeNull();
    expect(getRuntimePreviewById(String(MAX_PREVIEW_ENTRIES + 1))).not.toBeNull();
    expect(getRuntimePreviewSize()).toBe(MAX_PREVIEW_ENTRIES);
  });

  test("filters by event type and site", () => {
    pushRuntimePreview({
      monitoredSite: { id: 1, name: "SSC", url: "https://ssc.nic.in" },
      notice: { title: "Admit", content: "Admit", url: "" },
      processorResult: sampleResult({ eventType: "admit_card" })
    });
    pushRuntimePreview({
      monitoredSite: { id: 2, name: "UPSC", url: "https://upsc.gov.in" },
      notice: { title: "Result", content: "Result", url: "" },
      processorResult: sampleResult({ eventType: "result" })
    });

    const byType = listRuntimePreviews({ event_type: "admit_card" });
    expect(byType.data).toHaveLength(1);
    expect(byType.data[0].eventType).toBe("admit_card");

    const bySite = listRuntimePreviews({ site: "upsc" });
    expect(bySite.data).toHaveLength(1);
    expect(bySite.data[0].monitoredSite.name).toBe("UPSC");

    const bySiteId = listRuntimePreviews({ site_id: 1 });
    expect(bySiteId.data).toHaveLength(1);
    expect(bySiteId.data[0].monitoredSite.id).toBe(1);
  });

  test("clear empties the buffer", () => {
    pushRuntimePreview({
      notice: { title: "A", content: "A", url: "" },
      processorResult: sampleResult()
    });
    const cleared = clearRuntimePreviewBuffer();
    expect(cleared).toEqual({ cleared: true, removed: 1 });
    expect(getRuntimePreviewSize()).toBe(0);
    expect(listRuntimePreviews().data).toEqual([]);
  });

  test("recordRuntimePreviewFromPipeline skips skipped and failed outcomes", () => {
    expect(
      recordRuntimePreviewFromPipeline({
        pipelineOutcome: { skipped: true, reason: "flag_off" },
        notice: { title: "X", content: "X", url: "" }
      })
    ).toBeNull();

    expect(
      recordRuntimePreviewFromPipeline({
        pipelineOutcome: { skipped: false, failed: true, error: new Error("boom") },
        notice: { title: "X", content: "X", url: "" }
      })
    ).toBeNull();

    expect(getRuntimePreviewSize()).toBe(0);

    const stored = recordRuntimePreviewFromPipeline({
      pipelineOutcome: { skipped: false, result: sampleResult() },
      monitoredSite: { id: 9, name: "IBPS", url: "https://ibps.in" },
      notice: { title: "IBPS PO", content: "IBPS PO", url: "" }
    });

    expect(stored).not.toBeNull();
    expect(getRuntimePreviewSize()).toBe(1);
  });
});
