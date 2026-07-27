"use strict";

/**
 * Phase AI-4 fixtures — Generator-style drafts for Editorial Intelligence tests.
 * Text fixture is publisher-oriented text (or structured fragments) covering the
 * scenarios required by the phase brief.
 */

const NEW_RECRUITMENT = `[Section: Short Information]
Uttar Pradesh Public Service Commission
UPPSC Combined State / Upper Subordinate Services Examination 2026
Advertisement No. A-1/E-1/2026
Total Vacancy : 240 Posts
Online Apply Start Date : 04 September 2025
Last Date for Apply Online : 30 September 2025

[Section: Important Dates]
Online Apply Start Date : 04 September 2025
Last Date for Apply Online : 30 September 2025
Fee Payment Last Date : 30 September 2025
Exam Date : Notify Soon
Age Limit As on : 01 July 2025

[Section: Application Fee]
For General / OBC / EWS : Rs 125/-
For SC / ST : Rs 65/-
For PH : Rs 25/-

[Section: Age Limit]
Minimum Age : 21 Years
Maximum Age : 40 Years As on 01 July 2025

[Section: Vacancy Details]
Post Name, Category, Vacancy
Naib Tehsildar, General, 120
Block Development Officer, OBC, 80
Assistant Conservator, SC, 40
Total, , 240

[Section: Eligibility]
Bachelor Degree in Any Stream from Recognized University

[Section: Selection Process]
Preliminary Examination
Main Examination
Interview

[Section: Salary]
Pay Scale Level-10 as per 7th CPC

[Section: How To Apply]
Candidates must apply online through the official website only.
Register, fill the form, upload documents, pay the fee and submit.

[Section: Important Links]
Apply Online https://uppsc.up.nic.in/apply
Official Website https://uppsc.up.nic.in
Notification PDF https://uppsc.up.nic.in/notifications/a1e12026.pdf

[Section: Important Questions]
Q: What is the application fee for General?
A: Rs 125/-
Q: What is the last date?
A: 30 September 2025

[Section: Helpline]
Helpline Number : 0522-2238100

[Section: Notification Details]
Advertisement No. A-1/E-1/2026 issued by UPPSC.

[Section: Important Instructions]
Read the official notification carefully before applying.
`;

const ADMIT_CARD = `[Section: Short Information]
Staff Selection Commission
SSC GD Constable Admit Card 2026
Reference No. 15/2026-CGD
Admit Card for Computer Based Test

[Section: Important Dates]
Admit Card Release Date : 10 February 2026
Exam Date : 15 February 2026 to 28 February 2026

[Section: How To Apply]
Download admit card using registration number and password from the official portal.

[Section: Important Links]
Admit Card https://ssc.nic.in/admitcard
Login https://ssc.nic.in/login
Official Website https://ssc.nic.in

[Section: Important Instructions]
Carry a printed admit card and original photo ID to the exam centre.

[Section: Helpline]
SSC Helpline : 011-24368090
`;

const RESULT = `[Section: Short Information]
Railway Recruitment Board
RRB Technician Result 2025
Reference No. RRB/RES/22/2026
Result for CEN-02/2025

[Section: Important Dates]
Result Declared On : 20 July 2026

[Section: Important Links]
Result https://www.rrbcdg.gov.in/result
Official Website https://www.rrbcdg.gov.in

[Section: Important Instructions]
Candidates shortlisted must wait for document verification schedule.

[Section: Helpline]
RRB Helpdesk : 022-23004000
`;

const CORRECTION = `[Section: Short Information]
Bihar Public Service Commission
BPSC 71st CCE Correction Notice
Advertisement No. 71/2026
Corrigendum for application form correction window.

[Section: Important Dates]
Correction Start Date : 10 February 2026
Correction Last Date : 14 February 2026

[Section: Important Links]
Correction https://bpsc.bih.nic.in/correction
Official Website https://www.bpsc.bih.nic.in
Notification PDF https://bpsc.bih.nic.in/advt/71cce-corrigendum.pdf

[Section: Notification Details]
This corrigendum amends fee payment instructions in Advertisement No. 71/2026.

[Section: Important Instructions]
Candidates may edit category and photo during the correction window only.
`;

const EXTENSION = `[Section: Short Information]
Uttar Pradesh Subordinate Services Selection Commission
UPSSSC Lekhpal Recruitment 2026 — Date Extension
Advertisement No. 07-Exam/2026
Last date for apply online has been extended.

[Section: Important Dates]
Online Apply Start Date : 01 June 2026
Previous Last Date : 30 June 2026
Extended Last Date : 15 July 2026
Fee Payment Last Date : 15 July 2026

[Section: Application Fee]
General / OBC / EWS : Rs 185/-
SC / ST : Rs 95/-

[Section: How To Apply]
Apply online before the extended last date through the official website.

[Section: Important Links]
Apply Online https://upsssc.gov.in/apply
Official Website https://upsssc.gov.in
Notification PDF https://upsssc.gov.in/notifications/lekhpal-extension.pdf

[Section: Important Instructions]
No change in eligibility. Only the last date is extended.
`;

const MIXED_HINDI_ENGLISH = `[Section: Short Information]
उत्तर प्रदेश लोक सेवा आयोग
UPPSC Review Officer / Assistant Review Officer भर्ती 2025
Advertisement No. A-2/E-1/2025
कुल रिक्ति : 300 Posts

[Section: Important Dates]
आवेदन Start Date : 01 August 2025
Last Date for Apply Online : 31 August 2025
Exam Date : Notify Soon

[Section: Application Fee]
General / OBC : Rs 125/-
SC / ST : Rs 65/-

[Section: Age Limit]
Minimum Age : 21 Years
Maximum Age : 40 Years As on 01 July 2025

[Section: Vacancy Details]
Post Name, Vacancy
Review Officer, 200
Assistant Review Officer, 100
Total, 300

[Section: Eligibility]
Bachelor Degree from Recognized University / मान्यता प्राप्त विश्वविद्यालय से स्नातक

[Section: Selection Process]
Preliminary Exam
Mains Exam
Typing Test

[Section: How To Apply]
Candidates must apply online / ऑन उम्मीदवार आधिकारिक वेबसाइट से आवेदन करें

[Section: Important Links]
Apply Online https://uppsc.up.nic.in/apply
Official Website https://uppsc.up.nic.in
Notification PDF https://uppsc.up.nic.in/notifications/ro-aro.pdf

[Section: Salary]
Pay Scale Level-8
`;

const OCR_HEAVY = `[Section: Short Information]
S t a f f S e l e c t i o n C o m m i s s i o n
SSC CHSL ||| Recruitment 2026
Advt No. llll/2026
||||||||

[Section: Important Dates]
Online Apply Start Date : 01 Janvvary 2026
Last Date : 31 Janvvary 2026

[Section: Application Fee]
General : Rs 100/-

[Section: Vacancy Details]
Post ||||| Vacancy
LDC | 5000
JSA | 2000

[Section: Eligibility]
12th Pass from Recognized Board

[Section: Important Links]
Apply Online https://ssc.nic.in/apply
Official Website https://ssc.nic.in
Notification PDF https://ssc.nic.in/CHSL2026.pdf
`;

const INCOMPLETE_NOTIFICATION = `[Section: Short Information]
Some Board Recruitment 2026
Advertisement No. X-9/2026

[Section: Important Links]
Official Website https://example-board.gov.in
`;

const DUPLICATE_LINKS = `[Section: Short Information]
DSSSB Junior Engineer Recruitment 2025
Advertisement No. 04/2025

[Section: Important Dates]
Online Apply Start Date : 01 May 2025
Last Date for Apply Online : 31 May 2025

[Section: Application Fee]
General : Rs 100/-

[Section: Vacancy Details]
Post, Vacancy
Junior Engineer, 150
Total, 150

[Section: Eligibility]
Diploma in Engineering

[Section: Selection Process]
Written Exam
Document Verification

[Section: How To Apply]
Apply online on the official website.

[Section: Important Links]
Apply Online https://dsssb.delhi.gov.in/apply
Official Website https://dsssb.delhi.gov.in
Notification PDF https://dsssb.delhi.gov.in/advt/04-2025.pdf
Apply Online Mirror https://dsssb.delhi.gov.in/apply
Duplicate PDF https://dsssb.delhi.gov.in/advt/04-2025.pdf
`;

const MISSING_DATES = `[Section: Short Information]
NTA CUET UG 2026 Notification
Advertisement No. NTA/CUET/2026

[Section: Important Dates]
Exam Date : May 2026
Correction Window : To Be Announced

[Section: Application Fee]
General : Rs 1000/-

[Section: Vacancy Details]
Not Applicable — Entrance Examination

[Section: Eligibility]
Class 12 Appearing / Passed

[Section: Selection Process]
Computer Based Test

[Section: How To Apply]
Apply online through NTA website.

[Section: Important Links]
Apply Online https://cuet.nta.nic.in
Official Website https://nta.ac.in
Notification PDF https://nta.ac.in/cuet2026.pdf
`;

const MISSING_FEE = `[Section: Short Information]
UP Police Constable Recruitment 2026
Advertisement No. PRPB/CONST/2026
Online Apply Start Date : 01 August 2025
Last Date : 31 August 2025

[Section: Important Dates]
Online Apply Start Date : 01 August 2025
Last Date for Apply Online : 31 August 2025

[Section: Age Limit]
18-25 Years As on 01 July 2025

[Section: Vacancy Details]
Post, Category, Posts
Constable, UR, 20000
Constable, OBC, 12000
Constable, SC, 8000
Constable, ST, 1000
Total, , 41000

[Section: Eligibility]
12th Pass

[Section: Selection Process]
Written Exam
Physical Standard Test

[Section: Salary]
Pay Matrix Level-3

[Section: How To Apply]
Apply online at the official website.

[Section: Important Links]
Apply Online https://uppbpb.gov.in/apply
Official Website https://uppbpb.gov.in
Notification PDF https://uppbpb.gov.in/const2026.pdf
`;

const MISSING_ELIGIBILITY = `[Section: Short Information]
BPSC 71st Combined Competitive Examination 2026
Advertisement No. 71/2026

[Section: Important Dates]
Online Apply Start Date : 10 January 2026
Last Date for Apply Online : 05 February 2026

[Section: Application Fee]
General : Rs 600/-
SC / ST / Female (Bihar) : Rs 150/-

[Section: Vacancy Details]
Post Name, Vacancy
Deputy Collector, 50
DSP, 30
Block Development Officer, 40
Total, 120

[Section: Selection Process]
Preliminary Exam
Mains Exam
Interview

[Section: Salary]
As per Bihar Government Rules

[Section: How To Apply]
Apply online through BPSC portal.

[Section: Important Links]
Apply Online https://bpsc.bih.nic.in/apply
Official Website https://www.bpsc.bih.nic.in
Notification PDF https://bpsc.bih.nic.in/advt/71cce.pdf
`;

const LARGE_VACANCY_TABLE = `[Section: Short Information]
SSC GD Constable Recruitment 2026
Advertisement No. 15/2026-CGD
Total Vacancy : 38440

[Section: Important Dates]
Application Begin : 05 December 2025
Last Date for Apply Online : 31 December 2025
Exam Date : February 2026

[Section: Application Fee]
General / OBC / EWS : Rs 100/-
SC / ST / Female : Rs 0/-

[Section: Age Limit]
18-23 Years As on 01 January 2026

[Section: Vacancy Details]
Post | Force | Vacancy
Constable GD | BSF | 13093
Constable GD | CISF | 5000
Constable GD | CRPF | 8000
Constable GD | ITBP | 3188
Constable GD | SSB | 2456
Constable GD | SSF | 1203
Constable GD | Assam Rifles | 4500
Constable GD | NIA | 1000
Total | | 38440

[Section: Eligibility]
10th Pass from Recognized Board

[Section: Selection Process]
Computer Based Test
Physical Efficiency Test
Document Verification

[Section: Salary]
Pay Level-3

[Section: How To Apply]
1. Visit official website
2. Complete registration
3. Fill application form
4. Upload documents
5. Pay fee and submit

[Section: Important Links]
Apply Online https://ssc.nic.in/apply
Login https://ssc.nic.in/login
Official Website https://ssc.nic.in
Notification PDF https://ssc.nic.in/GD2026.pdf
Registration https://ssc.nic.in/register

[Section: Important Questions]
Q: Is there fee for female candidates?
A: No, fee is Rs 0/- for female candidates.

[Section: Helpline]
SSC Helpline : 011-24368090

[Section: Important Instructions]
Keep registration number safe for admit card download.
`;

const INCONSISTENT_DRAFT = `[Section: Short Information]
Demo Public Service Commission
Demo Combined Exam 2026
Advertisement No. A-1/E-1/2026
Reference No. REF/100/2026
Online Apply Start Date : 04 September 2025
Fee mentioned as Rs 200/-
Total Vacancy : 500

[Section: Important Dates]
Fee Payment Last Date : 30 September 2025
Exam Date : Notify Soon
Last Date for Apply Online : 30 September 2025
Last Date for Apply Online : 30 September 2025

[Section: Application Fee]
For General / OBC / EWS : Rs 125/-
For SC / ST : Rs 65/-

[Section: Age Limit]
Minimum Age : 21 Years
Maximum Age : 40 Years

[Section: Vacancy Details]
Post Name, Category, Vacancy
Post A, General, 100
Post B, OBC, 80
Post C, SC, 40
Total, , 300

[Section: Eligibility]
Post Graduate Degree in Any Stream

[Section: Qualification]
Educational Qualification
10th Pass from Recognized Board

[Section: Selection Process]
Written Exam

[Section: How To Apply]
Candidates must Apply Online. Complete Online Registration on the portal.

[Section: Important Links]
Apply Online https://demo.psc.gov.in/apply
Official Website https://demo.psc.gov.in
Result https://demo.psc.gov.in/result
Broken https://example.com/todo
Notification PDF https://demo.psc.gov.in/advt.pdf

[Section: Notification Details]
Advertisement No. B-9/E-9/2027
Reference No. REF/999/2027
`;

const BROKEN_UNICODE = `[Section: Short Information]
Uttar Pradesh Public Service Commission
UPPSC Combined Exam 2026 â€” Advertisement
Advertisement No. A-1/E-1/2026
Mojibake sample: Ã¢Â€Â™ and \uFFFD character noise

[Section: Important Dates]
Online Apply Start Date : 04 September 2025
Last Date for Apply Online : 30 September 2025

[Section: Application Fee]
General : Rs 125/-

[Section: Vacancy Details]
Post, Vacancy
Officer, 100
Total, 100

[Section: Eligibility]
Bachelor Degree

[Section: Selection Process]
Exam

[Section: How To Apply]
Apply online.

[Section: Important Links]
Apply Online https://uppsc.up.nic.in/apply
Official Website https://uppsc.up.nic.in
Notification PDF https://uppsc.up.nic.in/a1.pdf
`;

const OUT_OF_ORDER = `[Section: Important Links]
Apply Online https://uppsc.up.nic.in/apply
Official Website https://uppsc.up.nic.in
Notification PDF https://uppsc.up.nic.in/a1.pdf

[Section: Salary]
Level-10

[Section: Short Information]
UPPSC Exam 2026
Advertisement No. A-1/E-1/2026

[Section: Important Dates]
Online Apply Start Date : 04 September 2025
Last Date for Apply Online : 30 September 2025

[Section: Application Fee]
General : Rs 125/-

[Section: Vacancy Details]
Post, Vacancy
Officer, 10
Total, 10

[Section: Eligibility]
Graduate

[Section: Selection Process]
Prelims
Mains

[Section: How To Apply]
Apply online.
`;

const DRAFTS = {
  NEW_RECRUITMENT,
  ADMIT_CARD,
  RESULT,
  CORRECTION,
  EXTENSION,
  MIXED_HINDI_ENGLISH,
  OCR_HEAVY,
  INCOMPLETE_NOTIFICATION,
  DUPLICATE_LINKS,
  MISSING_DATES,
  MISSING_FEE,
  MISSING_ELIGIBILITY,
  LARGE_VACANCY_TABLE,
  INCONSISTENT_DRAFT,
  BROKEN_UNICODE,
  OUT_OF_ORDER
};

const PROFILE_HINTS = {
  NEW_RECRUITMENT: "new_recruitment",
  ADMIT_CARD: "admit_card",
  RESULT: "result",
  CORRECTION: "correction",
  EXTENSION: "extension",
  MIXED_HINDI_ENGLISH: "new_recruitment",
  OCR_HEAVY: "new_recruitment",
  INCOMPLETE_NOTIFICATION: "new_recruitment",
  DUPLICATE_LINKS: "new_recruitment",
  MISSING_DATES: "new_recruitment",
  MISSING_FEE: "new_recruitment",
  MISSING_ELIGIBILITY: "new_recruitment",
  LARGE_VACANCY_TABLE: "new_recruitment",
  INCONSISTENT_DRAFT: "new_recruitment",
  BROKEN_UNICODE: "new_recruitment",
  OUT_OF_ORDER: "new_recruitment"
};

module.exports = {
  DRAFTS,
  PROFILE_HINTS,
  NEW_RECRUITMENT,
  ADMIT_CARD,
  RESULT,
  CORRECTION,
  EXTENSION,
  MIXED_HINDI_ENGLISH,
  OCR_HEAVY,
  INCOMPLETE_NOTIFICATION,
  DUPLICATE_LINKS,
  MISSING_DATES,
  MISSING_FEE,
  MISSING_ELIGIBILITY,
  LARGE_VACANCY_TABLE,
  INCONSISTENT_DRAFT,
  BROKEN_UNICODE,
  OUT_OF_ORDER
};
