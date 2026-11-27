// Help card for chat (CS-064): steps or a definition from the fixed help
// catalog, or where to go for an action chat can't take, with one link to a
// page of the asker's role. Nothing is loaded or saved.
import { HELP_PAGES, HELP_TOPICS } from './routing/help.js';
import { responseHeader } from './ai-response-card.js';
import { element } from './shift-card.js';

const roleKey = (manager) => (manager ? 'manager' : 'worker');

export const CAPABILITIES = HELP_TOPICS.find(
  (topic) => topic.id === 'capabilities',
);

function pageLink(card, page, manager) {
  if (!page) return;
  const role = roleKey(manager);
  const link = element('a', 'ai-chat-review', `Open ${HELP_PAGES[role][page]}`);
  link.href = `/workspace/${role}/${page}`;
  card.append(link);
}

/**
 * Shows a help topic and returns the short chat reply (its first step, or the
 * title when that step is long), so the chat history stays brief.
 */
export function renderHelp(card, topic, manager) {
  const role = roleKey(manager);
  const steps = topic.steps[role];
  card.replaceChildren();
  responseHeader(card, 'Help · Nothing saved', topic.title);
  for (const step of steps) card.append(element('p', '', step));
  pageLink(card, topic.page[role], manager);
  return steps[0].length <= 180
    ? steps[0]
    : `${topic.title}: see the steps below.`;
}

/** Shows where to go for a command chat can't carry out. */
export function renderBlocked(card, answer, manager) {
  card.replaceChildren();
  responseHeader(
    card,
    'Not available in chat',
    'Use the workspace page',
    'pending',
  );
  card.append(element('p', '', answer.message));
  pageLink(card, answer.page, manager);
  return answer.message;
}
