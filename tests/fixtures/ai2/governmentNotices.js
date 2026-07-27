"use strict";

/**
 * Representative official-notice fixtures for Phase AI-2.
 *
 * Text and HTML only — no binary PDFs are stored in the repo. `pdfText` entries
 * mimic the output of the Phase AI-1 PDF extraction path, including the broken
 * and wrapped headings that real extractions produce.
 */

const NOTICES = {
  UPPSC_NEW_RECRUITMENT: {
    title: "UPPSC Combined State / Upper Subordinate Services Examination 2026 — Recruitment Advertisement",
    sourceUrl: "https://uppsc.up.nic.in/Notifications.aspx",
    contentType: "text/html",
    html: `<html><head><title>UPPSC | Advertisements</title>
<meta property="og:title" content="UPPSC Combined State / Upper Subordinate Services Examination 2026">
</head><body>
<h1>Uttar Pradesh Public Service Commission</h1>
<p>Advertisement No. A-1/E-1/2026</p>
<p>Dated : 04/09/2025</p>
<p>Online applications are invited for direct recruitment to the following posts.</p>
<h2>Important Dates</h2>
<p>Online Apply Start Date : 04/09/2025</p>
<p>Last Date for Apply Online : 30/09/2025</p>
<h2>Vacancy Details</h2>
<table><caption>Post Details</caption>
<tr><th>Post Name</th><th>Vacancy</th></tr>
<tr><td>Naib Tehsildar</td><td>120</td></tr>
<tr><td>Block Development Officer</td><td>80</td></tr>
</table>
<h2>Educational Qualification</h2>
<p>Bachelor Degree in any stream from a recognized university.</p>
<h2>Important Links</h2>
<a href="https://uppsc.up.nic.in/apply">Apply Online</a>
<a href="https://uppsc.up.nic.in/notifications/a1e12026.pdf">Notification PDF</a>
</body></html>`
  },

  SSC_ADMIT_CARD: {
    title: "SSC GD Constable 2026 — Admit Card for Computer Based Test released",
    sourceUrl: "https://ssc.nic.in/Portal/Notices",
    contentType: "text/html",
    html: `<html><body>
<h1>Staff Selection Commission</h1>
<h2>Admit Card - Constable (GD) Examination 2026</h2>
<p>Notice No. 15/2026-CGD</p>
<p>Date of Publication : 12/01/2026</p>
<p>Candidates can download the admit card for the Computer Based Test from the regional website.</p>
<h3>Important Instructions</h3>
<p>Candidates must carry a valid photo identity card along with the e-admit card.</p>
<a href="https://ssc.nic.in/admitcard">Download Admit Card</a>
</body></html>`
  },

  RAILWAY_APPRENTICE: {
    title: "RRB Apprentice Recruitment 2026 — Act Apprentice engagement notification",
    sourceUrl: "https://www.rrbcdg.gov.in/apprentice-2026",
    contentType: "text/html",
    html: `<html><body>
<h1>Railway Recruitment Board</h1>
<h2>Engagement of Act Apprentices under the Apprentices Act 1961</h2>
<p>Advertisement No. RRB/APP/03/2026</p>
<p>Published on : 05/02/2026</p>
<h2>Important Dates</h2>
<p>Application Begin : 05/02/2026</p>
<p>Last Date for Apply Online : 04/03/2026</p>
<h2>Educational Qualification</h2>
<p>10th pass with ITI certificate in the relevant trade.</p>
<h2>Vacancy Details</h2>
<p>Trade Apprentice : 4200 posts</p>
</body></html>`
  },

  RAILWAY_TECHNICIAN_RESULT: {
    title: "RRB Technician Grade III 2025 — CBT Result declared",
    sourceUrl: "https://www.rrbcdg.gov.in/technician-result",
    contentType: "text/html",
    html: `<html><body>
<h1>Railway Recruitment Board</h1>
<h2>Result of Computer Based Test — Railway Technician Grade III</h2>
<p>Notice No. RRB/RES/22/2026</p>
<p>Dated : 18/03/2026</p>
<p>The result of the CBT has been declared. Shortlisted candidates will be called for document verification.</p>
<h3>Cut Off Marks</h3>
<p>UR : 72.45 | OBC : 68.20 | SC : 61.10</p>
</body></html>`
  },

  UP_POLICE_FINAL_RESULT: {
    title: "UP Police Constable Recruitment 2025 — Final Result and Final Merit List",
    sourceUrl: "https://uppbpb.gov.in/result-final-2025",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Police Recruitment and Promotion Board</h1>
<h2>Final Result — Direct Recruitment of Constable Civil Police 2025</h2>
<p>Advertisement No. UPPRPB/CONST/02/2025</p>
<p>Date of Publication : 22/04/2026</p>
<p>The final select list of candidates for the post of Constable has been published.</p>
<h3>Document Verification</h3>
<p>Finally selected candidates must report for document verification as per the schedule.</p>
</body></html>`
  },

  NTA_EXAM_CITY: {
    title: "NTA CUET UG 2026 — Advance Intimation of Exam City",
    sourceUrl: "https://cuet.nta.nic.in/city-intimation",
    contentType: "text/html",
    html: `<html><body>
<h1>National Testing Agency</h1>
<h2>Advance City Intimation Slip for CUET UG 2026</h2>
<p>Public Notice No. NTA/CUET/09/2026</p>
<p>Dated : 02/05/2026</p>
<p>Candidates can now check their allotted examination city through the candidate login.</p>
</body></html>`
  },

  NTA_CORRECTION_WINDOW: {
    title: "NTA CUET UG 2026 — Application Form Correction Window opens",
    sourceUrl: "https://cuet.nta.nic.in/correction",
    contentType: "text/html",
    html: `<html><body>
<h1>National Testing Agency</h1>
<h2>Correction Window for Online Application Form</h2>
<p>Public Notice No. NTA/CUET/06/2026</p>
<p>Dated : 26/03/2026</p>
<p>Candidates may edit their application form particulars during the correction window.</p>
<h3>Important Dates</h3>
<p>Correction Window Start : 26/03/2026</p>
<p>Correction Window Close : 28/03/2026</p>
</body></html>`
  },

  BPSC_EXTENSION: {
    title: "BPSC 71st Combined Competitive Examination 2026 — Last Date Extended",
    sourceUrl: "https://bpsc.bih.nic.in/notices/extension",
    contentType: "text/html",
    html: `<html><body>
<h1>Bihar Public Service Commission</h1>
<h2>Extension of Last Date for Online Application</h2>
<p>Advertisement No. 05/2026</p>
<p>Dated : 05/02/2026</p>
<p>The last date for submission of online applications has been extended up to 20 February 2026.</p>
<h3>Revised Important Dates</h3>
<p>Revised Last Date : 20/02/2026</p>
<p>Fee Payment Last Date : 22/02/2026</p>
</body></html>`
  },

  AIIMS_NURSING_WALK_IN: {
    title: "AIIMS New Delhi — Walk-in Interview for Nursing Officer on contract basis",
    sourceUrl: "https://www.aiims.edu/recruitment/nursing-officer",
    contentType: "text/html",
    html: `<html><body>
<h1>All India Institute of Medical Sciences</h1>
<h2>Walk-in Interview for the post of Nursing Officer</h2>
<p>Advertisement No. AIIMS/NO/14/2026</p>
<p>Dated : 09/06/2026</p>
<p>Engagement is purely on contract basis for a period of one year.</p>
<h3>Eligibility</h3>
<p>B.Sc Nursing from a recognized institute with valid registration.</p>
<h3>Important Dates</h3>
<p>Walk-in Interview Date : 20/06/2026</p>
</body></html>`
  },

  DSSSB_CORRIGENDUM: {
    title: "DSSSB — Corrigendum to Advertisement No. 03/2025 for Junior Engineer",
    sourceUrl: "https://dsssb.delhi.gov.in/notice/corrigendum-03-2025",
    contentType: "text/html",
    html: `<html><body>
<h1>Delhi Subordinate Services Selection Board</h1>
<h2>Corrigendum</h2>
<p>Advertisement No. 03/2025</p>
<p>Date of Publication : 14/07/2025</p>
<p>The qualification for the post of Junior Engineer stands revised as under.</p>
<h3>Amendment</h3>
<p>For "Diploma in Civil Engineering" read "Diploma or Degree in Civil Engineering".</p>
</body></html>`
  },

  BHU_ASSISTANT_PROFESSOR: {
    title: "Banaras Hindu University — Detailed Advertisement for Assistant Professor (Group A)",
    sourceUrl: "https://bhu.ac.in/recruitment/faculty-2026",
    contentType: "text/html",
    html: `<html><body>
<h1>Banaras Hindu University</h1>
<h2>Detailed Advertisement for Faculty Positions</h2>
<p>Advertisement No. BHU/FAC/01/2026</p>
<p>Date of Publication : 11/01/2026</p>
<p>Applications are invited for the post of Assistant Professor and Associate Professor.</p>
<h2>Eligibility Criteria</h2>
<p>Post Graduate degree with NET qualification as per UGC regulations.</p>
<h2>Application Fee</h2>
<p>General / OBC : Rs 1000/-</p>
<h2>How To Apply</h2>
<p>Candidates must apply online through the recruitment portal.</p>
</body></html>`
  },

  HINDI_HEAVY_RESULT: {
    title: "उत्तर प्रदेश लोक सेवा आयोग — समीक्षा अधिकारी परीक्षा 2025 का परिणाम घोषित",
    sourceUrl: "https://uppsc.up.nic.in/results",
    contentType: "text/html",
    html: `<html><body>
<h1>उत्तर प्रदेश लोक सेवा आयोग</h1>
<h2>परिणाम — समीक्षा अधिकारी एवं सहायक समीक्षा अधिकारी परीक्षा 2025</h2>
<p>विज्ञापन संख्या ए-2/ई-1/2025</p>
<p>दिनांक : 12/03/2026</p>
<p>प्रारंभिक परीक्षा का परिणाम घोषित किया जाता है।</p>
<h3>महत्वपूर्ण तिथियाँ</h3>
<p>मुख्य परीक्षा तिथि : 18/05/2026</p>
<h3>महत्वपूर्ण निर्देश</h3>
<p>अभ्यर्थी आयोग की वेबसाइट से मेरिट सूची डाउनलोड करें।</p>
</body></html>`
  },

  MIXED_LANGUAGE_EXTENSION: {
    title: "UPSSSC लेखपाल भर्ती 2026 — आवेदन की अंतिम तिथि extended",
    sourceUrl: "https://upsssc.gov.in/notice/lekhpal-extension",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Subordinate Services Selection Commission / उत्तर प्रदेश अधीनस्थ सेवा चयन आयोग</h1>
<h2>Extension of Last Date / अंतिम तिथि में वृद्धि</h2>
<p>Advertisement No. 09-Exam/2026</p>
<p>दिनांक : 15/04/2026</p>
<p>The last date for online application has been extended. आवेदन की अंतिम तिथि बढ़ा दी गई है।</p>
<h3>Important Dates / महत्वपूर्ण तिथियाँ</h3>
<p>Revised Last Date : 30/04/2026</p>
</body></html>`
  },

  PRESS_RELEASE: {
    title: "UPPSC Press Release — Commission reviews examination calendar",
    sourceUrl: "https://uppsc.up.nic.in/press",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Public Service Commission</h1>
<h2>Press Release</h2>
<p>Dated : 01/07/2026</p>
<p>The Commission held a review meeting regarding the annual examination calendar.</p>
</body></html>`
  },

  TENDER_NOTICE: {
    title: "AIIMS — Notice Inviting Tender for supply of laboratory equipment",
    sourceUrl: "https://www.aiims.edu/tenders/lab-equipment",
    contentType: "text/html",
    html: `<html><body>
<h1>All India Institute of Medical Sciences</h1>
<h2>Notice Inviting Tender</h2>
<p>Tender No. AIIMS/TEN/44/2026</p>
<p>Dated : 03/08/2026</p>
<p>Sealed bids are invited from eligible suppliers for laboratory equipment.</p>
</body></html>`
  },

  UNKNOWN_NOTICE: {
    title: "Vigilance Clearance Repository Activation",
    sourceUrl: "https://example-board.gov.in/misc/9931",
    contentType: "text/html",
    html: `<html><body>
<h2>Vigilance Clearance Repository Activation</h2>
<p>The internal repository module has been activated for administrative units.</p>
</body></html>`
  },

  PDF_BROKEN_HEADINGS: {
    title: "UP Police Constable Recruitment 2026 — Detailed Advertisement",
    sourceUrl: "https://uppbpb.gov.in/notification/const-2026.pdf",
    contentType: "application/pdf",
    pdfText: `Uttar Pradesh Police Recruitment and Promotion Board
Advertisement No. UPPRPB/CONST/07/2026
Dated : 08/07/2026

1.
Detailed Advertisement for Direct Recruitment of Constable

Important
Dates
Online Apply Start Date : 08/07/2026
Last Date for Apply Online : 07/08/2026

2. आयु सीमा
न्यूनतम आयु : 18 वर्ष
अधिकतम आयु : 25 वर्ष

Application Fee
General / OBC / EWS : Rs 400/-
SC / ST : Rs 300/-

3.1 Selection Process
Written Examination
Physical Standard Test
Physical Efficiency Test
Document Verification

Page 1 of 12

Corrigen-
dum reference will be published separately if required.`
  },

  SHORT_NOTICE_TEXT: {
    title: "BPSC Short Notice — Assistant Engineer recruitment 2026",
    sourceUrl: "https://bpsc.bih.nic.in/short-notice-ae",
    contentType: "text/plain",
    text: `Bihar Public Service Commission
Short Notice
Advertisement No. 18/2026
Dated : 21/09/2026
A short advertisement is issued for the post of Assistant Engineer. The detailed advertisement will be published shortly.`
  }
};

module.exports = { NOTICES };
