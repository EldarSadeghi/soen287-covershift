import {
  reviewEmployeeDraft,
  showEmployeeDraft,
} from './ai-employee-drafts.js';
import { renderEmployeeLookup } from './ai-employee-lookups.js';
import {
  EMPLOYEE_DRAFTS,
  coworkerLookupDate,
  coworkersFreeOnDate,
  historyPeriod,
  isDutiesQuestion,
  isStatusDateFollowUp,
  blockedActionAnswer,
  helpTopic,
} from './ai-chat-routing.js';
import { sendEditToSchedule, showShiftEdit } from './ai-shift-edit.js';
import { CAPABILITIES, renderBlocked, renderHelp } from './ai-help.js';
import {
  managerLookupQuery,
  renderManagerLookup,
} from './ai-manager-lookups.js';
import {
  teamAvailabilityQuery,
  selectAvailabilityWorkers,
  renderTeamAvailability,
} from './ai-team-availability.js';
import {
  createClaimStatus,
  createCoverStatus,
  createTimeOffStatus,
} from './ai-claim-status.js';
import {
  showWorkingSummary,
  workingSummaryMessage,
} from './ai-working-summary.js';
import { createBatchReview } from './ai-shift-batch.js';
import { createAvailabilityExplanations } from './ai-availability-explanation.js';
import {
  localDate,
  localShiftFields,
  responseHeader,
  revealResponse,
  responseMeta,
  responseNote,
  savedShiftFields,
} from './ai-response-card.js';
import { scheduleAnswerMessage, showScheduleAnswer } from './ai-schedule.js';
import {
  createAvailabilityControls,
  availabilitySummary,
} from './ai-availability.js';
import {
  createEmployeeRequests,
  employeeSearchMessage,
} from './ai-employee-request.js';
import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';
import { openAiReview } from './ai-chat-state.js';

export function createChatCards({
  account,
  manager,
  chat,
  csrfToken,
  flow,
  view,
}) {
  const { card, notice, working, outcomeText, close, dialog, launcher } = view;
  const claimStatus = !manager
    ? createClaimStatus({
        card,
        chat,
        notice,
        setBusy: working,
        onOutcome: outcomeText,
      })
    : null;
  const coverStatus = !manager
    ? createCoverStatus(
        { card, chat, notice, setBusy: working, onOutcome: outcomeText },
        account.user.id,
      )
    : null;
  const timeOffStatus = !manager
    ? createTimeOffStatus({
        card,
        chat,
        notice,
        setBusy: working,
        onOutcome: outcomeText,
      })
    : null;
  const statusLookups = {
    claimStatus: {
      lookup: claimStatus,
      reply: 'I’ll check your saved claims.',
    },
    coverStatus: {
      lookup: coverStatus,
      reply: 'I’ll check your sent cover invitations.',
    },
    timeOffStatus: {
      lookup: timeOffStatus,
      reply: 'I’ll check your time-off requests.',
    },
  };
  const batchReview = manager
    ? createBatchReview({
        card,
        chat,
        csrfToken,
        notice,
        setBusy: working,
        onOutcome: outcomeText,
        canAct: () => !flow.busy,
      })
    : null;
  const availability = !manager
    ? createAvailabilityControls({
        chat,
        card,
        notice,
        csrfToken,
        setBusy: working,
        onOutcome: outcomeText,
      })
    : null;

  const explanations = !manager
    ? createAvailabilityExplanations({
        chat,
        card,
        notice,
        csrfToken,
        setBusy: working,
        onOutcome: outcomeText,
        onAlternatives: showAlternatives,
      })
    : null;
  const employeeRequests = !manager
    ? createEmployeeRequests({
        chat,
        card,
        notice,
        csrfToken,
        setBusy: working,
        onOutcome: outcomeText,
      })
    : null;

  async function showAlternatives(shiftId, criteria) {
    if (await employeeRequests.alternatives(shiftId, criteria)) {
      explanations.reset();
      flow.mode = 'search';
      chat.value.mode = flow.mode;
      chat.save();
    }
  }

  async function loadWorkingSummary(week) {
    if (flow.busy) return;
    working(true);
    notice('Checking saved records…');
    card.hidden = true;
    card.replaceChildren();
    try {
      const response = await requestJSON(
        `/api/ai-working-summary?week=${week}`,
        { cache: 'no-store' },
      );
      if (response.status === 401) {
        chat.clear();
        location.replace('/login?expired=1');
        return;
      }
      if (!response.ok || response.data.kind !== 'working_summary')
        throw new Error();
      const message = workingSummaryMessage(response.data);
      showWorkingSummary(
        card,
        response.data,
        () => void loadWorkingSummary(week),
      );
      outcomeText(message);
      notice(message, true);
    } catch {
      card.hidden = false;
      responseHeader(
        card,
        'Could not refresh',
        'Summary unavailable',
        'uncertain',
      );
      card.append(
        responseNote(
          'The latest saved records could not be checked. Try refreshing the summary.',
          'uncertain',
        ),
      );
      const retry = element('button', 'ai-chat-review', 'Retry summary');
      retry.type = 'button';
      retry.addEventListener('click', () => void loadWorkingSummary(week));
      card.append(retry);
      outcomeText(
        'Summary unavailable. Retry to check the latest saved records.',
      );
      notice(
        'Summary unavailable. Retry to check the latest saved records.',
        true,
      );
    } finally {
      working(false);
    }
  }
  function reviewSuggestion(data) {
    if (
      flow.busy ||
      chat.value.refinementPending ||
      chat.value.completion ||
      chat.value.uncertainDraftId ||
      data.id !== chat.value.suggestion?.id
    )
      return;
    chat.value.pending = {
      id: data.id,
      draft: data.draft,
      timezone: data.timezone,
      createdAt: Date.now(),
    };
    const persisted = chat.save();
    if (location.pathname === '/workspace/manager/schedule') {
      flow.reviewing = true;
      close();
      if (openAiReview(data)) {
        chat.value.pending = null;
        chat.save();
      } else {
        flow.reviewing = false;
        dialog.showModal();
        launcher.setAttribute('aria-expanded', 'true');
        notice(
          'The shift form is still loading or unavailable. Refresh workers or finish a pending save, then try Review shift again.',
        );
      }
    } else if (persisted) {
      location.assign('/workspace/manager/schedule');
    } else {
      chat.value.pending = null;
      notice(
        'This browser cannot carry a draft between pages. Open Schedule first, then create the suggestion there.',
      );
    }
  }
  function showSuggestion(data) {
    card.replaceChildren();
    card.hidden = !data;
    if (!data) return;
    const completion = chat.value.completion;
    if (completion && completion.draftId === data.id) {
      responseHeader(
        card,
        completion.draft ? 'Private draft saved' : 'Shift created',
        completion.draft
          ? 'Publish the schedule to release this shift.'
          : 'Your shift is saved.',
        'success',
      );
      card.append(
        savedShiftFields(
          completion.shift,
          completion.timezone,
          completion.shift.assignedWorker.name,
        ),
      );
      const schedule = element('a', 'ai-chat-review', 'View schedule');
      schedule.href = '/workspace/manager/schedule';
      card.append(
        responseNote(
          completion.draft
            ? 'This draft is private. The employee will see it after schedule publication.'
            : 'Saved successfully. The employee can see this assignment in My shifts.',
          'success',
        ),
        schedule,
      );
      return;
    }
    if (chat.value.uncertainDraftId === data.id) {
      responseHeader(
        card,
        'Save not confirmed',
        'Check your saved schedule.',
        'uncertain',
      );
      card.append(
        responseNote(
          'The shift may have been saved. Check the schedule before submitting it again.',
          'uncertain',
        ),
      );
      const schedule = element('a', 'ai-chat-review', 'Check saved schedule');
      schedule.href = '/workspace/manager/schedule';
      card.append(schedule);
      return;
    }
    responseHeader(card, 'Draft · Not saved', 'Here’s the shift to review.');
    card.append(localShiftFields(data.draft, data.workerName, data.timezone));
    const review = element('button', 'ai-chat-review', 'Review shift');
    review.type = 'button';
    review.addEventListener('click', () => reviewSuggestion(data));
    card.append(
      responseNote(
        'Review and edit the Schedule form, then choose Create shift to save.',
        'neutral',
      ),
      review,
    );
  }

  async function loadLookupData(url) {
    const response = await requestJSON(url, { cache: 'no-store' });
    if (response.status === 401) {
      chat.clear();
      location.replace('/login?expired=1');
      return null;
    }
    if (!response.ok) {
      throw new Error(
        response.data?.message ||
          'The lookup could not load. Try asking again.',
      );
    }
    return response.data;
  }

  async function showEmployeeLookup(kind, text) {
    const endpoint = '/api/worker/chat-lookup';
    card.hidden = true;
    working(true);
    try {
      const params = new URLSearchParams({ kind });
      if (kind === 'history') {
        const context = await loadLookupData(endpoint);
        if (!context) return;
        const period = historyPeriod(text, context.today);
        if (!period) {
          outcomeText(
            'Which period should I check? Try “last month,” “November,” or “this year.”',
          );
          return;
        }
        params.set('period', period);
      }
      const data = await loadLookupData(endpoint + '?' + params);
      if (!data) return;
      outcomeText(renderEmployeeLookup(card, data));
      card.hidden = false;
      revealResponse(card);
    } catch (error) {
      outcomeText(error.message);
    } finally {
      working(false);
    }
  }

  // Help answers (CS-064) are fixed text: shown at once, nothing loaded.
  function showCard(render) {
    const reply = render();
    card.hidden = false;
    revealResponse(card);
    return reply;
  }
  // The help topic for the question; the capabilities list when the
  // classifier chose help for a wording the catalog doesn't match.
  function showHelp(text) {
    return showCard(() =>
      renderHelp(card, helpTopic(text, manager) ?? CAPABILITIES, manager),
    );
  }
  function showBlocked(text) {
    const answer = blockedActionAnswer(text, manager);
    return answer ? showCard(() => renderBlocked(card, answer, manager)) : null;
  }
  function showCapabilities() {
    return showCard(() => renderHelp(card, CAPABILITIES, manager));
  }

  async function showManagerLookup(
    kind,
    text,
    dateReply = null,
    priorDate = null,
  ) {
    const endpoint = '/api/manager/chat-lookup';
    card.hidden = true;
    working(true);
    try {
      const context = await loadLookupData(endpoint);
      if (!context) return;
      const query = managerLookupQuery(
        kind,
        text,
        context.today,
        dateReply,
        priorDate,
      );
      if (query.question) {
        outcomeText(query.question);
        return;
      }
      const data = await loadLookupData(
        endpoint + '?' + new URLSearchParams(query.params),
      );
      if (!data) return;
      outcomeText(renderManagerLookup(card, data));
      card.hidden = false;
    } catch (error) {
      outcomeText(error.message);
    } finally {
      working(false);
    }
  }

  async function showTeamAvailability(text, subject = text) {
    const endpoint = '/api/manager/availability-windows';
    card.hidden = true;
    working(true);
    try {
      const context = await loadLookupData(endpoint);
      if (!context) return;
      const query = teamAvailabilityQuery(
        text,
        context.today,
        context.timezone,
      );
      if (query.question) {
        outcomeText(query.question);
        return;
      }
      const data = await loadLookupData(
        endpoint + '?' + new URLSearchParams(query.params),
      );
      if (!data) return;
      const result = selectAvailabilityWorkers(data.workers, subject);
      if (result.question) {
        outcomeText(result.question);
        return;
      }
      outcomeText(
        renderTeamAvailability(card, data, query.date, result.workers),
      );
      card.hidden = false;
    } catch (error) {
      outcomeText(error.message);
    } finally {
      working(false);
    }
  }

  async function showCoworkerAvailability(text) {
    card.hidden = false;
    card.append(element('p', '', 'Checking coworker availability…'));
    working(true);
    try {
      const response = await requestJSON('/api/worker/coworker-windows');
      if (response.status === 401) {
        chat.clear();
        location.replace('/login?expired=1');
        return;
      }
      if (!response.ok)
        throw new Error(
          'Coworker availability could not load. Try asking again.',
        );
      const data = response.data;
      const date = coworkerLookupDate(text, data.horizon.startDate);
      card.replaceChildren();
      if (!date) {
        card.hidden = true;
        outcomeText(
          'Which date should I check? Say “December 1” or enter a date like 2026-12-01.',
        );
        notice('Reply with the date to continue.');
        return;
      }
      const outside =
        date < data.horizon.startDate || date > data.horizon.endDate;
      const asksForHours =
        /\b(?:\d{1,2}:\d{2}|\d{1,2}\s*[ap]m|morning|afternoon|evening|noon|midnight|all day)\b/i.test(
          text,
        );
      const coworkers =
        outside || asksForHours ? [] : coworkersFreeOnDate(data, date);
      const reply = outside
        ? 'Coworker free windows are visible within the next 14 days.'
        : asksForHours
          ? 'Use the specific-shift checker for exact hours or full-shift availability.'
          : coworkers.length
            ? `${coworkers.map((worker) => worker.name).join(', ')} ${coworkers.length === 1 ? 'has' : 'have'} confirmed free time on ${localDate(date)}.`
            : `No confirmed free windows on ${localDate(date)}. A missing window does not mean someone is unavailable.`;
      responseHeader(card, 'Coworker availability', localDate(date));
      card.append(element('p', '', reply));
      for (const worker of coworkers) {
        card.append(element('h4', '', worker.name));
        for (const window of worker.windows) {
          const time = formatShiftTime(window, data.timezone);
          card.append(
            element(
              'p',
              '',
              `${time.date} · ${time.startTime} – ${time.endDate ? time.endDate + ' · ' : ''}${time.endTime}`,
            ),
          );
        }
      }
      card.append(responseMeta(data.timezone));
      const link = element('a', 'ai-chat-review', 'Open Coworkers');
      link.href = '/workspace/worker/availability#coworkers';
      link.addEventListener('click', (click) => {
        if (location.pathname !== '/workspace/worker/availability') return;
        const switcher = document.querySelector('#av-coworker-view');
        if (!switcher) return;
        click.preventDefault();
        close();
        if (location.hash !== '#coworkers') switcher.click();
      });
      card.append(link);
      outcomeText(reply);
      notice(reply, true);
    } catch (error) {
      card.hidden = true;
      outcomeText(error.message);
      notice(error.message);
    } finally {
      working(false);
    }
  }

  function renderProviderReply(data, batch, appendTurn) {
    if (EMPLOYEE_DRAFTS.includes(flow.mode) && data.kind !== 'clarification') {
      chat.value.employeeDraft = data.selection ? data : null;
      const reply = showEmployeeDraft(card, data, () => {
        if (flow.busy || chat.value.employeeDraft !== data) return;
        if (!reviewEmployeeDraft(account, data))
          notice('Open the workspace form to review this request manually.');
      });
      appendTurn(reply);
      chat.save();
      return reply;
    }
    if (flow.mode === 'shiftEdit' && data.kind !== 'clarification') {
      const initialRequest = view.composer.value.trim();
      chat.value.shiftEdit =
        data.kind === 'shiftEdit'
          ? { id: data.id, revision: data.revision, draft: data.draft }
          : null;
      const reply = showShiftEdit(
        card,
        data,
        () => {
          if (flow.busy || chat.value.shiftEdit?.draft !== data.draft) return;
          if (!sendEditToSchedule(account, data))
            notice('Open Schedule to edit this shift manually.');
        },
        (choice) => {
          if (flow.busy) return;
          chat.value.editSelection = {
            id: choice.id,
            revision: choice.revision,
          };
          view.composer.value = initialRequest;
          view.form.requestSubmit();
        },
      );
      appendTurn(reply);
      chat.save();
      return reply;
    }
    const reply =
      data.kind === 'clarification'
        ? data.question
        : data.kind === 'batch'
          ? `${data.shifts.length} proposed shifts. Review and confirm the batch to save it.`
          : data.kind === 'schedule_answer'
            ? scheduleAnswerMessage(data)
            : data.kind === 'availability'
              ? availabilitySummary(data)
              : !manager
                ? employeeSearchMessage(data)
                : `Proposed shift: ${data.draft.title} for ${data.workerName}, ${data.draft.startLocal} to ${data.draft.endLocal}, ${data.timezone}. Nothing has been saved. You can ask me to change it or select Review shift.`;
    chat.value.draftCancelled = false;
    appendTurn(reply);
    if (data.kind === 'schedule_answer') {
      const latestQuestion = chat.value.messages.at(-2)?.text;
      const earlierQuestion = chat.value.messages.at(-4)?.text;
      const dutiesFocus =
        !manager &&
        (isDutiesQuestion(latestQuestion || '') ||
          (chat.value.messages.at(-3)?.topic === 'questions' &&
            isStatusDateFollowUp(latestQuestion || '') &&
            isDutiesQuestion(earlierQuestion || '')));
      showScheduleAnswer(card, data, { dutiesFocus });
    } else if (manager && data.kind === 'batch') {
      chat.value.suggestion = null;
      chat.value.refinementPending = false;
      batchReview.open(data);
    } else if (manager) {
      chat.value.batchClarifying = batch && data.kind === 'clarification';
      if (data.kind === 'draft')
        chat.value.suggestion = { ...data, id: crypto.randomUUID() };
      chat.value.refinementPending = data.kind === 'clarification';
      showSuggestion(
        chat.value.refinementPending ? null : chat.value.suggestion,
      );
    } else if (data.kind === 'availability' || data.kind === 'matches') {
      chat.value.refinementPending = false;
      if (data.kind === 'availability') availability.show(data);
      else employeeRequests.show(data);
    }
    chat.save();

    return reply;
  }

  return {
    statusLookups,
    batchReview,
    availability,
    explanations,
    employeeRequests,
    showAlternatives,
    loadWorkingSummary,
    showSuggestion,
    showCoworkerAvailability,
    showTeamAvailability,
    showManagerLookup,
    showEmployeeLookup,
    showHelp,
    showBlocked,
    showCapabilities,
    renderProviderReply,
  };
}
