// Records what every exported routing function in public/ai-chat-routing.js
// returns for a fixed corpus, so a refactor can prove it changed nothing.
//   node scripts/routing-snapshot.mjs          print a diff summary
//   node scripts/routing-snapshot.mjs --write  update tests/fixtures/routing-snapshot.json
// Only deliberate routing changes should ever rewrite the fixture.
import { readFile, writeFile } from 'node:fs/promises';
import * as routing from '../public/ai-chat-routing.js';

const fixture = new URL(
  '../tests/fixtures/routing-snapshot.json',
  import.meta.url,
);
const today = '2026-11-26';

// Extra phrases beyond the evaluation set: commands, follow-ups and edge cases.
const EXTRA = [
  'pause my Saturday availability rule',
  'resume "Closing" rule',
  'cancel the saved availability rule for Friday',
  'cancel Jamie’s Friday shift',
  'cancel my shift tomorrow',
  'cancel my cover request',
  // Cancellations with a reason (CS-063 review): blocked whatever follows.
  'Cancel my shift because my availability changed',
  'cancel my shift since I have time off',
  'cancel my shift as my leave was approved',
  'please cancel my Friday shift due to a rule change',
  'cancel Jamie\u2019s Friday shift since her availability changed',
  'cancel my claim for Friday\u2019s shift',
  'cancel my cover request for the Saturday shift',
  'cancel my time off request for the shift on Friday',
  'cancel my availability for the closing shift',
  'whats my shedule this week',
  'whats my schedual today',
  'find open shifts',
  'show open shifts this week',
  'what about friday?',
  'and saturday?',
  'what about december 3',
  'what about the 5th',
  'this week',
  'next week',
  'what are my duties today?',
  'what do I have to do on Friday’s shift?',
  'Draft two shifts: Jamie Dec 5 9-1; Alex Dec 6 5-10',
  'create these shifts for Friday and Saturday',
  'I can work Saturday',
  'available on Friday after lunch',
  'find it',
  'save it',
  'the second one',
  'that shift',
  'why not?',
  'Which shifts did I pick up last month?',
  'how many shifts did I give away in February 2026?',
  'between May and June',
  'any updates for me?',
  'request time off for next friday and approve my claim',
  'Move Jamie’s Friday shift to 10 AM and delete Sam’s shift',
  'move all shifts next week to 8 AM',
  'is Alex Morgan available on December 3?',
  'who is free on Friday?',
  'please could you show my saved availability rules',
  '"Opening and closing" shift for Jamie',
  'hello',
  '',
  '   ',
];

// CS-065 manager insights and their look-alikes.
// CS-064 help questions, blocked commands and look-alikes that must keep
// their own routes.
// CS-066 replacement questions and look-alikes that keep their routes.
const REPLACEMENTS = [
  'who can cover Jamie\u2019s Friday shift?',
  'who could replace Sam on Saturday',
  'find a replacement for the Dec 5 closing shift',
  'who is free to take Alex\u2019s shift tomorrow',
  'is there anyone who can cover the Saturday close?',
  'who can cover?',
  'who is working Friday',
  'who\u2019s free Friday',
  'who can work Friday',
  'who covered Jamie\u2019s shift',
  'who is covering Saturday',
];

const HELP = [
  'how do I request time off?',
  'how do I give away my shift?',
  'how do I publish the schedule?',
  'how do I add an employee?',
  'hey, can you tell me how to add a new employee?',
  'how do I approve time off?',
  'how do I deactivate an employee',
  'how do I accept a cover invitation',
  'how do I cancel my claim',
  'how can I set my availability',
  'why can\u2019t I approve this time off?',
  'why can\u2019t I edit this shift?',
  'why won\u2019t it let me publish',
  'why can\u2019t I approve this claim',
  'what does pending mean?',
  'what is awaiting approval?',
  'what does expired mean',
  'what is open for cover',
  'what does published mean',
  'what is an availability rule',
  'what can you do?',
  'approve Jamie\u2019s time off',
  'decline Sam\u2019s claim',
  'clock me out',
  'swap my shift',
  'how many hours is Jamie working this week',
  'what is pending this week',
  'how can I see my schedule',
  'why can\u2019t I claim this shift?',
  'tell me how to add a shift for Jamie on Friday 9-5',
];

const INSIGHTS = [
  'who has the most hours this week?',
  'who is working the fewest hours next week',
  'who\u2019s under 20 hours next week?',
  'who is over 30 hours',
  'which employees are under 25 hours this week',
  'who\u2019s close to overtime?',
  'is anyone close to overtime this week',
  'show hours by employee',
  'who is getting too many shifts this week',
  'who\u2019s given too few hours',
  'hours per employee next week',
  'any coverage gaps next week?',
  'show uncovered shifts this week',
  'are there any gaps in the schedule tomorrow',
  'which shifts are affected by time off',
  'what happened with Saturday\u2019s closing shift?',
  'show me the history of the December 5 opening shift',
  'what is the history for Friday\u2019s delivery shift',
  'how many hours is Jamie working this week',
  'how many hours has the team got scheduled next week',
  'which shifts need cover this week?',
  'who covered the delivery shift on December 15',
];

function probe(text) {
  const row = {};
  for (const manager of [false, true]) {
    const key = manager ? 'manager' : 'employee';
    row[key] = {
      route: routing.routeChat(text, manager, null),
      fallback: routing.needsIntentFallback(text, manager),
      clarification: routing.chatClarification(text, manager),
      unsupported: routing.requestsUnsupportedAction(text, manager),
    };
  }
  Object.assign(row, {
    batch: routing.requestsShiftBatch(text),
    statusDate: routing.isStatusDateFollowUp(text),
    duties: routing.isDutiesQuestion(text),
    summaryWeek: routing.workingSummaryWeek(text),
    needsHours: routing.availabilityNeedsHours(text),
    ruleCommand: routing.availabilityRuleCommand(text),
    coworkerDate: routing.coworkerLookupDate(text, today),
    historyPeriod: routing.historyPeriod(text, today),
    opening:
      routing.openingReference(text, ['a', 'b', 'c'], 'b') ?? 'undefined',
    replyRoute: [
      routing.clarificationReplyRoute(
        text,
        'Should I find an open shift for that time, or draft availability for automatic coverage requests?',
      ),
      routing.clarificationReplyRoute(
        text,
        'What date and exact time should I use to look for open shifts?',
      ),
    ],
  });
  return row;
}

// Multi-turn: the composer's follow-up decision for each earlier question.
const statusTopics = ['claimStatus', 'coverStatus', 'timeOffStatus'];
const previousQuestions = [
  [
    false,
    {
      topic: 'coworkers',
      text: 'Which date should I check? Say “December 1” or enter a date like 2026-12-01.',
    },
  ],
  [
    false,
    {
      topic: 'explanation',
      text: `${routing.OPENING_CLARIFICATION} Use its shift title or a position in the last results.`,
    },
  ],
  [false, { topic: 'explanation', text: 'Here is why.' }],
  [
    false,
    {
      topic: 'clarification',
      text: 'Should I find an open shift for that time, or draft availability for automatic coverage requests?',
    },
  ],
  [false, { topic: 'claimStatus', text: 'Which one do you mean?' }],
  [false, { topic: 'history', text: 'Which period should I check?' }],
  [
    true,
    { topic: 'draft', text: 'Which dates and times should these shifts use?' },
  ],
  [true, { topic: 'teamAvailability', text: 'Which date should I check?' }],
  [true, { topic: 'shiftEdit', text: 'Which shift do you mean?' }],
];
const followUpReplies = [
  'December 1',
  'Friday 9am to 1pm and Saturday 5pm to 10pm',
  'the second one',
  'why not?',
  'find it',
  'save it',
  'last month',
  'Create a shift and approve Sam’s claim',
  'approve the second one',
  'find it and delete my shift',
  'what about friday?',
  'actually make it 11 AM',
];

function followUps() {
  const rows = [];
  for (const [manager, previous] of previousQuestions) {
    for (const batchClarifying of manager ? [false, true] : [false]) {
      for (const text of followUpReplies) {
        const result = routing.resolveChatTarget({
          text,
          manager,
          routed: routing.routeChat(text, manager, previous.topic),
          previous,
          batchClarifying,
          hasSelectedOpening: () => true,
          statusTopics,
          choiceReply: statusTopics.includes(previous.topic)
            ? (reply) => (/second/.test(reply) ? 2 : null)
            : null,
        });
        rows.push({
          manager,
          previous: previous.topic,
          batchClarifying,
          text,
          result: { ...result, choice: result.choice ?? 'undefined' },
        });
      }
    }
  }
  return rows;
}

export async function buildSnapshot() {
  const { messages } = JSON.parse(
    await readFile(new URL('./ai-eval/messages.json', import.meta.url), 'utf8'),
  );
  // Release audit prompts (docs/acceptance/ai-release-audit/probes.mjs).
  const audit = await readFile(
    new URL('../docs/acceptance/ai-release-audit/probes.mjs', import.meta.url),
    'utf8',
  );
  const auditPrompts = [...audit.matchAll(/\['[EM]','((?:[^'\\]|\\.)*)'/g)].map(
    (match) => match[1],
  );
  const corpus = [
    ...new Set([
      ...messages.map((row) => row.message),
      ...EXTRA,
      ...INSIGHTS,
      ...HELP,
      ...REPLACEMENTS,
      ...auditPrompts,
    ]),
  ];
  return {
    version: 1,
    note: 'Generated by scripts/routing-snapshot.mjs. Rewrite only for deliberate routing changes.',
    single: Object.fromEntries(corpus.map((text) => [text, probe(text)])),
    topical: messages
      .filter((row) => row.currentTopic)
      .map((row) => ({
        id: row.id,
        route: routing.routeChat(
          row.message,
          row.role === 'manager',
          row.currentTopic,
        ),
      })),
    followUps: followUps(),
    suggestions: [
      routing.clarificationSuggestions(false),
      routing.clarificationSuggestions(true),
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const current = await buildSnapshot();
  if (process.argv.includes('--write')) {
    await writeFile(fixture, `${JSON.stringify(current, null, 2)}\n`);
    console.log(
      `Wrote ${Object.keys(current.single).length} phrases and ${current.followUps.length} follow-ups.`,
    );
  } else {
    const saved = JSON.parse(await readFile(fixture, 'utf8'));
    const changed = Object.keys(current.single).filter(
      (text) =>
        JSON.stringify(current.single[text]) !==
        JSON.stringify(saved.single[text]),
    );
    console.log(
      changed.length
        ? changed.map((text) => `changed: ${JSON.stringify(text)}`).join('\n')
        : 'Single-message routing unchanged.',
    );
    console.log(
      JSON.stringify(current.followUps) === JSON.stringify(saved.followUps)
        ? 'Follow-ups unchanged.'
        : 'Follow-ups changed.',
    );
  }
}
