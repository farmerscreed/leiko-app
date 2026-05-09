// AI module — intent fixture library. Sprint 11 task 3.
//
// 5+ realistic phrasings per intent class. Used by:
//   - intentRouter.test.ts to validate >95% classification accuracy
//   - the EDUCATE / DEFER renderer tests as input
//   - future PostHog telemetry to map "what users actually type" back
//     to the intent we routed them to
//
// Phrasings are intentionally varied — typo-light (we lowercase + trim
// before matching, but otherwise let real phrasing through), short, and
// in the voice of caregivers / self-buyers as they'd actually type.

import { INTENT_IDS } from '../intents';

export interface IntentFixture {
  intentId: string;
  examples: ReadonlyArray<string>;
}

export const INTENT_FIXTURES: ReadonlyArray<IntentFixture> = [
  // ----- OOS (must shortcut first) ----------------------------------
  {
    intentId: 'oos.pregnancy',
    examples: [
      "I'm pregnant — are these BP numbers safe?",
      "I am pregnant and worried about my readings",
      "pregnancy bp question",
      "what about while pregnant",
      "is this safe if I'm breastfeeding",
    ],
  },
  {
    intentId: 'oos.pediatric',
    examples: [
      "is this reading normal for my child",
      "my son is 12 — should he wear this watch",
      "pediatric blood pressure",
      "for my kid",
      "my daughter is 14 yo, can she use it",
    ],
  },
  {
    intentId: 'oos.mental-health-crisis',
    examples: [
      "I'm thinking about hurting myself",
      "feel hopeless lately",
      "I want to end it",
      "feeling worthless",
      "thinking about suicide",
    ],
  },
  {
    intentId: 'oos.suicidal-ideation',
    examples: [
      "kill myself",
      "I don't want to live anymore",
      "end myself",
      "don't want to be here",
      "killing myself feels easier",
    ],
  },
  {
    intentId: 'oos.substance-abuse',
    examples: [
      "is cocaine affecting my BP",
      "I'm drinking too much, will it show",
      "I drink every day — does it matter for these readings",
      "meth and heart rate",
      "I drink alcohol every day, problem?",
    ],
  },
  {
    intentId: 'oos.life-threatening-emergency',
    examples: [
      "I'm having a heart attack",
      "I think I'm having a stroke right now",
      "can't breathe",
      "I'm collapsing",
      "having a heart attack help",
    ],
  },

  // ----- DEFER -------------------------------------------------------
  {
    intentId: 'defer.medication-bp',
    examples: [
      "should I take more lisinopril",
      "is amlodipine working",
      "ace inhibitor question",
      "my BP meds aren't working",
      "is hctz the right pill for me",
    ],
  },
  {
    intentId: 'defer.medication-other',
    examples: [
      "should I take more meds",
      "what dose of medication should I take",
      "switching my pills",
      "increase my medication",
      "take more of my medication today",
    ],
  },
  {
    intentId: 'defer.symptom-cardiac',
    examples: [
      "I have chest pain",
      "my heart is fluttering",
      "could this be afib",
      "is this a heart attack",
      "skipping beats lately",
    ],
  },
  {
    intentId: 'defer.symptom-respiratory',
    examples: [
      "do I have sleep apnea",
      "I'm short of breath",
      "could this be apnea",
      "trouble breathing at night",
      "should I get a CPAP",
    ],
  },
  {
    intentId: 'defer.symptom-stress',
    examples: [
      "having a panic attack",
      "these numbers are giving me anxiety",
      "anxiety attack",
      "this is giving me panic",
      "I'm having a panic attack right now",
    ],
  },
  {
    intentId: 'defer.dose-change',
    examples: [
      "should I increase my dose",
      "decrease my dose",
      "when should I take my pills",
      "how often should I take it",
      "adjust my dose",
    ],
  },
  {
    intentId: 'defer.diagnosis',
    examples: [
      "do I have hypertension",
      "am I diabetic based on these",
      "diagnose me",
      "based on these numbers what condition do I have",
      "have I got high blood pressure",
    ],
  },
  {
    intentId: 'defer.afib-detection',
    examples: [
      "does this watch detect afib",
      "can the watch find afib",
      "afib alert",
      "does it catch a-fib",
      "will the watch detect afib for me",
    ],
  },

  // ----- TROUBLESHOOT ------------------------------------------------
  {
    intentId: 'troubleshoot.watch-not-syncing',
    examples: [
      "watch isn't syncing",
      "watch won't sync",
      "no sync since this morning",
      "bluetooth not connecting",
      "BLE not connecting to my watch",
    ],
  },
  {
    intentId: 'troubleshoot.battery',
    examples: [
      "watch battery question",
      "how long does the watch last",
      "watch battery dying fast",
      "charging the watch",
      "how long does the watch battery last",
    ],
  },
  {
    intentId: 'troubleshoot.no-bp-readings',
    examples: [
      "no bp readings yet",
      "my readings aren't showing",
      "where are my BP readings",
      "no blood pressure readings in the app",
      "where is my reading",
    ],
  },
  {
    intentId: 'troubleshoot.no-hr-data',
    examples: [
      "no hr data",
      "missing heart rate data",
      "heart rate isn't showing",
      "heart rate is not tracking",
      "hr data missing",
    ],
  },
  {
    intentId: 'troubleshoot.no-sleep-data',
    examples: [
      "no sleep data",
      "watch didn't track my sleep",
      "missing sleep tracking",
      "sleep didn't record last night",
      "sleep did not record",
    ],
  },
  {
    intentId: 'troubleshoot.cuff-feels-wrong',
    examples: [
      "the reading feels wrong",
      "cuff feels off",
      "BP way too high",
      "reading way too low",
      "doesn't feel right",
    ],
  },

  // ----- HOW-TO ------------------------------------------------------
  {
    intentId: 'how-to.take-a-reading',
    examples: [
      "how do I take a reading",
      "how to take a measurement",
      "new reading",
      "how do I take a bp",
      "take a reading on the watch",
    ],
  },
  {
    intentId: 'how-to.share-with-doctor',
    examples: [
      "how do I share my readings with my doctor",
      "how to send my data to the doctor",
      "doctor pdf",
      "doctor export",
      "how to share my trend with my doctor",
    ],
  },
  {
    intentId: 'how-to.add-family-member',
    examples: [
      "how do I add a family member",
      "how to invite a sibling",
      "add my spouse",
      "invite code",
      "how do I add my daughter",
    ],
  },
  {
    intentId: 'how-to.invite-caregiver',
    examples: [
      "how do I invite a caregiver",
      "share my readings with my family",
      "share my readings with my kids",
      "share my readings with my wife",
      "invite caregiver",
    ],
  },
  {
    intentId: 'how-to.export-data',
    examples: [
      "export my data",
      "download my readings",
      "csv export",
      "spreadsheet export",
      "download all my data",
    ],
  },

  // ----- PATTERN ----------------------------------------------------
  {
    intentId: 'pattern.this-week-bp',
    examples: [
      "how did my bp do this week?",
      "BP this week",
      "weekly BP summary",
      "how was my bp this week?",
      "weekly reading summary",
    ],
  },
  {
    intentId: 'pattern.morning-vs-evening',
    examples: [
      "morning vs evening readings",
      "morning compared to night",
      "why are my morning bp higher",
      "morning surge",
      "am vs pm bp",
    ],
  },
  {
    intentId: 'pattern.compared-to-last-month',
    examples: [
      "compared to last month",
      "how does my bp compare to last month",
      "trend over the last month",
      "change over the past few weeks",
      "compared with last month",
    ],
  },
  {
    intentId: 'pattern.bp-going-up',
    examples: [
      "my bp is going up",
      "bp trending up",
      "numbers are rising",
      "readings are climbing",
      "readings are getting higher",
    ],
  },
  {
    intentId: 'pattern.bp-going-down',
    examples: [
      "my bp is going down",
      "bp trending down",
      "readings are dropping",
      "numbers are getting lower",
      "bp going down lately",
    ],
  },
  {
    intentId: 'pattern.sleep-and-bp',
    examples: [
      "does sleep affect bp",
      "how does sleep impact my bp",
      "sleep and blood pressure",
      "rest impact on bp",
      "why is my morning bp high",
    ],
  },
  {
    intentId: 'pattern.activity-and-hr',
    examples: [
      "does walking change my heart rate",
      "how does exercise affect my hr",
      "steps and heart rate",
      "activity and resting hr",
      "how much does exercise change my heart rate",
    ],
  },
  {
    intentId: 'pattern.spo2-night-dip',
    examples: [
      "why does my oxygen drop at night",
      "spo2 dips overnight",
      "overnight oxygen dip",
      "why does spo2 drop when I'm sleeping",
      "oxygen falls overnight",
    ],
  },
  {
    intentId: 'pattern.what-correlations-mean',
    examples: [
      "what is a correlation",
      "what does correlation mean",
      "how does leiko find a correlation",
      "what are correlations",
      "how does the app find a correlation",
    ],
  },
  {
    intentId: 'pattern.weekly-summary-explanation',
    examples: [
      "weekly summary?",
      "what's in the weekly summary",
      "sunday summary?",
      "what's in my weekly summary",
      "weekly summary question",
    ],
  },

  // ----- READING ----------------------------------------------------
  {
    intentId: 'reading.is-this-bp-normal',
    examples: [
      "is this bp normal",
      "is that reading ok",
      "should I be worried about this bp",
      "is 128/82 normal",
      "is my bp ok",
    ],
  },
  {
    intentId: 'reading.why-was-this-bp-high',
    examples: [
      "why was this so high",
      "why is my bp high",
      "reading higher than usual",
      "what made my bp go up",
      "why was this reading so high",
    ],
  },
  {
    intentId: 'reading.what-does-this-bp-mean',
    examples: [
      "what does this mean",
      "interpret my reading",
      "what does my bp mean",
      "explain this bp",
      "what does that reading mean",
    ],
  },
  {
    intentId: 'reading.is-this-hr-normal',
    examples: [
      "is 75 bpm normal",
      "is my resting hr ok",
      "is 95 beats normal",
      "is this hr normal",
      "is my heart rate ok",
    ],
  },
  {
    intentId: 'reading.is-this-spo2-normal',
    examples: [
      "is 94 percent oxygen ok",
      "is my oxygen normal",
      "is 92% spo2 ok",
      "is this spo2 normal",
      "is my spo2 ok",
    ],
  },
  {
    intentId: 'reading.is-this-sleep-good',
    examples: [
      "was that good sleep",
      "is last night ok",
      "how did I sleep last night",
      "was my sleep fine",
      "how was my sleep tonight",
    ],
  },
  {
    intentId: 'reading.is-this-step-count-good',
    examples: [
      "is 6,000 steps good",
      "am I walking enough",
      "how many steps should I take",
      "is 7000 steps enough",
      "is 4,500 steps ok",
    ],
  },

  // ----- FAQ --------------------------------------------------------
  {
    intentId: 'faq.what-is-bp',
    examples: [
      "what is blood pressure",
      "what does bp mean",
      "define blood pressure",
      "meaning of bp",
      "what is bp",
    ],
  },
  {
    intentId: 'faq.what-is-systolic',
    examples: [
      "what is systolic",
      "what does the top number mean",
      "what is the first number",
      "top number meaning",
      "what is systolic exactly",
    ],
  },
  {
    intentId: 'faq.what-is-diastolic',
    examples: [
      "what is diastolic",
      "what does the bottom number mean",
      "what is the lower number",
      "bottom number meaning",
      "what is diastolic exactly",
    ],
  },
  {
    intentId: 'faq.what-is-mmhg',
    examples: [
      "what is mmhg",
      "millimetres of mercury",
      "what does mmhg stand for",
      "millimeters of mercury",
      "mmhg unit explanation",
    ],
  },
  {
    intentId: 'faq.what-is-spo2',
    examples: [
      "what is spo2",
      "what does spo2 mean",
      "blood oxygen explained",
      "oxygen saturation",
      "what does s p o 2 stand for",
    ],
  },
  {
    intentId: 'faq.what-is-resting-hr',
    examples: [
      "what is resting heart rate",
      "what's a normal resting hr",
      "rhr normal range",
      "what is a resting heart rate",
      "what is rhr",
    ],
  },
  {
    intentId: 'faq.what-is-sleep-score',
    examples: [
      "how is sleep score calculated",
      "what's a good sleep score",
      "how do you score sleep",
      "sleep score explained",
      "where does the sleep score come from",
    ],
  },
  {
    intentId: 'faq.what-do-stages-mean',
    examples: [
      "what is stage 1",
      "what is stage 2",
      "what does elevated mean",
      "what does stage one mean",
      "bp stages explained",
    ],
  },
];

// Sanity — every intent has fixtures.
export const FIXTURE_INTENT_IDS: ReadonlyArray<string> = INTENT_FIXTURES.map(
  f => f.intentId,
);

/** Returns the list of intent ids that exist in INTENTS but not in
 *  INTENT_FIXTURES. The router test asserts this is empty. */
export function intentsMissingFixtures(): string[] {
  const have = new Set(FIXTURE_INTENT_IDS);
  return INTENT_IDS.filter(id => !have.has(id));
}
