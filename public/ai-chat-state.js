// Only tab-session state. Scope to BOTH account and business; never store keys.
export const CHAT_KEY = 'covershift.ai.chat.v1';
const draftKeys = ['title', 'assignedWorkerId', 'startLocal', 'endLocal'];
export const validDraft = draft => draft && typeof draft === 'object' && Object.keys(draft).length === 4 && draftKeys.every(key => typeof draft[key] === 'string') && draft.title.length <= 100 && /^[a-zA-Z0-9_-]{1,80}$/.test(draft.assignedWorkerId) && ['startLocal','endLocal'].every(key => /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft[key]));
export function createChatState(storage, owner, now = Date.now) {
  const empty = () => ({ owner, messages: [], composer: '', suggestion: null, pending: null });
  let state = empty();
  try {
    const saved = JSON.parse(storage.getItem(CHAT_KEY));
    if (saved?.owner === owner && now() - saved.updatedAt < 8 * 60 * 60 * 1000 && now() >= saved.updatedAt && Array.isArray(saved.messages) && saved.messages.length <= 10 && saved.messages.length % 2 === 0 && JSON.stringify(saved.messages).length < 10000 && saved.messages.every((m, i) => m && m.role === (i % 2 ? 'assistant' : 'user') && typeof m.text === 'string' && m.text.length <= 1500)) {
      state.messages = saved.messages;
      if (typeof saved.composer === 'string' && saved.composer.length <= 1500) state.composer = saved.composer;
      if (saved.suggestion && validDraft(saved.suggestion.draft) && typeof saved.suggestion.workerName === 'string' && saved.suggestion.workerName.length <= 100 && typeof saved.suggestion.timezone === 'string' && saved.suggestion.timezone.length <= 100) state.suggestion = saved.suggestion;
      if (saved.pending && validDraft(saved.pending.draft) && typeof saved.pending.timezone === 'string' && now() - saved.pending.createdAt < 10 * 60 * 1000 && now() >= saved.pending.createdAt) state.pending = saved.pending;
    }
  } catch { /* Blocked storage degrades to in-memory chat. */ }
  function save() { try { storage.setItem(CHAT_KEY, JSON.stringify({ ...state, updatedAt: now() })); return true; } catch { return false; } }
  save(); // Overwrite state from another account rather than showing it.
  return {
    get value() { return state; },
    save,
    reset() { state = empty(); save(); },
    clear() { state = empty(); try { storage.removeItem(CHAT_KEY); } catch { /* No persistent state. */ } },
  };
}
let reviewer;
export function registerAiReviewer(handler) { reviewer = handler; }
export function openAiReview(suggestion) { return reviewer ? reviewer(suggestion) : false; }
