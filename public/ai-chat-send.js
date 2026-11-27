import { sendProviderMessage } from './ai-chat-provider.js';
import {
  MIXED_INTENT_QUESTION,
  MANAGER_LOOKUPS,
  EMPLOYEE_LOOKUPS,
  EMPLOYEE_DRAFTS,
  OPENING_CLARIFICATION,
  GENERIC_CLARIFICATION_PREFIX,
  availabilityNeedsHours,
  availabilityRuleCommand,
  chatClarification,
  needsIntentFallback,
  openingReference,
  requestsUnsupportedAction,
  resolveChatTarget,
  requestsShiftBatch,
  routeChat,
  workingSummaryWeek,
} from './ai-chat-routing.js';
import { requestJSON } from './request.js';

export function bindChatSend({ manager, chat, csrfToken, flow, view, cards }) {
  const {
    form,
    messages,
    composer,
    dialog,
    notice,
    say,
    working,
    showQuickReplies,
    refreshUsage,
  } = view;
  const {
    statusLookups,
    employeeRequests,
    explanations,
    availability,
    showSuggestion,
    showAlternatives,
    loadWorkingSummary,
    showCoworkerAvailability,
    showTeamAvailability,
    showManagerLookup,
    showEmployeeLookup,
    showHelp,
    showBlocked,
    showCapabilities,
  } = cards;
  // The last two complete turns, each with a user and an
  // assistant, each at most 1,500 characters, at most 4,500 bytes in total).
  function recentTurns() {
    const all = chat.value.messages;
    const start = all.length % 2;
    const turns = all
      .slice(start)
      .slice(-4)
      .map(({ role, text }) => ({ role, text: String(text).slice(0, 1500) }));
    while (
      turns.length &&
      (turns[0].role !== 'user' ||
        new TextEncoder().encode(JSON.stringify(turns)).length > 4500)
    )
      turns.splice(0, 2);
    return turns.every(
      (turn, index) =>
        turn.role === (index % 2 ? 'assistant' : 'user') && turn.text.trim(),
    )
      ? turns
      : [];
  }
  // Asks the server to classify a message the local rules could not route.
  // Returns { intent, pass } on success, {} to keep the local clarification,
  // or null when the session expired and the page is navigating away.
  async function classifyUnmatched(text) {
    const allowed = [
      'questions',
      'summary',
      ...(manager
        ? ['draft', 'shiftEdit', ...MANAGER_LOOKUPS]
        : [
            'search',
            'availability',
            'coworkers',
            ...EMPLOYEE_LOOKUPS,
            ...EMPLOYEE_DRAFTS,
            'claimStatus',
            'coverStatus',
            'timeOffStatus',
          ]),
    ];
    working(true);
    try {
      const result = await requestJSON('/api/ai-intent', {
        method: 'POST',
        readOnly: true,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ description: text, history: recentTurns() }),
      });
      if (result.status === 401) {
        chat.clear();
        location.replace('/login?expired=1');
        return null;
      }
      const intent = result.data?.intent;
      if (!result.ok || !allowed.includes(intent)) return {};
      return {
        intent,
        pass: typeof result.data.pass === 'string' ? result.data.pass : null,
      };
    } catch {
      return {}; // The local clarification remains available when inference fails.
    } finally {
      working(false);
      void refreshUsage();
    }
  }
  // Private routing log: only the route and how it was decided, never the text.
  function recordRoute(text, routed, target, askedClassifier) {
    const decidedBy = askedClassifier
      ? 'classifier'
      : requestsUnsupportedAction(text, manager)
        ? 'unsupported'
        : target !== routed
          ? 'follow-up'
          : target === 'clarification'
            ? 'local-clarification'
            : 'local';
    void requestJSON('/api/ai-routing-log', {
      method: 'POST',
      readOnly: true,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        route: target,
        decidedBy,
        clarification: target === 'clarification',
      }),
    }).catch(() => {}); // Logging never affects the chat.
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (flow.busy) return;
    for (const group of messages.querySelectorAll('.ai-chat-quick'))
      group.remove();
    if (chat.value.batch?.status === 'uncertain') {
      notice(
        'Check the batch receipt or retry the same batch before sending another message.',
      );
      return;
    }
    const text = composer.value.trim();
    if (!text) {
      notice('Write a message first.');
      composer.focus();
      return;
    }
    const timingStart = performance.now();
    delete dialog.dataset.progressMs;
    delete dialog.dataset.answerMs;
    const previous = chat.value.messages.at(-1);
    const previousTopic = previous?.topic;
    const currentTopic =
      ['summary', ...MANAGER_LOOKUPS].includes(previousTopic) ||
      Object.hasOwn(statusLookups, previousTopic)
        ? previousTopic
        : previous && previousTopic !== 'clarification'
          ? flow.mode
          : null;
    const routed = routeChat(text, manager, currentTopic);
    const previousLookup = statusLookups[previousTopic]?.lookup;
    // Follow-up routing lives in resolveChatTarget so it can be tested; it
    // never lets an unsupported command continue an earlier question.
    let { target, statusLookup, choice } = resolveChatTarget({
      text,
      manager,
      routed,
      previous,
      batchClarifying: chat.value.batchClarifying,
      hasSelectedOpening: () =>
        Boolean(employeeRequests.openingContext().selectedId),
      statusTopics: Object.keys(statusLookups),
      choiceReply: previousLookup
        ? (reply) => previousLookup.choiceReply(reply)
        : null,
    });
    // Only the generic "What would you like me to check" fallback asks the
    // server-side classifier; specific clarifications stay local.
    let intentPass = null;
    const askedClassifier =
      target === 'clarification' && needsIntentFallback(text, manager);
    if (askedClassifier) {
      const classified = await classifyUnmatched(text);
      if (classified === null) return;
      if (classified.intent) {
        target = classified.intent;
        statusLookup = Object.hasOwn(statusLookups, target);
        intentPass = classified.pass;
      }
    }
    recordRoute(text, routed, target, askedClassifier);
    const wasClarifyingBatch = manager && chat.value.batchClarifying;
    const batch =
      manager &&
      target === 'draft' &&
      (requestsShiftBatch(text) || wasClarifyingBatch);
    const freshEdit =
      target === 'shiftEdit' &&
      !chat.value.editSelection &&
      (routeChat(text, manager, null) === 'shiftEdit' || askedClassifier);
    const freshEmployeeDraft =
      EMPLOYEE_DRAFTS.includes(target) &&
      (routeChat(text, manager, null) === target || askedClassifier);
    const sameTopic = flow.mode === target && !freshEdit && !freshEmployeeDraft;
    const inScope = chat.value.messages.slice(-8);
    let history = [];
    if (
      previous?.topic === 'clarification' &&
      !previous.text.startsWith(MIXED_INTENT_QUESTION) &&
      target !== 'clarification'
    ) {
      history = inScope.slice(-2);
    } else if (sameTopic && !chat.value.draftCancelled) {
      const topicStart = inScope.findLastIndex(
        (message) => message.topic && message.topic !== target,
      );
      history = inScope.slice(topicStart + 1);
    }
    history = history.map(({ role, text }) => ({ role, text }));
    const encoder = new TextEncoder();
    while (
      history.length &&
      encoder.encode(JSON.stringify(history)).length > 4500
    )
      history.splice(0, 2);
    if (
      !statusLookup &&
      sameTopic &&
      (chat.value.completion ||
        chat.value.uncertainDraftId ||
        chat.value.outcome)
    ) {
      notice(
        'Use the saved schedule, coverage or availability controls for existing records. Start a new chat for a new draft.',
      );
      return;
    }
    function appendTurn(reply) {
      chat.value.messages.push(
        { role: 'user', text, topic: target },
        { role: 'assistant', text: reply, topic: target },
      );
      chat.value.messages = chat.value.messages.slice(-10);
      while (JSON.stringify(chat.value.messages).length >= 10000)
        chat.value.messages.splice(0, 2);
      while (messages.children.length > chat.value.messages.length - 1)
        messages.firstElementChild.remove();
      say('assistant', reply);
      if (composer.value.trim() === text) composer.value = '';
      chat.value.composer = composer.value;
      chat.save();
    }
    if (statusLookup) {
      explanations.reset();
      say('user', text);
      const { lookup, reply } = statusLookups[target];
      if (choice === null) {
        const clarification =
          'Which one do you mean? Try a number from the list or add a date and time of day.';
        appendTurn(clarification);
        notice(clarification, true);
      } else {
        appendTurn(reply);
        if (choice !== undefined) await lookup.loadChoice(choice);
        else await lookup.load(text);
      }
      return;
    }
    if (EMPLOYEE_LOOKUPS.includes(target)) {
      say('user', text);
      appendTurn('I’ll check your saved records.');
      await showEmployeeLookup(target, text);
      return;
    }
    if (target === 'summary') {
      const week = workingSummaryWeek(text);
      explanations?.reset();
      say('user', text);
      if (!week) {
        showSuggestion(null);
        appendTurn('Which summary should I show, this week or next week?');
        notice('Reply with this week or next week.');
        return;
      }
      appendTurn('I’ll check the saved records for that week.');
      await loadWorkingSummary(week);
      return;
    }
    const { alternateTo, criteria, explainedShiftId } = chat.value;
    const rememberedShift =
      previous?.topic === 'explanation'
        ? explainedShiftId || alternateTo
        : ['alternatives', 'search'].includes(previous?.topic)
          ? alternateTo
          : null;
    const alternative =
      explanations?.alternativeContext() ||
      (rememberedShift && criteria
        ? { shiftId: rememberedShift, criteria, bounded: true }
        : null);
    if (target === 'alternatives') {
      say('user', text);
      if (!alternative?.bounded) {
        appendTurn(
          alternative
            ? 'Use “Find alternatives on this date (any hours)” to approve that search, or tell me the date and hours you prefer.'
            : 'Which shift should I use? Ask why a specific opening did not match, or specify the date and hours for a new search.',
        );
        notice('Choose a search scope to continue.');
        return;
      }
      explanations.reset();
      appendTurn('I’ll check alternatives within your current search limits.');
      await showAlternatives(alternative.shiftId, alternative.criteria);
      return;
    }
    explanations?.reset();
    if (
      !manager &&
      !['search', 'explanation', 'clarification'].includes(target)
    ) {
      chat.value.criteria = null;
      chat.value.alternateTo = null;
    }
    if (MANAGER_LOOKUPS.includes(target)) {
      const earlier = chat.value.messages.at(-2)?.text;
      const continuing =
        previousTopic === target &&
        routed === 'clarification' &&
        /^Which (?:date|shift)/.test(previous.text) &&
        earlier;
      say('user', text);
      appendTurn('I’ll check the saved records.');
      const query = continuing ? earlier + ' ' + text : text;
      if (target === 'teamAvailability') {
        await showTeamAvailability(query, continuing ? earlier : text);
      } else {
        // A date reply replaces the earlier dates; the rest of the question stays.
        await showManagerLookup(target, query, continuing ? text : null);
      }
      return;
    }
    if (target === 'coworkers') {
      employeeRequests.reset();
      availability.reset();
      chat.value.refinementPending = true;
      say('user', text);
      appendTurn('I’ll check your coworkers’ confirmed free windows.');
      await showCoworkerAvailability(text);
      return;
    }
    if (target === 'explanation') {
      const { visibleIds, selectedId } = employeeRequests.openingContext();
      const reference =
        /^why not[.!?]*$/i.test(text) && selectedId
          ? selectedId
          : openingReference(text, visibleIds, selectedId);
      if (reference === null) {
        say('user', text);
        appendTurn(
          visibleIds.length
            ? `${OPENING_CLARIFICATION} Use its shift title or a position in the last results.`
            : `${OPENING_CLARIFICATION} Use its shift title, or refresh the search to refer to a result by position.`,
        );
        notice('Choose an opening to continue.');
        return;
      }
      chat.value.alternateTo = null;
      employeeRequests.reset({ keepSearch: true });
      availability.reset();
      chat.value.refinementPending = true;
      say('user', text);
      appendTurn('I’ll check the saved request and your current eligibility.');
      await explanations.load(
        reference ? { requestId: reference } : { description: text },
      );
      return;
    }
    if (target === 'help') {
      // Fixed help text (CS-064): no request is sent and nothing is saved.
      say('user', text);
      appendTurn(showHelp(text));
      return;
    }
    if (target === 'clarification') {
      chat.value.refinementPending = true;
      chat.value.batch = null;
      chat.value.batchClarifying = false;
      chat.value.pending = null;
      document.dispatchEvent(new Event('ai:cancel-review'));
      const keepSearch = !manager && flow.mode === 'search';
      employeeRequests?.reset({ keepSearch });
      availability?.reset();
      showSuggestion(null);
      say('user', text);
      const reply = chatClarification(text, manager);
      appendTurn(reply);
      // Blocked commands link the page to use instead; the generic question
      // also lists what the chat can do (CS-064).
      if (reply.startsWith(GENERIC_CLARIFICATION_PREFIX)) {
        showQuickReplies();
        // Kept search results stay visible instead of the list.
        if (!keepSearch) showCapabilities();
      } else showBlocked(text);
      notice('Reply below to continue.');
      return;
    }
    if (target === 'rules') {
      employeeRequests.reset();
      say('user', text);
      const command = availabilityRuleCommand(text);
      appendTurn(
        command
          ? 'I’ll check your saved rules for that change.'
          : 'I’ll load your saved availability.',
      );
      await availability.list(command);
      return;
    }
    if (!sameTopic) {
      Object.assign(chat.value, {
        suggestion: null,
        shiftEdit: null,
        employeeDraft: null,
        editSelection: null,
        pending: null,
        completion: null,
        uncertainDraftId: null,
        criteria: null,
        alternateTo: null,
        availabilityDraft: null,
        outcome: null,
        draftCancelled: false,
      });
      flow.mode = target;
      chat.value.mode = target;
    }
    if (target === 'availability' && availabilityNeedsHours(text)) {
      employeeRequests.reset();
      availability.reset();
      chat.value.availabilityDraft = null;
      chat.value.refinementPending = false;
      say('user', text);
      appendTurn(
        'What hours should I use for that availability? You can give a start and end time or say “all day.”',
      );
      notice('Reply with the hours to continue.');
      return;
    }
    await sendProviderMessage(
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
    );
  });
}
