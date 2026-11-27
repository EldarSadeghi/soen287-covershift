import { CHAT_ENDPOINTS } from './ai-chat-routing.js';
import { revealResponse } from './ai-response-card.js';
import { requestJSON } from './request.js';

export async function sendProviderMessage(
  { manager, chat, csrfToken, flow, view, cards },
  {
    text,
    previous,
    batch,
    history,
    intentPass,
    encoder,
    timingStart,
    wasClarifyingBatch,
    appendTurn,
  },
) {
  const {
    messages,
    composer,
    dialog,
    notice,
    say,
    card,
    send,
    status,
    refreshUsage,
    syncResponse,
  } = view;
  const {
    employeeRequests,
    availability,
    showSuggestion,
    renderProviderReply,
  } = cards;
  const base =
    batch || previous?.topic === 'clarification'
      ? null
      : flow.mode === 'draft'
        ? chat.value.suggestion?.draft
        : flow.mode === 'availability'
          ? chat.value.availabilityDraft
          : flow.mode === 'search'
            ? chat.value.criteria
            : null;
  const body = JSON.stringify({
    description: text,
    history,
    ...(batch && { batch: true }),
    ...(base && { base }),
    ...(intentPass && { intentPass }),
  });
  if (encoder.encode(body).length > 8000) {
    notice(
      'This chat has reached its context limit. Start a new chat and include the shift details again.',
    );
    return;
  }
  const version = ++flow.revision;
  flow.busy = true;
  send.disabled = true;
  send.textContent = 'Thinking…';
  if (manager) {
    chat.value.batch = null;
    chat.value.batchClarifying = false;
    chat.value.pending = null;
    chat.value.refinementPending = Boolean(base);
    document.dispatchEvent(new Event('ai:cancel-review'));
    showSuggestion(null);
  } else {
    chat.value.refinementPending = Boolean(base);
    employeeRequests.reset();
    availability.reset();
  }
  chat.save();
  for (const bubble of messages.children) bubble.hidden = false;
  const pendingBubble = say('user', text);
  notice('Preparing a reply… You can close this panel and keep working.');
  // Allow a rendering opportunity before recording visible progress.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (
        dialog.open &&
        flow.busy &&
        version === flow.revision &&
        status.textContent.startsWith('Preparing a reply')
      ) {
        dialog.dataset.progressMs = String(
          Math.round(performance.now() - timingStart),
        );
      }
    }),
  );
  try {
    const response = await requestJSON(CHAT_ENDPOINTS[flow.mode], {
      method: 'POST',
      readOnly: true,
      acceptServerErrors: true,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body,
    });
    if (
      version !== flow.revision ||
      chat.value.completion ||
      chat.value.uncertainDraftId
    ) {
      pendingBubble.remove();
      return;
    }
    if (response.status === 401) {
      chat.clear();
      location.replace('/login?expired=1');
      return;
    }
    if (!response.ok) {
      const failure = new Error();
      failure.userMessage =
        response.data.message || 'AI could not prepare a reply.';
      throw failure;
    }
    let data = response.data;
    if (
      flow.mode === 'search' &&
      data.kind === 'matches' &&
      base &&
      chat.value.alternateTo
    ) {
      const refreshed = await requestJSON('/api/worker/shift-alternatives', {
        method: 'POST',
        readOnly: true,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          criteria: data.criteria,
          excludeShiftId: chat.value.alternateTo,
        }),
      });
      if (version !== flow.revision) {
        pendingBubble.remove();
        return;
      }
      if (refreshed.status === 401) {
        chat.clear();
        location.replace('/login?expired=1');
        return;
      }
      if (!refreshed.ok) {
        const failure = new Error();
        failure.userMessage = refreshed.data.message;
        throw failure;
      }
      data = refreshed.data;
    }
    if (
      !(
        flow.mode === 'questions'
          ? ['schedule_answer', 'clarification']
          : manager
            ? [batch ? 'batch' : 'draft', 'clarification']
            : ['matches', 'availability', 'clarification']
      ).includes(data.kind)
    )
      throw new Error('AI could not prepare a reply.');
    const reply = renderProviderReply(data, batch, appendTurn);
    if (data.kind === 'clarification') notice('Reply below to continue.');
    else
      notice(
        data.kind === 'matches'
          ? reply
          : card.querySelector('h3')?.textContent || 'Your response is ready.',
        true,
      );
    syncResponse();
    if (!card.hidden) revealResponse(card);
    dialog.dataset.answerMs = String(
      Math.round(performance.now() - timingStart),
    );
    if (dialog.open) composer.focus({ preventScroll: true });
  } catch (error) {
    pendingBubble.remove();
    if (
      version === flow.revision &&
      !chat.value.completion &&
      !chat.value.uncertainDraftId
    ) {
      card.replaceChildren();
      card.hidden = true;
      if (batch && wasClarifyingBatch) chat.value.batchClarifying = true;
      chat.value.composer = composer.value;
      chat.save();
      notice(
        error.userMessage ||
          `AI is unavailable or took too long. Your message is preserved. Try sending again later${flow.mode === 'questions' ? ' or open your saved schedule' : manager ? ' or use the manual Schedule form' : flow.mode === 'availability' ? '; Saved availability remains available' : ' or use Open shifts'}. An attempt may still count toward your allowance.`,
      );
    }
  } finally {
    void refreshUsage();
    if (version !== flow.revision)
      notice('The earlier request finished. Your new chat is ready.');
    flow.busy = false;
    send.disabled = false;
    send.innerHTML = 'Send message <span aria-hidden="true">↑</span>';
  }
}
