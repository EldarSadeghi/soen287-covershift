import { HttpError } from '../auth/errors.js';
import { findClaimConflicts } from '../../public/claim-conflicts.js';
import { openShiftSnapshot } from '../requests/open.js';
import { coverageDisplayState } from '../requests/status.js';
import { availabilityAccount, ruleStatus } from './rules.js';
import { matchesForRule, ruleShiftLimits } from './matching.js';

const shiftFields = ({ title, startsAt, endsAt }) => ({ title, startsAt, endsAt });
const statusMessages = {
  pending: 'Your request is awaiting manager approval. The original worker remains assigned until approval.',
  approved: 'The manager approved your coverage request.',
  rejected: 'The manager rejected your coverage request. The record does not establish why.',
  cancelled: 'The coverage request was cancelled.',
  expired: 'The shift started before the request was resolved.',
};
const conflictMessages = {
  assigned: 'This shift overlaps one of your assigned shifts.',
  pending_claim: 'This shift overlaps one of your pending coverage requests.',
  time_off: 'This shift overlaps your approved time off.',
};

export async function explainAvailability(store, userId, input, clock = Date.now) {
  const byId = typeof input?.requestId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(input.requestId);
  const byMessage = typeof input?.description === 'string' && input.description.trim() && input.description.length <= 1500;
  if (!input || Array.isArray(input) || Object.keys(input).length !== 1 || (!byId && !byMessage)) {
    throw new HttpError(422, 'Choose a coverage request or describe which shift you mean.');
  }

  const db = await store.read();
  const { user, business } = availabilityAccount(db, userId);
  const now = clock();
  const board = openShiftSnapshot(db, user.id, now);
  const openIds = new Set(board.requests.map(request => request.id));
  const shifts = new Map(db.shifts.filter(shift => shift.businessId === business.id).map(shift => [shift.id, shift]));
  const options = db.coverageRequests.filter(request => request.businessId === business.id &&
    (request.claimantId === user.id || openIds.has(request.id)) && shifts.has(request.shiftId))
    .map(request => {
      const shift = shifts.get(request.shiftId);
      return { request, shift, status: coverageDisplayState(request, shift, now).displayStatus };
    }).sort((a, b) => b.request.updatedAt.localeCompare(a.request.updatedAt) || a.request.id.localeCompare(b.request.id));

  const meta = { timezone: business.timezone, asOf: new Date(now).toISOString() };
  let selected;
  if (byId) {
    selected = options.find(option => option.request.id === input.requestId);
    if (!selected) throw new HttpError(404, 'That request is no longer visible to you. Ask again to choose a current request.');
  } else {
    const normalize = text => text.toLocaleLowerCase().replace(/[“”]/g, '"');
    const description = normalize(input.description);
    const quoted = [...description.matchAll(/"([^"]+)"/g)].map(match => match[1]);
    const matches = options.filter(({shift}) => {
      const title = normalize(shift.title);
      return quoted.length ? quoted.includes(title) : description.includes(title);
    });
    selected = matches.length === 1 ? matches[0] : options.length === 1 && !quoted.length && /\b(?:my request|my match|this shift)\b/i.test(input.description) ? options[0] : null;
    if (!selected) {
      const choices = quoted.length || matches.length ? matches : options;
      return { kind: 'explanation_choices', ...meta, total: choices.length,
        choices: choices.slice(0, 12).map(({ request, shift, status }) => ({ id: request.id, status, shift: shiftFields(shift) })) };
    }
  }

  const { request, shift, status } = selected;
  const match = (db.availabilityMatches || []).find(row => row.requestId === request.id &&
    row.workerId === user.id && row.businessId === business.id);
  const recorded = match
    ? ['A saved availability rule submitted this request automatically.', statusMessages[status]]
    : [statusMessages[status]];
  const current = [];
  let rules = [];
  if (status === 'open') {
    const retried = db.coverageRequests.some(row => row.businessId === business.id && row.shiftId === shift.id &&
      row.claimantId === user.id && row.status === 'rejected') ||
      (db.availabilityMatches || []).some(row => row.businessId === business.id && row.shiftId === shift.id && row.workerId === user.id);
    if (retried) current.push('Automatic matching does not repeat a previous match or a rejected claim for the same shift.');
    for (const conflict of findClaimConflicts(shift, board.commitments)) {
      const reason = conflictMessages[conflict.kind];
      if (reason && !current.includes(reason)) current.push(reason);
    }
    rules = (db.availabilityRules || []).filter(rule => rule.businessId === business.id && rule.workerId === user.id)
      .map(rule => {
        const used = matchesForRule(db, rule.id).length;
        const state = ruleStatus(rule, now);
        const limits = ruleShiftLimits(rule, shift, used);
        const reasons = [];
        if (state !== 'active') reasons.push(`This rule is ${state}.`);
        if (rule.timezone !== business.timezone) reasons.push('The business timezone changed since this rule was saved.');
        if (limits.window) reasons.push('The full shift falls outside the rule’s time window.');
        if (limits.title) reasons.push('The shift title does not match the rule’s title filter.');
        if (limits.capacity) reasons.push('This rule has used all of its automatic requests.');
        return { ...shiftFields(rule), timezone: rule.timezone, status: state, used, maximum: rule.maxClaims, reasons };
      }).filter(rule => ['active', 'paused'].includes(rule.status));
    if (!rules.length) current.push('You have no active or paused saved rules for automatic matching.');
    if (!current.length && rules.some(rule => !rule.reasons.length)) current.push('At least one of your rules passes the checks shown here. This check does not submit or reserve a request.');
  }
  return {
    kind: 'availability_explanation', ...meta, requestId: request.id, shift: shiftFields(shift), status, recorded: recorded.filter(Boolean), current,
    rules: rules.slice(0, 20), ruleCount: rules.length,
    ...(status === 'open' && { priority: 'For an open shift, automatic matching checks eligible rules in confirmation order, starting with the earliest.' }),
    next: status === 'open' ? 'open' : 'requests',
  };
}
