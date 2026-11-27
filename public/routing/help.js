// Help answers for chat (CS-064): how-to steps, why something is not allowed,
// what a status means, and where to go for actions chat cannot take. The text
// is fixed and describes CoverShift's own rules; it never includes records or
// another person's details. Each topic links one page of the asker's role.
import { anyOf, normalizedMessage } from './text.js';

// Workspace pages per role, as named in the workspace navigation.
export const HELP_PAGES = {
  manager: {
    overview: 'Overview',
    schedule: 'Schedule',
    approvals: 'Approvals',
    team: 'Team',
    'time-off': 'Time off',
    availability: 'Availability',
    cover: 'Cover requests',
    history: 'History',
  },
  worker: {
    shifts: 'My shifts',
    open: 'Open shifts',
    requests: 'My requests',
    'time-off': 'Time off',
    availability: 'Availability',
    cover: 'Cover requests',
    history: 'History',
  },
};

const SHIFT = 'shifts?';
const TIME_OFF = '(?:time[ -]?off|leave|a day off|days off|vacation|holiday)';
const HOW =
  "(?:how (?:do|can|should|would) (?:i|we)|how to|where (?:do|can) (?:i|we)|what(?:'s| is) the way to|help me (?:to )?)";
const WHY =
  "(?:why (?:can't i|cannot i|can not i|couldn't i|won't it let me|doesn't it let me|isn't it letting me|is it not letting me|am i not able to|am i unable to|is coversh?ift not letting me))";

/**
 * Topics in matching order. `ask` is matched against the normalised message;
 * `roles` lists who gets the topic. `steps` is one or two short sentences per
 * role; `page` is the workspace page linked from the answer.
 */
export const HELP_TOPICS = [
  // What the chat can do.
  {
    id: 'capabilities',
    roles: ['manager', 'worker'],
    ask: /^(?:help|help me|what can (?:you|i) (?:do|ask(?: you)?)(?: here)?|what do you do|how (?:do|can) (?:you|i use you|i use this(?: chat)?) help(?: me)?|what are you able to do|what (?:kind of )?(?:things|questions) can i ask(?: you)?)$/,
    title: 'What I can help with',
    steps: {
      manager: [
        'Ask about the team’s schedule and hours, coverage gaps, who is off or available, and a shift’s history.',
        'I can prepare shift drafts and edits for you to review, and answer “how do I…” questions about CoverShift.',
      ],
      worker: [
        'Ask about your schedule, open shifts, your requests and time off, and when coworkers are free.',
        'I can prepare time-off and cover requests and availability for you to review, and answer “how do I…” questions.',
      ],
    },
    page: { manager: 'overview', worker: 'shifts' },
  },
  // How-to questions.
  {
    id: 'requestTimeOff',
    roles: ['manager', 'worker'],
    ask: anyOf([
      `${HOW} (?:request|ask for|take|book|get|put in for|submit)(?: a)? ${TIME_OFF}`,
    ]),
    title: 'Requesting time off',
    steps: {
      manager: [
        'Employees request time off from their Time off page or in chat. You approve or decline it on Time off.',
      ],
      worker: [
        'Open Time off, choose full or partial days, and submit. You can also ask me to “request time off on Friday” to prepare it for review.',
        'Your manager approves or declines it. Your schedule doesn’t change until it’s approved.',
      ],
    },
    page: { manager: 'time-off', worker: 'time-off' },
  },
  {
    id: 'approveTimeOff',
    roles: ['manager'],
    ask: anyOf([
      `${HOW} (?:approve|decline|reject|review|handle|see) (?:a |the )?(?:${TIME_OFF}|${TIME_OFF} requests?)`,
    ]),
    title: 'Reviewing time off',
    steps: {
      manager: [
        'Open Time off to approve or decline pending requests.',
        'Approval is blocked while the employee still has overlapping assignments or pending claims. Resolve those first.',
      ],
    },
    page: { manager: 'time-off' },
  },
  {
    id: 'requestCover',
    roles: ['worker'],
    ask: anyOf([
      `${HOW} (?:give (?:away|up)|get (?:rid of|out of)|get (?:someone|a coworker|cover) (?:to cover|for)|find cover for|request cover for|ask (?:someone|a coworker) to cover|swap|trade|switch) (?:my |a |one of my )?${SHIFT}`,
      `${HOW} (?:request|ask for|get) cover\\b`,
      `${HOW} swap ${SHIFT} with\\b`,
    ]),
    title: 'Getting cover for your shift',
    steps: {
      worker: [
        'Open My shifts and choose Request cover on the shift, before it starts. Post it to the open board or invite one coworker.',
        'A coworker claims or accepts it, then your manager approves. You stay assigned until then.',
      ],
    },
    page: { worker: 'shifts' },
  },
  {
    id: 'claimShift',
    roles: ['worker'],
    ask: anyOf([
      `${HOW} (?:claim|pick up|take|grab|get|sign up for) (?:an? |more |extra |open )*(?:open |extra |available )?${SHIFT}`,
    ]),
    title: 'Picking up an open shift',
    steps: {
      worker: [
        'Open Open shifts, choose a shift and claim it. You can also ask me to “find open shifts on Saturday”.',
        'Your manager approves the claim. Shifts that overlap your shifts, pending claims or approved time off can’t be claimed.',
      ],
    },
    page: { worker: 'open' },
  },
  {
    id: 'answerInvitation',
    roles: ['worker'],
    ask: anyOf([
      `${HOW} (?:accept|decline|answer|respond to|reply to|see) (?:a |the |my )?(?:cover )?(?:invitations?|invites?|cover requests?)`,
    ]),
    title: 'Answering a cover invitation',
    steps: {
      worker: [
        'Open Cover requests to accept or decline invitations from coworkers.',
        'After you accept, a manager must approve before the shift becomes yours.',
      ],
    },
    page: { worker: 'cover' },
  },
  {
    id: 'cancelRequest',
    roles: ['worker'],
    ask: anyOf([
      `${HOW} (?:cancel|withdraw|take back|undo) (?:a |the |my )?(?:claim|request|cover request|${TIME_OFF}(?: request)?)s?`,
    ]),
    title: 'Withdrawing a request',
    steps: {
      worker: [
        'Open My requests to cancel a pending claim or cover request, or Time off to cancel a time-off request.',
        'Only requests that are still pending or upcoming can be cancelled.',
      ],
    },
    page: { worker: 'requests' },
  },
  {
    id: 'setAvailability',
    roles: ['worker'],
    ask: anyOf([
      `${HOW} (?:set|add|update|change|enter|share|tell (?:my manager|you)|show) (?:my |when i'm |when i am )?(?:availability|available times|free times|available)`,
    ]),
    title: 'Sharing your availability',
    steps: {
      worker: [
        'Open Availability to add the times you’re free. Your manager and coworkers see when you’re free, not why.',
        'To have CoverShift request matching open shifts for you, ask me to set up an automatic availability rule.',
      ],
    },
    page: { worker: 'availability' },
  },
  {
    id: 'createShift',
    roles: ['manager'],
    ask: anyOf([
      `${HOW} (?:create|add|make|schedule|set up|post|put up) (?:a |an |new |more |open )*${SHIFT}`,
    ]),
    title: 'Adding a shift',
    steps: {
      manager: [
        'Open Schedule and add the shift, or ask me to “create a shift for Jamie on Friday 9–5” to prepare a draft for review.',
        'New and changed shifts stay private until you publish the schedule.',
      ],
    },
    page: { manager: 'schedule' },
  },
  {
    id: 'editShift',
    roles: ['manager'],
    ask: anyOf([
      `${HOW} (?:edit|change|move|reschedule|update|delete|remove|cancel) (?:a |the |an existing )?${SHIFT}`,
    ]),
    title: 'Changing a shift',
    steps: {
      manager: [
        'Open Schedule and select the shift, or ask me to “move Jamie’s Friday shift to 10 AM” to prepare the change.',
        'Shifts that have started, or that have coverage requests, are locked.',
      ],
    },
    page: { manager: 'schedule' },
  },
  {
    id: 'publish',
    roles: ['manager', 'worker'],
    ask: anyOf([
      `${HOW} (?:publish|post|share|send out|release) (?:the |my |next |this )?(?:schedule|roster|rota|week|two weeks)`,
    ]),
    title: 'Publishing the schedule',
    steps: {
      manager: [
        'Open Schedule, review the two-week period and choose Publish. Employees see changes only after you publish.',
        'A reminder shows on Mondays when the next period is due.',
      ],
      worker: [
        'Your manager publishes the schedule. Your shifts appear on My shifts once it’s published.',
      ],
    },
    page: { manager: 'schedule', worker: 'shifts' },
  },
  {
    id: 'addEmployee',
    roles: ['manager', 'worker'],
    ask: anyOf([
      `${HOW} (?:add|invite|hire|onboard|create (?:an account for|a login for)|set up) (?:a |an |new |another )*(?:employee|worker|staff(?: member)?|team member|person|people|coworker)s?`,
    ]),
    title: 'Adding an employee',
    steps: {
      manager: [
        'Open Team and add the employee’s name and email.',
        'Send them the setup link so they can create their login. If a link expires, send a new one.',
      ],
      worker: [
        'Your manager adds employees and sends each one a setup link. If your link expired, ask your manager for a new one.',
      ],
    },
    page: { manager: 'team', worker: 'shifts' },
  },
  {
    id: 'removeEmployee',
    roles: ['manager'],
    ask: anyOf([
      `${HOW} (?:remove|deactivate|delete|offboard|fire|let go of) (?:an? |the )?(?:employee|worker|staff(?: member)?|team member|person|someone|somebody)`,
    ]),
    title: 'Deactivating an employee',
    steps: {
      manager: [
        'Open Team and deactivate the employee. Their history is kept.',
        'Resolve their current and upcoming assignments and pending claims first.',
      ],
    },
    page: { manager: 'team' },
  },
  {
    id: 'reviewClaims',
    roles: ['manager'],
    ask: anyOf([
      `${HOW} (?:approve|decline|reject|review|handle|see) (?:a |the |pending )?(?:claims?|cover(?:age)? requests?|cover|swaps?)`,
    ]),
    title: 'Reviewing claims',
    steps: {
      manager: [
        'Open Approvals to approve or decline pending coverage claims.',
        'The original employee stays assigned until you approve.',
      ],
    },
    page: { manager: 'approvals' },
  },
  {
    id: 'seeSchedule',
    roles: ['manager', 'worker'],
    ask: anyOf([
      `${HOW} (?:see|view|find|check|look at) (?:my |the |our |team's )?(?:schedule|shifts|roster|rota)`,
    ]),
    title: 'Seeing the schedule',
    steps: {
      manager: ['Open Schedule, or ask me “who is working on Friday?”.'],
      worker: ['Open My shifts, or ask me “when is my next shift?”.'],
    },
    page: { manager: 'schedule', worker: 'shifts' },
  },
  // "Why can't I…" questions.
  {
    id: 'whyClaim',
    roles: ['worker'],
    ask: anyOf([`${WHY} (?:claim|pick up|take|get|sign up for)\\b`]),
    title: 'Why a shift can’t be claimed',
    steps: {
      worker: [
        'You can’t claim a shift that overlaps your shifts, pending claims or approved time off, your own cover request, or a shift that has started.',
        'Ask “why can’t I claim it?” after selecting an opening to check that shift.',
      ],
    },
    page: { worker: 'open' },
  },
  {
    id: 'whyCover',
    roles: ['worker'],
    ask: anyOf([
      `${WHY} (?:request|ask for|get) cover|${WHY} (?:give (?:away|up)|swap|trade)\\b`,
    ]),
    title: 'Why cover can’t be requested',
    steps: {
      worker: [
        'Cover can only be requested before the shift starts, and a shift can have one active cover request at a time.',
        'Check the shift on My shifts.',
      ],
    },
    page: { worker: 'shifts' },
  },
  {
    id: 'whyTimeOff',
    roles: ['worker'],
    ask: anyOf([
      `${WHY} (?:request|ask for|take|book|submit|get)(?: a)? ${TIME_OFF}`,
    ]),
    title: 'Why time off can’t be requested',
    steps: {
      worker: [
        'Time off must start in the future, within one year, and can’t overlap a request that is already pending or approved.',
      ],
    },
    page: { worker: 'time-off' },
  },
  {
    id: 'whyEdit',
    roles: ['manager'],
    ask: anyOf([
      `${WHY} (?:edit|change|move|reschedule|update|delete|remove|cancel)\\b`,
    ]),
    title: 'Why a shift is locked',
    steps: {
      manager: [
        'Shifts that have started can’t be edited or deleted. Shifts with coverage requests are locked to keep the requests and history.',
        'Resolve the coverage on Approvals first.',
      ],
    },
    page: { manager: 'schedule' },
  },
  {
    id: 'whyApproveTimeOff',
    roles: ['manager'],
    ask: anyOf([
      `${WHY} approve (?:a |the |this |that |her |his |their )?(?:${TIME_OFF}|${TIME_OFF} request)`,
    ]),
    title: 'Why time off can’t be approved',
    steps: {
      manager: [
        'Approval is blocked while the employee has assignments or pending claims during that time. Move or cover those shifts first.',
      ],
    },
    page: { manager: 'time-off' },
  },
  {
    id: 'whyApproveClaim',
    roles: ['manager'],
    ask: anyOf([
      `${WHY} approve (?:a |the |this |that )?(?:claim|cover|swap|request)`,
    ]),
    title: 'Why a claim can’t be approved',
    steps: {
      manager: [
        'A claim can’t be approved if the claimant has an overlapping shift or approved time off, or if it changed since you opened Approvals.',
        'Refresh Approvals and review it again.',
      ],
    },
    page: { manager: 'approvals' },
  },
  {
    id: 'whyAssign',
    roles: ['manager'],
    ask: anyOf([
      `${WHY} (?:assign|schedule|give) (?:\\w+ ){0,3}(?:to |a |the |this )?${SHIFT}?`,
    ]),
    title: 'Why an employee can’t be assigned',
    steps: {
      manager: [
        'An employee can’t be assigned a shift that overlaps another of their shifts or their approved time off. Choose another employee or time.',
      ],
    },
    page: { manager: 'schedule' },
  },
  {
    id: 'whyPublish',
    roles: ['manager'],
    ask: anyOf([`${WHY} publish\\b`]),
    title: 'Why the schedule can’t be published',
    steps: {
      manager: [
        'Publishing needs unpublished changes. It’s blocked if a draft shift has started or a draft conflicts with a pending coverage claim.',
      ],
    },
    page: { manager: 'schedule' },
  },
  // What a status means.
  {
    id: 'meaningPending',
    roles: ['manager', 'worker'],
    term: 'pending',
    title: 'Pending',
    steps: {
      manager: [
        'Pending means it is waiting for a decision. Nothing changes until it’s approved.',
      ],
      worker: [
        'Pending means it is waiting for a decision. Nothing changes until it’s approved.',
      ],
    },
    page: { manager: 'approvals', worker: 'requests' },
  },
  {
    id: 'meaningAwaiting',
    roles: ['manager', 'worker'],
    term: 'awaiting (?:your |manager )?approval',
    title: 'Awaiting approval',
    steps: {
      manager: [
        'A coworker has claimed or accepted the shift, and you haven’t approved it yet. The original employee stays assigned until you do.',
      ],
      worker: [
        'A coworker has claimed or accepted the shift, and a manager hasn’t approved it yet. The original employee stays assigned until then.',
      ],
    },
    page: { manager: 'approvals', worker: 'requests' },
  },
  {
    id: 'meaningOpen',
    roles: ['manager', 'worker'],
    term: '(?:open for cover|open shifts?|an open shift)',
    title: 'Open for cover',
    steps: {
      manager: [
        'The assigned employee asked for cover and the shift is on the open board. They stay assigned until you approve a claim.',
      ],
      worker: [
        'The assigned employee asked for cover and the shift is on the open board. They stay assigned until a manager approves a claim.',
      ],
    },
    page: { manager: 'approvals', worker: 'open' },
  },
  {
    id: 'meaningExpired',
    roles: ['manager', 'worker'],
    term: 'expired',
    title: 'Expired',
    steps: {
      manager: [
        'It wasn’t answered in time, for example the shift started first. Nothing was changed.',
      ],
      worker: [
        'It wasn’t answered in time, for example the shift started first. Nothing was changed.',
      ],
    },
    page: { manager: 'history', worker: 'cover' },
  },
  {
    id: 'meaningDeclined',
    roles: ['manager', 'worker'],
    term: '(?:declined|rejected)',
    title: 'Declined',
    steps: {
      manager: ['Someone said no to it. No shift was changed.'],
      worker: ['Someone said no to it. No shift was changed.'],
    },
    page: { manager: 'history', worker: 'requests' },
  },
  {
    id: 'meaningCancelled',
    roles: ['manager', 'worker'],
    term: '(?:cancelled|canceled|withdrawn)',
    title: 'Cancelled',
    steps: {
      manager: [
        'The person who made it withdrew it before a decision. No shift was changed.',
      ],
      worker: [
        'The person who made it withdrew it before a decision. No shift was changed.',
      ],
    },
    page: { manager: 'history', worker: 'requests' },
  },
  {
    id: 'meaningPublished',
    roles: ['manager', 'worker'],
    term: '(?:published|unpublished|not published|a draft|draft shifts?)',
    title: 'Published',
    steps: {
      manager: [
        'Published shifts are visible to employees. New or changed shifts stay as a private draft until you publish the schedule.',
      ],
      worker: [
        'Published shifts are the ones your manager has shared. Changes appear once your manager publishes them.',
      ],
    },
    page: { manager: 'schedule', worker: 'shifts' },
  },
  {
    id: 'meaningAvailability',
    roles: ['manager', 'worker'],
    term: '(?:an? )?(?:availability window|availability rule|automatic rule|automatic availability rule)s?',
    title: 'Availability windows and rules',
    steps: {
      manager: [
        'A window shows when an employee is free. An automatic rule lets CoverShift request matching open shifts for them, which you still approve.',
      ],
      worker: [
        'A window shows your manager and coworkers when you’re free. An automatic rule lets CoverShift request matching open shifts for you, which your manager still approves.',
      ],
    },
    page: { manager: 'availability', worker: 'availability' },
  },
];

// "what does pending mean", "what is awaiting approval", "meaning of expired".
function meaningPattern(term) {
  const quoted = `['"“”]?${term}['"“”]?`;
  return anyOf(
    [
      `what does (?:it mean (?:when|if) (?:it|a \\w+|my \\w+|something) (?:is|says|shows) )?${quoted} mean`,
      `what (?:does|do) (?:it|that|this) mean (?:when|if) (?:it|a \\w+|my \\w+) (?:is|says|shows) ${quoted}`,
      `what(?:'s| is) (?:meant by |the meaning of )?${quoted}(?: mean)?[.!?]*$`,
      `(?:meaning of|define|definition of) ${quoted}`,
      `explain (?:what )?${quoted}(?: means| is)?[.!?]*$`,
    ],
    { before: '^' },
  );
}

const roleKey = (manager) => (manager ? 'manager' : 'worker');

// Lead-ins before the question itself: "hey, quick question: can you tell me…".
const LEAD_IN =
  /^(?:(?:hi|hey|hello|ok|okay|so|um|quick question|question)[,:!]?\s+)*(?:(?:can|could|would) you\s+)?(?:(?:please\s+)?(?:tell|show|explain(?: to)?) me\s+|i (?:want|need|would like) to know\s+|do you know\s+)?/;

/** The help topic a message asks about for this role, or null. */
export function helpTopic(text, manager) {
  const message = normalizedMessage(text)
    .replace(LEAD_IN, '')
    .replace(/[?!.]+$/, '');
  const role = roleKey(manager);
  return (
    HELP_TOPICS.find(
      (topic) =>
        topic.roles.includes(role) &&
        (topic.term
          ? meaningPattern(topic.term)
          : new RegExp(`^(?:${topic.ask.source})`)
        ).test(message),
    ) ?? null
  );
}

export function helpRoute(message, manager) {
  return helpTopic(message, manager) ? 'help' : null;
}

// Actions chat never takes, with where to do them instead: [reply, page].
const BLOCKED = [
  {
    match:
      /^(?:approve|reject|decline)\b.*\b(?:time[ -]?off|leave|vacation|days? off)\b/,
    manager: [
      'I can’t approve or decline time off from chat. Review it on Time off.',
      'time-off',
    ],
    worker: [
      'I can’t approve time off. Your manager reviews requests; you can follow yours on Time off.',
      'time-off',
    ],
  },
  {
    match: /^(?:approve|reject|decline)\b/,
    manager: [
      'I can’t approve or decline claims from chat. Review them on Approvals.',
      'approvals',
    ],
    worker: [
      'I can’t approve or decline from chat. Your manager approves claims; answer coworkers’ invitations on Cover requests.',
      'cover',
    ],
  },
  {
    match: /^publish\b/,
    manager: [
      'I can’t publish from chat. Review and publish the schedule on Schedule.',
      'schedule',
    ],
    worker: [
      'I can’t publish the schedule. Your manager publishes it; your shifts are on My shifts.',
      'shifts',
    ],
  },
  {
    match: /^(?:delete|cancel)\b/,
    manager: [
      'I can’t delete or cancel shifts from chat. Change them on Schedule.',
      'schedule',
    ],
    worker: [
      'I can’t cancel shifts. To get out of one, request cover on My shifts.',
      'shifts',
    ],
  },
  {
    match: /^assign me\b/,
    manager: [
      'I can’t assign shifts that way. Use Schedule, or ask me to prepare a shift draft.',
      'schedule',
    ],
    worker: [
      'I can’t assign shifts. Claim an open shift on Open shifts instead.',
      'open',
    ],
  },
  {
    match: /^swap\b/,
    manager: [
      'I can’t swap shifts from chat. Change assignments on Schedule.',
      'schedule',
    ],
    worker: [
      'I can’t swap shifts. Request cover on My shifts instead.',
      'shifts',
    ],
  },
  {
    match: /^fire\b/,
    manager: [
      'I can’t remove employees from chat. Deactivate them on Team.',
      'team',
    ],
  },
  {
    match: /^clock me (?:in|out)\b/,
    manager: [
      'CoverShift doesn’t track clock-ins or clock-outs, so I can’t do that.',
      null,
    ],
    worker: [
      'CoverShift doesn’t track clock-ins or clock-outs, so I can’t do that.',
      null,
    ],
  },
  {
    match: /^request (?:time[ -]?off|leave)\b/,
    manager: [
      'I can’t request time off from chat. Employees request it, and you review it on Time off.',
      'time-off',
    ],
  },
];

/**
 * A specific reply for a blocked command: what chat can't do and the page to
 * use instead, as { message, page } (page may be null). Null when there is no
 * specific answer, for example instruction overrides or role changes.
 */
export function blockedActionHelp(request, manager) {
  const message = normalizedMessage(request);
  const rule = BLOCKED.find((item) => item.match.test(message));
  const answer = rule?.[roleKey(manager)];
  return answer ? { message: answer[0], page: answer[1] } : null;
}
