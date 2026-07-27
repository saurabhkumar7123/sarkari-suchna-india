"use strict";

/**
 * Phase AI-5 — Pipeline diagrams (Mermaid + ASCII) for deliverables.
 */

const { deepFreeze } = require("../noticeIntelligence/textUtils");
const { PIPELINE_STAGE_ORDER, PIPELINE_STAGE_LABELS } = require("./types");

/**
 * @returns {object}
 */
function renderPipelineDiagrams() {
  const labels = PIPELINE_STAGE_ORDER.map((id) => PIPELINE_STAGE_LABELS[id]);

  const ascii = [
    "Monitoring Input",
    "      ↓",
    "Notice Intelligence",
    "      ↓",
    "Recruitment Matching",
    "      ↓",
    "PDF / HTML Extraction",
    "      ↓",
    "Editorial Intelligence",
    "      ↓",
    "Draft Generation",
    "      ↓",
    "Telegram Payload",
    "      ↓",
    "Editorial Queue",
    "      ↓",
    "Manual Publish Gate",
    "",
    "(AI-5 validates each stage; does not publish / schedule / auto-publish)"
  ].join("\n");

  const mermaidFlow = [
    "flowchart TD",
    "  MI[Monitoring Input] --> NI[Notice Intelligence]",
    "  NI --> RM[Recruitment Matching]",
    "  RM --> EX[PDF / HTML Extraction]",
    "  EX --> EI[Editorial Intelligence]",
    "  EI --> DG[Draft Generation]",
    "  DG --> TG[Telegram Payload]",
    "  TG --> EQ[Editorial Queue]",
    "  EQ --> MP[Manual Publish Gate]",
    "  MP -.->|confirm=false| HOLD[Hold — no publish]",
    "  classDef advisory fill:#f5f5f5,stroke:#666,color:#222;",
    "  class MI,NI,RM,EX,EI,DG,TG,EQ,MP,HOLD advisory;"
  ].join("\n");

  const mermaidIntelligence = [
    "flowchart LR",
    "  subgraph AI1[Phase AI-1 Extraction]",
    "    N1[Normalize] --> S1[Sections] --> P1[Publisher text]",
    "  end",
    "  subgraph AI2[Phase AI-2 Notice Intelligence]",
    "    N2[Content] --> C2[Classify] --> E2[Normalized event]",
    "  end",
    "  subgraph AI3[Phase AI-3 Matching]",
    "    M3[Candidates] --> R3[Recommend]",
    "  end",
    "  subgraph AI4[Phase AI-4 Editorial]",
    "    Q4[Quality] --> S4[Suggestions]",
    "  end",
    "  subgraph AI5[Phase AI-5 Validation]",
    "    V5[Stage diagnostics] --> O5[Operational report]",
    "  end",
    "  AI2 --> AI3 --> AI4",
    "  AI1 --> AI4",
    "  AI1 --> AI5",
    "  AI2 --> AI5",
    "  AI3 --> AI5",
    "  AI4 --> AI5"
  ].join("\n");

  const stageTable = PIPELINE_STAGE_ORDER.map((id, index) => ({
    order: index + 1,
    stageId: id,
    label: PIPELINE_STAGE_LABELS[id]
  }));

  return deepFreeze({
    ascii,
    mermaidFlow,
    mermaidIntelligence,
    stageTable,
    labels
  });
}

module.exports = {
  renderPipelineDiagrams
};
