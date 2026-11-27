// Commands the chat cannot carry out: approvals, deletions, account changes,
// instruction overrides. A message containing one is never routed to a task,
// even if another part of it would be ("create a shift and approve Sam's claim").
import { anyOf, chatRequests, normalizedMessage } from './text.js';
import { followThroughRoute } from './employee.js';

const UNSUPPORTED_ACTION = anyOf(
  [
    /ignore\b.*\b(?:instructions?|rules|prompt)\b/,
    /(?:approve|reject|decline|delete|fire|publish|send|swap)\b/,
    /assign me\b/,
    /clock me (?:in|out)\b/,
    // "cancel my shift", "cancel Jamie's Friday shift", whatever reason follows.
    // Only the words between "cancel" and "shift" are checked, so cancelling a
    // rule, claim or request about a shift is not blocked here.
    /cancel\b(?:(?!\b(?:rules?|availability|requests?|claims?|invitations?|time[ -]off|leave)\b)[^.!?])*?\bshifts?\b/,
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

// An employee answering or withdrawing their own request (CS-067): "decline
// Alex's invite", or "decline it" when the message is about an invitation.
const BARE_ANSWER =
  /^(?:decline|reject|turn (?:it|that|this) down)(?: (?:it|that|this|the invite|the invitation))?[.!?]*$/;

// Exempt only when every comma-separated part is the follow-through itself or
// harmless, so "decline the invite, delete my shift" is still blocked.
function followThroughOnly(message, aboutInvitation) {
  const parts = message.split(/\s*(?:,|;|\s[-–—]\s)\s*/);
  return (
    parts.some((part) => followThroughRoute(part) || BARE_ANSWER.test(part)) &&
    parts.every(
      (part) =>
        followThroughRoute(part) ||
        (aboutInvitation && BARE_ANSWER.test(part)) ||
        !UNSUPPORTED_ACTION.test(part),
    )
  );
}

export function requestsUnsupportedAction(text, manager = false) {
  const aboutInvitation =
    !manager && followThroughRoute(normalizedMessage(text)) === 'answerInvite';
  return chatRequests(text).some((request) => {
    const message = normalizedMessage(request);
    if (!manager && EMPLOYEE_DRAFT_COMMAND.test(message)) return false;
    if (!manager && followThroughOnly(message, aboutInvitation)) return false;
    return UNSUPPORTED_ACTION.test(message);
  });
}
