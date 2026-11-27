// Commands the chat cannot carry out: approvals, deletions, account changes,
// instruction overrides. A message containing one is never routed to a task,
// even if another part of it would be ("create a shift and approve Sam's claim").
import { anyOf, chatRequests, normalizedMessage } from './text.js';

const UNSUPPORTED_ACTION = anyOf(
  [
    /ignore\b.*\b(?:instructions?|rules|prompt)\b/,
    /(?:approve|reject|decline|delete|fire|publish|send|swap)\b/,
    /assign me\b/,
    /clock me (?:in|out)\b/,
    // "cancel my shift", "cancel Jamie's Friday shift" (not rules or requests).
    /cancel\b(?![^.!?]*\b(?:rules?|availability|requests?|claims?|invitations?|time[ -]off|leave)\b)[^.!?]*\bshifts?\b/,
    /request (?:time[ -]off|leave)\b/,
    /make \w+ (?:a |an )?(?:manager|admin)\b/,
    /give me admin\b/,
  ],
  { before: '^' },
);

// Employees can prepare these as drafts for review (CS-062).
const EMPLOYEE_DRAFT_COMMAND =
  /^(?:request (?:time[ -]off|leave)|swap my shift)\b/;

export const UNSUPPORTED_ACTION_MESSAGE =
  'I can’t approve, assign, delete, send or change records from chat. Use the workspace pages for that, or ask me to check the schedule, find open shifts or prepare a draft for you to review.';

export function requestsUnsupportedAction(text, manager = false) {
  return chatRequests(text).some((request) => {
    const message = normalizedMessage(request);
    if (!manager && EMPLOYEE_DRAFT_COMMAND.test(message)) return false;
    return UNSUPPORTED_ACTION.test(message);
  });
}
