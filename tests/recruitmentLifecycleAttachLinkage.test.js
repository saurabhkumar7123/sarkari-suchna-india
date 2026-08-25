"use strict";

/**
 * ATTACH linkage: update / draft / review must share recruitment_id + recruitment_event_id.
 * Same update → same event; different update → different event. No duplicate event fabrication.
 */

describe("resolveNeedsMatching ATTACH event linkage", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function mockLifecycleDeps({ reviewEventType = "admit_card" } = {}) {
    const eventsByRecruitment = new Map();
    let nextEventId = 100;
    const drafts = new Map();
    const reviews = new Map();
    const updates = new Map();

    reviews.set(13, {
      id: 13,
      update_id: 6,
      recruitment_id: null,
      recruitment_event_id: null,
      event_type: reviewEventType,
      title: "SSC JE Admit Card",
      status: "needs_matching",
      processor_output: { draftId: 6 },
      raw_notice: { title: "SSC JE Admit Card" }
    });
    drafts.set(6, {
      id: 6,
      status: "draft",
      title: "SSC JE Admit Card",
      payload: { title: "SSC JE Admit Card" },
      recruitment_id: null,
      recruitment_event_id: null
    });
    updates.set(6, {
      id: 6,
      recruitment_id: null,
      recruitment_event_id: null
    });

    jest.doMock("../server/services/recruitment.service", () => ({
      createRecruitment: jest.fn(),
      getRecruitment: jest.fn(async (id) => ({ id }))
    }));

    jest.doMock("../server/services/recruitmentEvent.service", () => ({
      listRecruitmentEvents: jest.fn(async ({ recruitment_id }) => {
        const list = eventsByRecruitment.get(Number(recruitment_id)) || [];
        return { data: list.slice().reverse() };
      }),
      createRecruitmentEvent: jest.fn(async (input) => {
        const row = {
          id: nextEventId++,
          recruitment_id: Number(input.recruitment_id),
          event_type: input.event_type,
          status: input.status || "active",
          sequence_order: input.sequence_order
        };
        const list = eventsByRecruitment.get(row.recruitment_id) || [];
        list.push(row);
        eventsByRecruitment.set(row.recruitment_id, list);
        return row;
      })
    }));

    jest.doMock("../server/services/recruitmentUpdateLink.service", () => ({
      linkUpdate: jest.fn(async ({ update_id, recruitment_id, recruitment_event_id }) => {
        const row = updates.get(Number(update_id)) || { id: Number(update_id) };
        row.recruitment_id = recruitment_id;
        row.recruitment_event_id = recruitment_event_id;
        updates.set(Number(update_id), row);
        return row;
      })
    }));

    jest.doMock("../server/services/generatorDraft.service", () => ({
      getDraftById: jest.fn(async (id) => drafts.get(Number(id)) || null),
      saveDraft: jest.fn(async ({ id, payload, recruitmentId, recruitmentEventId }) => {
        const row = drafts.get(Number(id));
        row.payload = payload;
        row.recruitment_id = recruitmentId;
        row.recruitment_event_id = recruitmentEventId;
        drafts.set(Number(id), row);
        return row;
      }),
      bindDraftRecruitmentLinkage: jest.fn(async (id, { recruitmentId, recruitmentEventId }) => {
        const row = drafts.get(Number(id));
        row.recruitment_id = recruitmentId;
        row.recruitment_event_id = recruitmentEventId;
        drafts.set(Number(id), row);
        return row;
      })
    }));

    jest.doMock("../server/services/recruitmentReview.service", () => ({
      getReviewItemById: jest.fn(async (id) => reviews.get(Number(id)) || null),
      updateReviewDecision: jest.fn(async (id, input) => {
        const row = reviews.get(Number(id));
        row.decision = input.decision;
        row.notes = input.notes;
        row.status = "resolved";
        reviews.set(Number(id), row);
        return row;
      }),
      bindReviewItemRecruitment: jest.fn(async (id, recruitmentId, recruitmentEventId) => {
        const row = reviews.get(Number(id));
        row.recruitment_id = recruitmentId;
        if (recruitmentEventId !== undefined) {
          row.recruitment_event_id = recruitmentEventId;
        }
        reviews.set(Number(id), row);
        return row;
      }),
      saveReviewItem: jest.fn()
    }));

    jest.doMock("../server/services/pageCandidateLookup.service", () => ({
      lookupPageCandidatesForRuntime: jest.fn(async () => [])
    }));

    const lifecycle = require("../server/services/recruitmentLifecycle.service");
    const reviewService = require("../server/services/recruitmentReview.service");
    const eventService = require("../server/services/recruitmentEvent.service");

    return {
      lifecycle,
      reviewService,
      eventService,
      stores: { eventsByRecruitment, drafts, reviews, updates }
    };
  }

  test("ATTACH links update, draft, and review to the same event", async () => {
    const { lifecycle, reviewService, eventService, stores } = mockLifecycleDeps();

    const result = await lifecycle.resolveNeedsMatching({
      reviewId: 13,
      action: "attach",
      recruitmentId: 9,
      eventType: "admit_card",
      notes: "Human attach"
    });

    expect(result.ok).toBe(true);
    expect(result.recruitmentId).toBe(9);
    expect(result.recruitmentEventId).toBe(100);

    expect(stores.updates.get(6)).toMatchObject({
      recruitment_id: 9,
      recruitment_event_id: 100
    });
    expect(stores.drafts.get(6)).toMatchObject({
      recruitment_id: 9,
      recruitment_event_id: 100
    });
    expect(stores.reviews.get(13)).toMatchObject({
      recruitment_id: 9,
      recruitment_event_id: 100
    });
    expect(reviewService.bindReviewItemRecruitment).toHaveBeenCalledWith(13, 9, 100);
    expect(eventService.createRecruitmentEvent).toHaveBeenCalledTimes(1);
    const draftService = require("../server/services/generatorDraft.service");
    expect(draftService.bindDraftRecruitmentLinkage).toHaveBeenCalledWith(6, {
      recruitmentId: 9,
      recruitmentEventId: 100
    });
  });

  test("same update reuses active event; no duplicate event", async () => {
    const { lifecycle, eventService, stores } = mockLifecycleDeps();

    const first = await lifecycle.resolveNeedsMatching({
      reviewId: 13,
      action: "attach",
      recruitmentId: 9,
      eventType: "admit_card"
    });

    // Reset review/update/draft linkage but keep active event (second attach path reuse).
    stores.reviews.set(13, {
      ...stores.reviews.get(13),
      recruitment_id: null,
      recruitment_event_id: null,
      status: "needs_matching",
      processor_output: { draftId: 6 }
    });
    stores.updates.set(6, { id: 6, recruitment_id: null, recruitment_event_id: null });
    stores.drafts.set(6, {
      ...stores.drafts.get(6),
      recruitment_id: null,
      recruitment_event_id: null,
      status: "draft"
    });

    const second = await lifecycle.resolveNeedsMatching({
      reviewId: 13,
      action: "attach",
      recruitmentId: 9,
      eventType: "admit_card"
    });

    expect(first.recruitmentEventId).toBe(second.recruitmentEventId);
    expect(eventService.createRecruitmentEvent).toHaveBeenCalledTimes(1);
    expect(stores.eventsByRecruitment.get(9)).toHaveLength(1);
  });

  test("different event types create different events", async () => {
    const { lifecycle, eventService, stores } = mockLifecycleDeps();

    const admit = await lifecycle.resolveNeedsMatching({
      reviewId: 13,
      action: "attach",
      recruitmentId: 9,
      eventType: "admit_card"
    });

    stores.reviews.set(14, {
      id: 14,
      update_id: 7,
      recruitment_id: null,
      recruitment_event_id: null,
      event_type: "result",
      title: "SSC JE Result",
      status: "needs_matching",
      processor_output: { draftId: 7 },
      raw_notice: { title: "SSC JE Result" }
    });
    stores.updates.set(7, { id: 7, recruitment_id: null, recruitment_event_id: null });
    stores.drafts.set(7, {
      id: 7,
      status: "draft",
      title: "SSC JE Result",
      payload: { title: "SSC JE Result" },
      recruitment_id: null,
      recruitment_event_id: null
    });

    const resultEvt = await lifecycle.resolveNeedsMatching({
      reviewId: 14,
      action: "attach",
      recruitmentId: 9,
      eventType: "result"
    });

    expect(admit.recruitmentEventId).not.toBe(resultEvt.recruitmentEventId);
    expect(eventService.createRecruitmentEvent).toHaveBeenCalledTimes(2);
    expect(stores.updates.get(7).recruitment_event_id).toBe(resultEvt.recruitmentEventId);
    expect(stores.reviews.get(14).recruitment_event_id).toBe(resultEvt.recruitmentEventId);
  });
});
