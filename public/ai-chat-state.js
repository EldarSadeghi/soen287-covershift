import { formatShiftTime } from './shift-time.js';
// Only tab-session state. Scope to BOTH account and business; never store keys.
export const CHAT_KEY = 'covershift.ai.chat.v1';
const draftKeys = ['title', 'assignedWorkerId', 'startLocal', 'endLocal'];
export const validDraft = draft => draft && typeof draft === 'object' && Object.keys(draft).length === 4 && draftKeys.every(key => typeof draft[key] === 'string') && draft.title.length <= 100 && /^[a-zA-Z0-9_-]{1,80}$/.test(draft.assignedWorkerId) && ['startLocal','endLocal'].every(key => /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft[key]));
// A copied week (CS-068) lists every active employee for its worker choices,
// so a larger team must still be restored after a reload (Codex review on
// #158). The copy lookup refuses teams over this size up front.
export const MAX_COPY_ROSTER = 1000;
// A copied week (CS-068) may carry the original shift's duties.
const validCopy = draft => {
  if (!draft || typeof draft !== 'object') return false;
  const { duties, ...fields } = draft;
  return validDraft(fields) && (duties === undefined || (Array.isArray(duties) && duties.length <= 10 && duties.every(duty => typeof duty === 'string' && duty.length <= 160)));
};
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
function savedReceipt(draftId, result) {
  const shift = result?.shift;
  if (!validId(draftId) || !validId(shift?.id) || !validId(shift?.assignedWorker?.id) || typeof shift.title !== 'string' || !shift.title.trim() || shift.title.length > 100 || typeof shift.assignedWorker.name !== 'string' || !shift.assignedWorker.name.trim() || shift.assignedWorker.name.length > 100 || typeof result.timezone !== 'string' || result.timezone.length > 100) return null;
  if (!['startsAt', 'endsAt'].every(key => typeof shift[key] === 'string' && shift[key].length <= 30 && Number.isFinite(Date.parse(shift[key]))) || Date.parse(shift.endsAt) <= Date.parse(shift.startsAt)) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: result.timezone }).format(new Date(shift.startsAt)); } catch { return null; }
  return { draftId, ...(result.draft===true?{draft:true}:{}), shift: { id: shift.id, title: shift.title, startsAt: shift.startsAt, endsAt: shift.endsAt, assignedWorker: { id: shift.assignedWorker.id, name: shift.assignedWorker.name } }, timezone: result.timezone };
}
export function createdShiftMessage(completion) {
  const time = formatShiftTime(completion.shift, completion.timezone);
  return completion.draft?`Private shift draft saved: “${completion.shift.title}” for ${completion.shift.assignedWorker.name}. Publish the schedule before employees can see it.`:`Shift created: “${completion.shift.title}”, assigned to ${completion.shift.assignedWorker.name}. ${time.date}, ${time.startTime} – ${time.endDate ? time.endDate + ' · ' : ''}${time.endTime} (${completion.timezone}).`;
}
export function createChatState(storage, owner, now = Date.now) {
  const empty = () => ({ owner, messages: [], composer: '', suggestion: null, pending: null, completion: null, uncertainDraftId: null });
  let state = empty();
  try {
    const saved = JSON.parse(storage.getItem(CHAT_KEY));
    if (saved?.owner === owner && now() - saved.updatedAt < 8 * 60 * 60 * 1000 && now() >= saved.updatedAt && Array.isArray(saved.messages) && saved.messages.length <= 10 && saved.messages.length % 2 === 0 && JSON.stringify(saved.messages).length < 10000 && saved.messages.every((m, i) => m && m.role === (i % 2 ? 'assistant' : 'user') && typeof m.text === 'string' && m.text.length <= 1500)) {
      state.messages = saved.messages;
      const batch = saved.batch;
      if (batch && validId(batch.id) && ['review', 'uncertain', 'saved'].includes(batch.status) &&
          typeof batch.timezone === 'string' && batch.timezone.length <= 100 &&
          Array.isArray(batch.shifts) && (batch.copy === true
            ? batch.shifts.length >= 1 && batch.shifts.length <= 40 && batch.shifts.every(validCopy)
            : batch.shifts.length >= 2 && batch.shifts.length <= 5 && batch.shifts.every(validDraft)) &&
          Array.isArray(batch.workers) && batch.workers.length <= (batch.copy === true ? MAX_COPY_ROSTER : 50) && batch.workers.every(worker =>
            validId(worker?.id) && typeof worker.name === 'string' && worker.name.length <= 100)) state.batch = batch;
      if (saved.batchClarifying === true) state.batchClarifying = true;
      if (saved.refinementPending === true) state.refinementPending = true;
      if(saved.mode==='questions')state.mode='questions';
      if (typeof saved.composer === 'string' && saved.composer.length <= 1500) state.composer = saved.composer;
      if (saved.suggestion && validDraft(saved.suggestion.draft) && typeof saved.suggestion.workerName === 'string' && saved.suggestion.workerName.length <= 100 && typeof saved.suggestion.timezone === 'string' && saved.suggestion.timezone.length <= 100) state.suggestion = { ...saved.suggestion, id: validId(saved.suggestion.id) ? saved.suggestion.id : crypto.randomUUID() };
      if (saved.pending && validDraft(saved.pending.draft) && typeof saved.pending.timezone === 'string' && now() - saved.pending.createdAt < 10 * 60 * 1000 && now() >= saved.pending.createdAt) state.pending = { ...saved.pending, id: validId(saved.pending.id) ? saved.pending.id : state.suggestion && draftKeys.every(key => state.suggestion.draft[key] === saved.pending.draft[key]) && state.suggestion.timezone === saved.pending.timezone ? state.suggestion.id : null };
      if (state.suggestion && saved.completion?.draftId === state.suggestion.id) state.completion = savedReceipt(saved.completion.draftId, saved.completion);
      if (!state.completion && state.suggestion && saved.uncertainDraftId === state.suggestion.id) state.uncertainDraftId = saved.uncertainDraftId;
    }
  } catch { /* Blocked storage degrades to in-memory chat. */ }
  function save() { try { storage.setItem(CHAT_KEY, JSON.stringify({ ...state, updatedAt: now() })); return true; } catch { return false; } }
  save(); // Overwrite state from another account rather than showing it.
  return {
    get value() { return state; },
    save,
    markCreated(draftId, result) {
      // Only the form's captured handoff ID can finish the current suggestion.
      // A newer chat, unrelated manual save or repeated response is ignored.
      if (!validId(draftId) || !state.suggestion || draftId !== state.suggestion.id || state.completion) return false;
      const receipt = savedReceipt(draftId, result);
      if (!receipt) return false;
      state.completion = receipt; state.pending = null; state.uncertainDraftId = null;
      if (state.messages.at(-1)?.role === 'assistant') state.messages[state.messages.length - 1] = { role: 'assistant', text: createdShiftMessage(receipt) };
      save(); return true;
    },
    markUncertain(draftId) {
      if (!validId(draftId) || !state.suggestion || draftId !== state.suggestion.id || state.completion || state.uncertainDraftId === draftId) return false;
      state.uncertainDraftId = draftId; state.pending = null;
      if (state.messages.at(-1)?.role === 'assistant') state.messages[state.messages.length - 1] = { role: 'assistant', text: 'Save not confirmed. The reviewed shift may have been saved. Check the saved schedule and reconcile the form before trying again.' };
      save(); return true;
    },
    reset() { state = empty(); save(); },
    clear() { state = empty(); try { storage.removeItem(CHAT_KEY); } catch { /* No persistent state. */ } },
  };
}
let reviewer;
export function registerAiReviewer(handler) { reviewer = handler; }
export function openAiReview(suggestion) { return reviewer ? reviewer(suggestion) : false; }
