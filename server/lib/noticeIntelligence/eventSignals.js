"use strict";

/**
 * Phase AI-2 — Event signal tables.
 *
 * Each signal is a weighted set of English / Hindi patterns for one event type.
 * Weights express how decisive a phrase is on its own; the detection engine
 * combines them across title, headings, URL, links and body.
 */

const { EVENT_TYPES, EVENT_SUB_TYPES } = require("./types");

/** @type {Array<{ eventType: string, weight: number, patterns: RegExp[], blockedBy?: RegExp[] }>} */
const EVENT_SIGNALS = Object.freeze([
  {
    eventType: EVENT_TYPES.FINAL_RESULT,
    weight: 0.95,
    patterns: [
      /\bfinal\s+result\b/i,
      /\bfinal\s+(?:merit|select|selection)\s+list\b/i,
      /\bfinally\s+selected\s+candidates?\b/i,
      /अंतिम\s*परिणाम/,
      /अंतिम\s*(?:चयन|मेरिट)\s*सूची/
    ]
  },
  {
    eventType: EVENT_TYPES.RESULT,
    weight: 0.85,
    patterns: [
      /\bresults?\s+(?:declared|announced|published|out)\b/i,
      /\bdeclaration\s+of\s+results?\b/i,
      /\b(?:written|prelims?|preliminary|mains?|tier[\s-]?[i1-3]+|phase[\s-]?[i1-3]+|pet|pst|cbt)\s+(?:exam(?:ination)?\s+)?results?\b/i,
      /\bresults?\b/i,
      /\bmerit\s+list\b/i,
      /\bcut[\s-]?off\s+marks?\b/i,
      /\bselect\s+list\b/i,
      /परिणाम/,
      /मेरिट\s*सूची/,
      /कट\s*ऑफ/
    ]
  },
  {
    eventType: EVENT_TYPES.ADMIT_CARD,
    weight: 0.95,
    patterns: [
      /\badmit\s*cards?\b/i,
      /\be[\s-]?admit\s*cards?\b/i,
      /\bhall\s*tickets?\b/i,
      /\bcall\s*letters?\b/i,
      /\bdownload\s+(?:your\s+)?admit\s*card\b/i,
      /प्रवेश\s*पत्र/,
      /एडमिट\s*कार्ड/
    ]
  },
  {
    eventType: EVENT_TYPES.ANSWER_KEY,
    weight: 0.95,
    patterns: [/\banswer\s*keys?\b/i, /\bmodel\s+answers?\b/i, /उत्तर\s*कुंजी/, /आदर्श\s*उत्तर/]
  },
  {
    eventType: EVENT_TYPES.OBJECTION_WINDOW,
    weight: 0.9,
    patterns: [
      /\bobjections?\s+(?:window|window\s+open|invited|are\s+invited|may\s+be\s+submitted)\b/i,
      /\braise\s+objections?\b/i,
      /\bobjection\s+(?:portal|link|period)\b/i,
      /\brepresentations?\s+against\s+(?:the\s+)?answer\s*key\b/i,
      /आपत्ति\s*(?:विंडो|आमंत्रित|दर्ज)/,
      /आपत्तियाँ\s*आमंत्रित/
    ]
  },
  {
    eventType: EVENT_TYPES.EXAM_CITY,
    weight: 0.92,
    patterns: [
      /\bexam(?:ination)?\s+city\b/i,
      /\bcity\s+intimation\b/i,
      /\bcity\s+slip\b/i,
      /\bintimation\s+of\s+exam(?:ination)?\s+city\b/i,
      /\btest\s+city\b/i,
      /परीक्षा\s*शहर/,
      /शहर\s*सूचना/
    ]
  },
  {
    eventType: EVENT_TYPES.EXAM_DATE,
    weight: 0.88,
    patterns: [
      /\bexam(?:ination)?\s+dates?\b/i,
      /\bdates?\s+of\s+exam(?:ination)?\b/i,
      /\bexam(?:ination)?\s+schedule\b/i,
      /\bexam(?:ination)?\s+(?:date\s+)?(?:announced|declared|notified|revised|postponed|rescheduled)\b/i,
      /\btime\s*table\s+(?:of|for)\s+exam(?:ination)?\b/i,
      /परीक्षा\s*(?:तिथि|तारीख|कार्यक्रम)/,
      /परीक्षा\s*(?:स्थगित|पुनर्निर्धारित)/
    ]
  },
  {
    eventType: EVENT_TYPES.DV_SCHEDULE,
    weight: 0.92,
    patterns: [
      /\bdocument\s+verification\b/i,
      /\bdv\s+(?:schedule|round|date|programme|program)\b/i,
      /\bverification\s+of\s+documents?\b/i,
      /\bscrutiny\s+of\s+documents?\b/i,
      /दस्तावेज़?\s*सत्यापन/,
      /अभिलेख\s*सत्यापन/
    ]
  },
  {
    eventType: EVENT_TYPES.JOINING,
    weight: 0.9,
    patterns: [
      /\bjoining\s+(?:letter|instruction|date|formalit)/i,
      /\bappointment\s+letters?\b/i,
      /\boffer\s+of\s+appointment\b/i,
      /नियुक्ति\s*पत्र/,
      /कार्यभार\s*ग्रहण/,
      /योगदान\s*तिथि/
    ]
  },
  {
    eventType: EVENT_TYPES.CANCELLATION,
    weight: 0.93,
    patterns: [
      /\b(?:recruitment|advertisement|advt|exam(?:ination)?|notification|process)\s+(?:has\s+been\s+)?cancell?ed\b/i,
      /\bcancell?ation\s+(?:of|notice)\b/i,
      /\b(?:hereby\s+)?(?:cancell?ed|withdrawn|annulled)\b/i,
      /निरस्त/,
      /रद्द/,
      /वापस\s*लिया/
    ]
  },
  {
    eventType: EVENT_TYPES.CORRIGENDUM,
    weight: 0.95,
    patterns: [/\bcorrigend(?:um|a)\b/i, /\baddendum\b/i, /शुद्धि[\s-]?पत्र/, /शुद्धिपत्र/]
  },
  {
    eventType: EVENT_TYPES.CORRECTION,
    weight: 0.9,
    patterns: [
      /\bcorrection\s+(?:window|facility|link|portal|period)\b/i,
      /\bedit\s+(?:your\s+)?(?:application|form)\b/i,
      /\bmodif(?:y|ication)\s+(?:of\s+)?(?:application|form|particulars)\b/i,
      /\bapplication\s+form\s+correction\b/i,
      /संशोधन\s*(?:विंडो|सुविधा|अवधि)/,
      /आवेदन\s*(?:पत्र\s*)?में\s*संशोधन/
    ]
  },
  {
    eventType: EVENT_TYPES.EXTENSION_NOTICE,
    weight: 0.93,
    patterns: [
      /\b(?:last\s+date|closing\s+date|registration|application)\s+(?:has\s+been\s+)?extended\b/i,
      /\bextension\s+of\s+(?:last\s+date|date|time|closing\s+date|registration)\b/i,
      /\bdate\s+extended\b/i,
      /\bextended\s+(?:up\s*to|till|until)\b/i,
      /(?:तिथि|अवधि)\s*(?:में\s*)?(?:वृद्धि|विस्तार|बढ़ाई|बढ़ा\s*दी)/
    ]
  },
  {
    eventType: EVENT_TYPES.REGISTRATION_CLOSE,
    weight: 0.85,
    patterns: [
      /\bregistration\s+(?:closed|closes|closing)\b/i,
      /\blast\s+date\s+(?:to|for)\s+(?:apply|registration|submission)\b/i,
      /\bclosing\s+date\s+(?:of|for)\s+(?:online\s+)?(?:application|registration)\b/i,
      /\bonline\s+application\s+(?:link\s+)?closed\b/i,
      /पंजीकरण\s*(?:बंद|समाप्त)/,
      /आवेदन\s*की\s*अंतिम\s*तिथि/
    ]
  },
  {
    eventType: EVENT_TYPES.REGISTRATION_OPEN,
    weight: 0.85,
    patterns: [
      /\bregistration\s+(?:open|opens|opened|started|starts|begins|has\s+begun|live)\b/i,
      /\bonline\s+registration\s+(?:start|begin|commence)/i,
      /\bregistration\s+link\s+(?:active|activated|live)\b/i,
      /पंजीकरण\s*(?:प्रारंभ|शुरू|प्रारम्भ)/
    ]
  },
  {
    eventType: EVENT_TYPES.APPLY_ONLINE,
    weight: 0.75,
    patterns: [
      /\bapply\s+online\b/i,
      /\bonline\s+application\s+(?:form|portal|link)\b/i,
      /\bsubmit\s+(?:your\s+)?online\s+application\b/i,
      /\bapplications?\s+(?:can\s+be|may\s+be)\s+submitted\s+online\b/i,
      /ऑनलाइन\s*आवेदन/
    ]
  },
  {
    eventType: EVENT_TYPES.DETAILED_ADVERTISEMENT,
    weight: 0.9,
    patterns: [
      /\bdetailed\s+(?:advertisement|advt|notification|notice)\b/i,
      /\bfull\s+(?:advertisement|notification)\b/i,
      /विस्तृत\s*(?:विज्ञापन|अधिसूचना)/
    ]
  },
  {
    eventType: EVENT_TYPES.SHORT_NOTICE,
    weight: 0.9,
    patterns: [
      /\bshort\s+(?:notice|advertisement|advt|notification)\b/i,
      /\bbrief\s+(?:notice|advertisement)\b/i,
      /संक्षिप्त\s*(?:सूचना|विज्ञापन)/
    ]
  },
  {
    eventType: EVENT_TYPES.WALK_IN,
    weight: 0.95,
    patterns: [
      /\bwalk[\s-]?in(?:\s+interview|\s+drive|\s+recruitment)?\b/i,
      /\bwalk\s+in\s+for\s+interview\b/i,
      /वॉक[\s-]?इन/
    ]
  },
  {
    eventType: EVENT_TYPES.APPRENTICE,
    weight: 0.93,
    patterns: [
      /\bapprentices?\b/i,
      /\bapprenticeship\b/i,
      /\btrade\s+apprentice\b/i,
      /\bact\s+apprentice\b/i,
      /प्रशिक्षु/,
      /शिक्षुता/
    ]
  },
  {
    eventType: EVENT_TYPES.CONTRACT_RECRUITMENT,
    weight: 0.88,
    patterns: [
      /\bon\s+contract(?:ual)?\s+basis\b/i,
      /\bcontractual\s+(?:appointment|recruitment|engagement|basis)\b/i,
      /\bpurely\s+temporary\s+(?:and\s+)?contract/i,
      /\bengagement\s+on\s+contract\b/i,
      /संविदा\s*(?:आधार|पर|भर्ती|नियुक्ति)/
    ]
  },
  {
    eventType: EVENT_TYPES.TENDER,
    weight: 0.95,
    patterns: [
      /\b(?:e[\s-]?)?tenders?\b/i,
      /\bnotice\s+inviting\s+tender\b/i,
      /\bbid\s+(?:document|submission)\b/i,
      /\brequest\s+for\s+proposal\b/i,
      /निविदा/
    ]
  },
  {
    eventType: EVENT_TYPES.SCHOLARSHIP,
    weight: 0.93,
    patterns: [
      /\bscholarships?\b/i,
      /\bfellowships?\b/i,
      /\bstipend\s+scheme\b/i,
      /छात्रवृत्ति/,
      /फ़ेलोशिप/
    ]
  },
  {
    eventType: EVENT_TYPES.ADMISSION,
    weight: 0.85,
    patterns: [
      /\badmissions?\s+(?:notice|notification|open|schedule|20\d{2})\b/i,
      /\badmission\s+to\s+(?:the\s+)?(?:course|programme|program)\b/i,
      /\bentrance\s+(?:test|exam(?:ination)?)\s+for\s+admission\b/i,
      /प्रवेश\s*(?:सूचना|अधिसूचना|परीक्षा)/
    ]
  },
  {
    eventType: EVENT_TYPES.PRESS_RELEASE,
    weight: 0.92,
    patterns: [/\bpress\s+(?:release|note|communique|statement)\b/i, /प्रेस\s*(?:विज्ञप्ति|नोट)/]
  },
  {
    eventType: EVENT_TYPES.NEW_RECRUITMENT,
    weight: 0.8,
    patterns: [
      /\brecruitment\s+(?:of|for|to|notification|advertisement|drive|20\d{2})\b/i,
      /\b(?:online\s+)?applications?\s+are\s+invited\b/i,
      /\bapplications?\s+are\s+invited\s+(?:from|for)\b/i,
      /\bdirect\s+recruitment\b/i,
      /\bvacanc(?:y|ies)\s+(?:notification|announcement|circular)\b/i,
      /\bfilling\s+up\s+(?:of\s+)?(?:the\s+)?(?:posts?|vacanc)/i,
      /भर्ती\s*(?:विज्ञापन|अधिसूचना|20\d{2})?/,
      /आवेदन\s*आमंत्रित/,
      /सीधी\s*भर्ती/
    ]
  },
  {
    eventType: EVENT_TYPES.RECRUITMENT_UPDATE,
    weight: 0.55,
    patterns: [
      /\bimportant\s+(?:update|information)\s+(?:for|regarding|to)\s+candidates?\b/i,
      /\brevised\s+(?:schedule|notice|information|details)\b/i,
      /\bupdate\s+(?:regarding|on)\b/i,
      /\bstatus\s+of\s+(?:the\s+)?recruitment\b/i,
      /महत्वपूर्ण\s*(?:सूचना|जानकारी)\s*(?:अभ्यर्थियों|उम्मीदवारों)/,
      /संशोधित\s*(?:कार्यक्रम|सूचना)/
    ]
  },
  {
    eventType: EVENT_TYPES.NOTIFICATION,
    weight: 0.45,
    patterns: [
      /\bnotifications?\b/i,
      /\bnotice\b/i,
      /\bcircular\b/i,
      /\bpublic\s+notice\b/i,
      /अधिसूचना/,
      /सूचना/,
      /विज्ञप्ति/
    ]
  }
]);

/** Qualifiers layered on the primary event type. */
const SUB_TYPE_SIGNALS = Object.freeze([
  // "अंतिम" alone means "last" (as in "last date"), so it needs an outcome noun.
  { subType: EVENT_SUB_TYPES.FINAL, patterns: [/\bfinal\b/i, /अंतिम\s*(?:परिणाम|चयन|मेरिट|सूची|उत्तर)/] },
  { subType: EVENT_SUB_TYPES.PROVISIONAL, patterns: [/\bprovisional\b/i, /अनंतिम/] },
  { subType: EVENT_SUB_TYPES.REVISED, patterns: [/\brevised\b/i, /संशोधित/] },
  { subType: EVENT_SUB_TYPES.RE_EXAM, patterns: [/\bre[\s-]?exam(?:ination)?\b/i, /पुनर्?\s*परीक्षा/] },
  { subType: EVENT_SUB_TYPES.POSTPONED, patterns: [/\bpostponed\b/i, /\bdeferred\b/i, /स्थगित/] },
  { subType: EVENT_SUB_TYPES.WITHDRAWN, patterns: [/\bwithdrawn\b/i, /वापस\s*लिया/] },
  { subType: EVENT_SUB_TYPES.DUPLICATE, patterns: [/\bduplicate\b/i, /द्वितीय\s*प्रति/] },
  { subType: EVENT_SUB_TYPES.PRELIMS, patterns: [/\bprelims?\b/i, /\bpreliminary\b/i, /प्रारंभिक/] },
  { subType: EVENT_SUB_TYPES.MAINS, patterns: [/\bmains?\s+exam/i, /\bmain\s+exam/i, /मुख्य\s*परीक्षा/] },
  { subType: EVENT_SUB_TYPES.TIER_1, patterns: [/\btier[\s-]?(?:i|1)\b/i] },
  { subType: EVENT_SUB_TYPES.TIER_2, patterns: [/\btier[\s-]?(?:ii|2)\b/i] },
  { subType: EVENT_SUB_TYPES.TIER_3, patterns: [/\btier[\s-]?(?:iii|3)\b/i] },
  { subType: EVENT_SUB_TYPES.PHASE_1, patterns: [/\bphase[\s-]?(?:i|1)\b/i, /\bcbt[\s-]?(?:i|1)\b/i] },
  { subType: EVENT_SUB_TYPES.PHASE_2, patterns: [/\bphase[\s-]?(?:ii|2)\b/i, /\bcbt[\s-]?(?:ii|2)\b/i] },
  { subType: EVENT_SUB_TYPES.INTERVIEW, patterns: [/\binterview\b/i, /साक्षात्कार/] },
  {
    subType: EVENT_SUB_TYPES.PHYSICAL_TEST,
    patterns: [/\bphysical\s+(?:standard|efficiency|measurement)\s+test\b/i, /\bp[es]t\b/i, /शारीरिक\s*(?:दक्षता|मानक)/]
  },
  { subType: EVENT_SUB_TYPES.MEDICAL, patterns: [/\bmedical\s+(?:exam(?:ination)?|test|board)\b/i, /चिकित्सा\s*परीक्षण/] },
  { subType: EVENT_SUB_TYPES.TYPING_TEST, patterns: [/\btyping\s+test\b/i, /टाइपिंग\s*(?:टेस्ट|परीक्षा)/] },
  { subType: EVENT_SUB_TYPES.SKILL_TEST, patterns: [/\bskill\s+test\b/i, /कौशल\s*परीक्षा/] },
  {
    subType: EVENT_SUB_TYPES.DOCUMENT_VERIFICATION,
    patterns: [/\bdocument\s+verification\b/i, /\bdv\b/i, /दस्तावेज़?\s*सत्यापन/]
  },
  { subType: EVENT_SUB_TYPES.COUNSELLING, patterns: [/\bcounsell?ing\b/i, /काउंसलिंग/] },
  {
    subType: EVENT_SUB_TYPES.FEE_DATE_EXTENSION,
    patterns: [/\bfee\s+(?:payment\s+)?(?:date\s+)?extended\b/i, /शुल्क\s*(?:भुगतान\s*)?तिथि\s*(?:में\s*)?वृद्धि/]
  },
  {
    subType: EVENT_SUB_TYPES.DATE_EXTENSION,
    patterns: [/\bdate\s+extended\b/i, /\bextension\s+of\s+(?:last\s+)?date\b/i, /तिथि\s*(?:में\s*)?(?:वृद्धि|विस्तार)/]
  },
  {
    subType: EVENT_SUB_TYPES.FORM_CORRECTION,
    patterns: [/\bform\s+correction\b/i, /\bedit\s+(?:application|form)\b/i, /आवेदन\s*में\s*संशोधन/]
  },
  { subType: EVENT_SUB_TYPES.CITY_INTIMATION, patterns: [/\bcity\s+intimation\b/i, /परीक्षा\s*शहर\s*सूचना/] }
]);

/** Recruitment-relevance evidence used by the matching-candidate step. */
const RECRUITMENT_CONTEXT_SIGNALS = Object.freeze([
  { name: "post_reference", weight: 0.7, patterns: [/\bposts?\b/i, /\bvacanc(?:y|ies)\b/i, /पद/, /रिक्ति/] },
  { name: "candidate_reference", weight: 0.6, patterns: [/\bcandidates?\b/i, /\bapplicants?\b/i, /अभ्यर्थी/, /उम्मीदवार/] },
  { name: "recruitment_word", weight: 0.75, patterns: [/\brecruitment\b/i, /\bbharti\b/i, /भर्ती/] },
  { name: "eligibility_block", weight: 0.5, patterns: [/\beligibilit/i, /\bqualification\b/i, /पात्रता/, /योग्यता/] },
  { name: "application_block", weight: 0.5, patterns: [/\bapplication\s+fee\b/i, /\bapply\b/i, /आवेदन/] },
  { name: "exam_block", weight: 0.45, patterns: [/\bexam(?:ination)?\b/i, /परीक्षा/] },
  { name: "advertisement_reference", weight: 0.6, patterns: [/\badvertisement\b/i, /\badvt\b/i, /विज्ञापन/] }
]);

/** Known post titles used for recruitment matching hints. */
const POST_TITLE_PATTERNS = Object.freeze([
  /\bconstables?\b/i,
  /\bsub[\s-]?inspectors?\b/i,
  /\bhead\s+constables?\b/i,
  /\bassistant\s+professors?\b/i,
  /\bassociate\s+professors?\b/i,
  /\bjunior\s+engineers?\b/i,
  /\bsenior\s+engineers?\b/i,
  /\bassistant\s+engineers?\b/i,
  /\bnursing\s+officers?\b/i,
  /\bstaff\s+nurses?\b/i,
  /\blab(?:oratory)?\s+technicians?\b/i,
  /\btechnicians?\b/i,
  /\bstenographers?\b/i,
  /\bclerks?\b/i,
  /\bjunior\s+assistants?\b/i,
  /\bmulti\s+tasking\s+staff\b/i,
  /\bnaib\s+tehsildars?\b/i,
  /\bblock\s+development\s+officers?\b/i,
  /\bdeputy\s+collectors?\b/i,
  /\bstation\s+masters?\b/i,
  /\bgoods\s+guards?\b/i,
  /\bteachers?\b/i,
  /\bprincipals?\b/i,
  /\bapprentices?\b/i,
  /आरक्षी/,
  /उप\s*निरीक्षक/,
  /सहायक\s*समीक्षा\s*अधिकारी/,
  /समीक्षा\s*अधिकारी/,
  /लिपिक/,
  /शिक्षक/
]);

module.exports = {
  EVENT_SIGNALS,
  SUB_TYPE_SIGNALS,
  RECRUITMENT_CONTEXT_SIGNALS,
  POST_TITLE_PATTERNS
};
