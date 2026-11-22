// Cache conversation and search criteria, never a reusable claim authorization.
export const EMPLOYEE_CHAT_KEY = 'covershift.ai.employee.v1';
export function createEmployeeChatState(storage, owner, now = Date.now) {
  const empty = () => ({ owner, messages: [], composer: '', criteria: null, outcome: null });
  let state = empty();
  try {
    const saved = JSON.parse(storage.getItem(EMPLOYEE_CHAT_KEY));
    if (saved?.owner === owner && now() >= saved.updatedAt && now() - saved.updatedAt < 8 * 3600000 && Array.isArray(saved.messages) && saved.messages.length <= 10 && saved.messages.length % 2 === 0 && JSON.stringify(saved.messages).length < 10000 && saved.messages.every((m, i) => m && m.role === (i % 2 ? 'assistant' : 'user') && typeof m.text === 'string' && m.text.length <= 1500)) {
      state.messages = saved.messages;
      if (typeof saved.composer === 'string' && saved.composer.length <= 1500) state.composer = saved.composer;
      if (saved.criteria && Object.keys(saved.criteria).length === 4 && ['date', 'startLocal', 'endLocal', 'title'].every(k => typeof saved.criteria[k] === 'string' && saved.criteria[k].length <= 100)) state.criteria = saved.criteria;
      if (saved.outcome && ['pending', 'uncertain'].includes(saved.outcome.kind) && typeof saved.outcome.title === 'string' && saved.outcome.title.length <= 100) state.outcome = { kind: saved.outcome.kind, title: saved.outcome.title };
    }
  } catch { /* In-memory fallback. */ }
  function save() { try { storage.setItem(EMPLOYEE_CHAT_KEY, JSON.stringify({ ...state, updatedAt: now() })); return true; } catch { return false; } }
  save();
  return { get value() { return state; }, save, reset() { state = empty(); save(); }, clear() { state = empty(); try { storage.removeItem(EMPLOYEE_CHAT_KEY); } catch { /* No persistent state. */ } } };
}
