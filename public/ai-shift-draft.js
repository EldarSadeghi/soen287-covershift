import { bindChatSend } from './ai-chat-send.js';
import { createChatCards } from './ai-chat-cards.js';
import { createChatView } from './ai-chat-view.js';
import { createEmployeeChatState } from './ai-employee-state.js';
import { createChatState, openAiReview } from './ai-chat-state.js';

export function mountAiChat(account, csrfToken) {
  let storage;
  try {
    storage = sessionStorage;
  } catch {
    storage = {
      getItem() {},
      setItem() {
        throw new Error();
      },
      removeItem() {},
    };
  }
  const manager = account.user.role === 'manager';
  const chat = (manager ? createChatState : createEmployeeChatState)(
    storage,
    `${account.business.id}:${account.user.id}`,
  );

  const flow = {
    busy: false,
    revision: 0,
    reviewing: false,
    mode: chat.value.mode || (manager ? 'draft' : 'search'),
  };
  const view = createChatView(manager, chat, flow);
  const cards = createChatCards({
    account,
    manager,
    chat,
    csrfToken,
    flow,
    view,
  });
  const {
    notice,
    messages,
    say,
    find,
    composer,
    samples,
    observer,
    dialog,
    launcher,
  } = view;
  const {
    batchReview,
    showSuggestion,
    availability,
    employeeRequests,
    explanations,
  } = cards;
  if (manager && chat.value.batch) batchReview.show(chat.value.batch);
  else if (manager)
    showSuggestion(chat.value.refinementPending ? null : chat.value.suggestion);
  else if (!availability.restore() && !chat.value.refinementPending)
    employeeRequests.restore();
  if (!manager && chat.value.availabilityDraft && !chat.value.outcome)
    notice('Continue describing your availability to review a fresh draft.');
  if (chat.value.completion) notice('Shift saved successfully.');
  else if (chat.value.uncertainDraftId)
    notice('Save not confirmed. Check the saved schedule before trying again.');
  document.addEventListener('ai:shift-created', (event) => {
    if (
      !manager ||
      !chat.markCreated(event.detail?.draftId, event.detail?.result)
    )
      return;
    // Replace the old proposed/unsaved reply, keeping bounded alternating history.
    messages.replaceChildren();
    for (const message of chat.value.messages) say(message.role, message.text);
    showSuggestion(chat.value.suggestion);
    notice('Shift saved successfully.');
  });
  document.addEventListener('ai:shift-save-uncertain', (event) => {
    if (!manager || !chat.markUncertain(event.detail?.draftId)) return;
    messages.replaceChildren();
    for (const message of chat.value.messages) say(message.role, message.text);
    showSuggestion(chat.value.suggestion);
    notice('Save not confirmed. Check the saved schedule before trying again.');
  });
  find('.ai-chat-controls .ai-chat-new').addEventListener('click', () => {
    if (chat.value.batch?.status === 'uncertain') {
      notice(
        'Check the batch receipt or retry the same batch before starting a new chat.',
      );
      return;
    }
    flow.revision++;
    explanations?.reset();
    employeeRequests?.reset();
    availability?.reset();
    const ruleChangePending = chat.value.ruleChangePending;
    chat.reset();
    if (ruleChangePending) chat.value.ruleChangePending = true;
    flow.mode = manager ? 'draft' : 'search';
    chat.save();
    document.dispatchEvent(new Event('ai:cancel-review'));
    messages.replaceChildren();
    showSuggestion(null);
    composer.value = '';
    samples.hidden = false;
    notice(
      flow.busy
        ? 'New chat started. Wait for the earlier request to finish before sending.'
        : 'New chat started. Type your question below.',
    );
    composer.focus();
  });

  bindChatSend({ manager, chat, csrfToken, flow, view, cards });
  // Independent Schedule/roster loading signals when a carried draft can be reviewed.
  document.addEventListener('ai:form-ready', () => {
    const pending = chat.value.pending;
    if (
      manager &&
      pending &&
      location.pathname === '/workspace/manager/schedule'
    ) {
      if (Date.now() - pending.createdAt >= 10 * 60 * 1000) {
        chat.value.pending = null;
        chat.save();
        notice(
          'The carried draft expired. Open the assistant and request a fresh suggestion.',
        );
        return;
      }
      if (openAiReview(pending)) {
        chat.value.pending = null;
        chat.save();
      }
    }
  });
  return {
    clear() {
      flow.revision++;
      observer.disconnect();
      explanations?.reset();
      employeeRequests?.reset();
      availability?.reset();
      chat.clear();
      dialog.remove();
      launcher.remove();
    },
  };
}
