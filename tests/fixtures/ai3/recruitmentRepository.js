"use strict";

/**
 * Phase AI-3 fixtures.
 *
 * `RECRUITMENTS` is a read-only stand-in for existing recruitment metadata. It
 * deliberately mixes field spellings (`advertisementNumber`, `advtNo`,
 * `organization`, `recruitmentName`) to prove the matcher reads records through
 * aliases rather than requiring one canonical shape.
 *
 * `NOTICES` holds the notices that Phase AI-2 fixtures do not already cover:
 * downstream updates, a re-published duplicate, a new cycle of a known
 * recruitment, an orphan update, and a Hindi announcement.
 */

const RECRUITMENTS = [
  {
    recruitmentId: "REC-UPPSC-UPPER-2026",
    recruitmentKey: "uppsc-upper-subordinate-2026",
    recruitmentName: "UPPSC Combined State / Upper Subordinate Services Examination 2026",
    organization: "Uttar Pradesh Public Service Commission",
    department: "Uttar Pradesh Public Service Commission",
    boardCode: "UPPSC",
    advertisementNumber: "A-1/E-1/2026",
    year: 2026,
    category: "state_psc",
    postNames: ["Naib Tehsildar", "Block Development Officer"],
    keywords: ["UPPSC", "Naib Tehsildar", "Block Development Officer", "Uttar Pradesh", "Graduate"],
    lifecycleStage: "apply_online",
    recordedRelationships: ["notification", "apply_online"],
    documents: [
      {
        relationship: "notification",
        advertisementNumber: "A-1/E-1/2026",
        publicationDate: "2025-09-04",
        title:
          "UPPSC Combined State / Upper Subordinate Services Examination 2026 — Recruitment Advertisement"
      }
    ],
    sourceUrl: "https://uppsc.up.nic.in/Notifications.aspx"
  },
  {
    // Same recruitment name, previous cycle. Exists to prove a repeated title in
    // a new year is not treated as an update.
    recruitmentId: "REC-UPPSC-UPPER-2025",
    recruitmentName: "UPPSC Combined State / Upper Subordinate Services Examination 2025",
    organization: "Uttar Pradesh Public Service Commission",
    department: "Uttar Pradesh Public Service Commission",
    boardCode: "UPPSC",
    advtNo: "A-1/E-1/2025",
    year: 2025,
    category: "state_psc",
    postNames: ["Naib Tehsildar", "Block Development Officer"],
    keywords: ["UPPSC", "Naib Tehsildar", "Uttar Pradesh"],
    lifecycleStage: "final_result",
    recordedRelationships: ["notification", "apply_online", "admit_card", "result", "final_result"]
  },
  {
    // Same board, different recruitment. Also the target of the Hindi result.
    recruitmentId: "REC-UPPSC-RO-ARO-2025",
    recruitmentName: "UPPSC Review Officer / Assistant Review Officer Examination 2025",
    organization: "Uttar Pradesh Public Service Commission",
    department: "Uttar Pradesh Public Service Commission",
    boardCode: "UPPSC",
    advertisementNumber: "A-2/E-1/2025",
    year: 2025,
    category: "state_psc",
    postNames: ["Review Officer", "Assistant Review Officer"],
    keywords: ["UPPSC", "Review Officer", "Assistant Review Officer", "समीक्षा अधिकारी"],
    lifecycleStage: "admit_card",
    recordedRelationships: ["notification", "apply_online", "admit_card"]
  },
  {
    recruitmentId: "REC-SSC-GD-2026",
    recruitmentName: "SSC Constable GD Examination 2026",
    organization: "Staff Selection Commission",
    department: "Staff Selection Commission",
    boardCode: "SSC",
    referenceNumber: "15/2026-CGD",
    year: 2026,
    category: "ssc",
    postNames: ["Constable GD"],
    keywords: ["SSC", "Constable", "GD"],
    lifecycleStage: "apply_online",
    recordedRelationships: ["notification", "apply_online"]
  },
  {
    // The result notice quotes its own notice number, which the recruitment
    // records as an alternate official identifier.
    recruitmentId: "REC-RRB-TECH-2025",
    recruitmentName: "RRB Technician Grade III Recruitment 2025",
    organization: "Railway Recruitment Board",
    department: "Railway Recruitment Board",
    boardCode: "RRB",
    advertisementNumber: "CEN-02/2025",
    officialIdentifiers: ["CEN-02/2025", "RRB/RES/22/2026"],
    year: 2025,
    category: "railway",
    postNames: ["Technician Grade III"],
    keywords: ["RRB", "Technician", "Railway"],
    lifecycleStage: "admit_card",
    recordedRelationships: ["notification", "apply_online", "admit_card"]
  },
  {
    recruitmentId: "REC-UPPRPB-CONST-2025",
    recruitmentName: "UP Police Constable Civil Police Direct Recruitment 2025",
    organization: "Uttar Pradesh Police Recruitment and Promotion Board",
    department: "Uttar Pradesh Police Recruitment and Promotion Board",
    boardCode: "UPPRPB",
    advertisementNumber: "UPPRPB/CONST/02/2025",
    year: 2025,
    category: "police",
    postNames: ["Constable Civil Police"],
    keywords: ["UP Police", "Constable", "Uttar Pradesh"],
    lifecycleStage: "answer_key",
    recordedRelationships: ["notification", "apply_online", "admit_card", "answer_key"]
  },
  {
    recruitmentId: "REC-NTA-CUET-UG-2026",
    recruitmentName: "NTA CUET UG 2026",
    organization: "National Testing Agency",
    department: "National Testing Agency",
    boardCode: "NTA",
    officialIdentifiers: ["NTA/CUET/06/2026", "NTA/CUET/09/2026"],
    year: 2026,
    category: "other",
    keywords: ["NTA", "CUET", "UG"],
    lifecycleStage: "apply_online",
    recordedRelationships: ["notification", "apply_online"]
  },
  {
    recruitmentId: "REC-BPSC-71CCE-2026",
    recruitmentName: "BPSC 71st Combined Competitive Examination 2026",
    organization: "Bihar Public Service Commission",
    department: "Bihar Public Service Commission",
    boardCode: "BPSC",
    advertisementNumber: "05/2026",
    year: 2026,
    category: "state_psc",
    keywords: ["BPSC", "Combined Competitive"],
    lifecycleStage: "apply_online",
    recordedRelationships: ["notification", "apply_online"]
  },
  {
    recruitmentId: "REC-UPSSSC-LEKHPAL-2026",
    recruitmentName: "UPSSSC Lekhpal / लेखपाल Recruitment 2026",
    organization: "Uttar Pradesh Subordinate Services Selection Commission",
    department: "Uttar Pradesh Subordinate Services Selection Commission",
    boardCode: "UPSSSC",
    advertisementNumber: "09-Exam/2026",
    year: 2026,
    category: "subordinate_service",
    postNames: ["Lekhpal"],
    keywords: ["UPSSSC", "Lekhpal"],
    lifecycleStage: "apply_online",
    recordedRelationships: ["notification", "apply_online"]
  },
  {
    recruitmentId: "REC-DSSSB-JE-2025",
    recruitmentName: "DSSSB Junior Engineer Recruitment 2025",
    organization: "Delhi Subordinate Services Selection Board",
    department: "Delhi Subordinate Services Selection Board",
    boardCode: "DSSSB",
    advertisementNumber: "03/2025",
    year: 2025,
    category: "subordinate_service",
    postNames: ["Junior Engineer"],
    keywords: ["DSSSB", "Junior Engineer"],
    lifecycleStage: "apply_online",
    recordedRelationships: ["notification", "apply_online"]
  }
];

/**
 * Two records that describe the same recruitment and carry no identifier at
 * all. An unnumbered notice cannot choose between them, which is exactly what
 * the multiple-strong-match flag exists for.
 */
const DUPLICATED_RECRUITMENTS = [
  {
    recruitmentId: "REC-BSSC-FIELD-ASSISTANT-A",
    recruitmentName: "BSSC Field Assistant Recruitment 2026",
    organization: "Bihar Staff Selection Commission",
    department: "Bihar Staff Selection Commission",
    boardCode: "BSSC",
    year: 2026,
    category: "subordinate_service",
    postNames: ["Field Assistant"],
    keywords: ["BSSC", "Field Assistant"],
    lifecycleStage: "apply_online",
    recordedRelationships: ["notification", "apply_online"]
  },
  {
    recruitmentId: "REC-BSSC-FIELD-ASSISTANT-B",
    recruitmentName: "BSSC Field Assistant Recruitment 2026",
    organization: "Bihar Staff Selection Commission",
    department: "Bihar Staff Selection Commission",
    boardCode: "BSSC",
    year: 2026,
    category: "subordinate_service",
    postNames: ["Field Assistant"],
    keywords: ["BSSC", "Field Assistant"],
    lifecycleStage: "apply_online",
    recordedRelationships: ["notification", "apply_online"]
  }
];

const NOTICES = {
  UPPSC_UPPER_ADMIT_CARD: {
    title: "UPPSC Combined State / Upper Subordinate Services Examination 2026 — Admit Card released",
    sourceUrl: "https://uppsc.up.nic.in/admitcard",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Public Service Commission</h1>
<h2>Admit Card for Preliminary Examination</h2>
<p>Advertisement No. A-1/E-1/2026</p>
<p>Date of Publication : 02/12/2025</p>
<p>Candidates can download the e-admit card for the preliminary examination from the Commission website.</p>
<h3>Important Instructions</h3>
<p>Candidates must carry a printed admit card and a photo identity card to the examination centre.</p>
<a href="https://uppsc.up.nic.in/admitcard/download">Download Admit Card</a>
</body></html>`
  },

  UPPSC_UPPER_NEW_CYCLE: {
    title: "UPPSC Combined State / Upper Subordinate Services Examination 2027 — Recruitment Advertisement",
    sourceUrl: "https://uppsc.up.nic.in/Notifications.aspx",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Public Service Commission</h1>
<p>Advertisement No. A-1/E-1/2027</p>
<p>Dated : 03/09/2026</p>
<p>Online applications are invited for direct recruitment to the following posts.</p>
<h2>Important Dates</h2>
<p>Online Apply Start Date : 03/09/2026</p>
<p>Last Date for Apply Online : 30/09/2026</p>
<h2>Vacancy Details</h2>
<p>Naib Tehsildar : 110 posts</p>
<p>Block Development Officer : 75 posts</p>
<h2>Educational Qualification</h2>
<p>Bachelor Degree in any stream from a recognized university.</p>
</body></html>`
  },

  UPPSC_SAME_BOARD_OTHER_RECRUITMENT: {
    title: "UPPSC Staff Nurse Recruitment 2026 — Recruitment Advertisement",
    sourceUrl: "https://uppsc.up.nic.in/Notifications.aspx",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Public Service Commission</h1>
<p>Advertisement No. A-7/E-1/2026</p>
<p>Dated : 14/05/2026</p>
<p>Online applications are invited for direct recruitment to the post of Staff Nurse.</p>
<h2>Vacancy Details</h2>
<p>Staff Nurse : 340 posts</p>
<h2>Educational Qualification</h2>
<p>B.Sc Nursing or GNM from a recognized institute with valid registration.</p>
</body></html>`
  },

  // The five lifecycle stages the Phase AI-2 fixtures never reach, so all
  // twelve update relationships are exercised end to end.
  UPPSC_APPLY_ONLINE: {
    title: "UPPSC Combined State / Upper Subordinate Services Examination 2026 — Apply Online",
    sourceUrl: "https://uppsc.up.nic.in/apply-online",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Public Service Commission</h1>
<h2>Online Application Portal</h2>
<p>Advertisement No. A-1/E-1/2026</p>
<p>Candidates may now apply online for the Combined State / Upper Subordinate Services Examination 2026.</p>
<h3>Important Dates</h3>
<p>Online Apply Start Date : 08/09/2025</p>
<p>Last Date for Apply Online : 06/10/2025</p>
</body></html>`
  },

  SSC_EXAM_DATE: {
    title: "SSC Constable GD Examination 2026 — Examination Schedule announced",
    sourceUrl: "https://ssc.gov.in/exam-schedule",
    contentType: "text/html",
    html: `<html><body>
<h1>Staff Selection Commission</h1>
<h2>Examination Schedule for Constable GD</h2>
<p>Notice No. 15/2026-CGD</p>
<p>Date of Publication : 07/04/2026</p>
<p>The examination dates for the Constable GD Examination 2026 are hereby announced.</p>
<p>Computer Based Examination : 12/06/2026 to 20/06/2026</p>
</body></html>`
  },

  UPPSC_ANSWER_KEY: {
    title: "UPPSC Review Officer / Assistant Review Officer Examination 2025 — Answer Key",
    sourceUrl: "https://uppsc.up.nic.in/answer-key",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Public Service Commission</h1>
<h2>Answer Key for Preliminary Examination</h2>
<p>Advertisement No. A-2/E-1/2025</p>
<p>Date of Publication : 18/06/2026</p>
<p>The answer key of the Review Officer / Assistant Review Officer preliminary examination is published below.</p>
</body></html>`
  },

  RRB_DV_SCHEDULE: {
    title: "RRB Technician Grade III Recruitment 2025 — Document Verification Schedule",
    sourceUrl: "https://rrbcdg.gov.in/document-verification",
    contentType: "text/html",
    html: `<html><body>
<h1>Railway Recruitment Board</h1>
<h2>Document Verification Schedule</h2>
<p>CEN-02/2025</p>
<p>Date of Publication : 21/07/2026</p>
<p>Shortlisted candidates are called for document verification as per the schedule below.</p>
</body></html>`
  },

  UP_POLICE_JOINING: {
    title: "UP Police Constable Civil Police Direct Recruitment 2025 — Appointment Letters",
    sourceUrl: "https://uppbpb.gov.in/joining",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Police Recruitment and Promotion Board</h1>
<h2>Appointment Letters and Joining Instructions</h2>
<p>Advertisement No. UPPRPB/CONST/02/2025</p>
<p>Date of Publication : 24/07/2026</p>
<p>Selected candidates may download their appointment letter and report for joining formalities at the allotted training centre.</p>
</body></html>`
  },

  ORPHAN_ADMIT_CARD: {
    title: "Jharkhand Staff Selection Commission — Admit Card for Excise Constable 2026",
    sourceUrl: "https://jssc.jharkhand.gov.in/admitcard",
    contentType: "text/html",
    html: `<html><body>
<h1>Jharkhand Staff Selection Commission</h1>
<h2>Admit Card for Excise Constable Competitive Examination</h2>
<p>Advertisement No. JSSC/EXC/11/2026</p>
<p>Date of Publication : 19/08/2026</p>
<p>Candidates may download the admit card for the written examination from the Commission portal.</p>
</body></html>`
  },

  HINDI_NEW_RECRUITMENT: {
    title: "बिहार लोक सेवा आयोग — सहायक अभियंता भर्ती विज्ञापन 2026",
    sourceUrl: "https://bpsc.bih.nic.in/notices/ae-2026",
    contentType: "text/html",
    html: `<html><body>
<h1>बिहार लोक सेवा आयोग</h1>
<h2>सहायक अभियंता के पदों पर सीधी भर्ती हेतु विज्ञापन</h2>
<p>विज्ञापन संख्या 27/2026</p>
<p>दिनांक : 11/10/2026</p>
<p>सहायक अभियंता के रिक्त पदों पर सीधी भर्ती हेतु ऑनलाइन आवेदन आमंत्रित किये जाते हैं।</p>
<h3>महत्वपूर्ण तिथियाँ</h3>
<p>ऑनलाइन आवेदन प्रारंभ तिथि : 11/10/2026</p>
<p>आवेदन की अंतिम तिथि : 10/11/2026</p>
<h3>शैक्षणिक अर्हता</h3>
<p>किसी मान्यता प्राप्त संस्थान से सिविल इंजीनियरिंग में स्नातक उपाधि।</p>
</body></html>`
  },

  UNNUMBERED_FIELD_ASSISTANT_NOTICE: {
    title: "BSSC Field Assistant Recruitment 2026 — Apply Online",
    sourceUrl: "https://bssc.bihar.gov.in/field-assistant",
    contentType: "text/html",
    html: `<html><body>
<h1>Bihar Staff Selection Commission</h1>
<h2>Online Application for Field Assistant</h2>
<p>Candidates may apply online for the post of Field Assistant through the Commission portal.</p>
<h3>Important Dates</h3>
<p>Online Apply Start Date : 04/03/2026</p>
<p>Last Date for Apply Online : 03/04/2026</p>
</body></html>`
  }
};

module.exports = { RECRUITMENTS, DUPLICATED_RECRUITMENTS, NOTICES };
