import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { createChatState, openAiReview } from './ai-chat-state.js';

export function mountAiChat(account, csrfToken) {
  let storage;
  try { storage = sessionStorage; } catch { storage = { getItem() {}, setItem() { throw new Error(); }, removeItem() {} }; }
  const chat = createChatState(storage, `${account.business.id}:${account.user.id}`);
  const manager = account.user.role === 'manager';
  const launcher = element('button', 'ai-launcher'); launcher.type = 'button'; launcher.id = 'ai-launcher';
  launcher.innerHTML = '<span class="ai-launcher-icon" aria-hidden="true">✦</span><span>AI assistant</span>';
  launcher.setAttribute('aria-haspopup', 'dialog'); launcher.setAttribute('aria-controls', 'ai-chat'); launcher.setAttribute('aria-expanded', 'false');
  const dialog = document.createElement('dialog'); dialog.className = 'ai-chat'; dialog.id = 'ai-chat'; dialog.setAttribute('aria-labelledby', 'ai-chat-title');
  dialog.innerHTML = '<div class="ai-chat-header"><div><span class="ai-chat-eyebrow">COVERSHIFT</span><h2 id="ai-chat-title">AI assistant <span aria-hidden="true">✦</span></h2></div><button class="ai-chat-close" type="button" aria-label="Close AI assistant">×</button></div><div class="ai-chat-body"><p class="ai-chat-intro" id="ai-chat-intro"></p><div class="ai-chat-messages" role="log" aria-label="AI conversation" aria-live="polite" aria-relevant="additions"></div><div class="ai-chat-suggestion" hidden></div><p class="ai-chat-status" role="status" tabindex="-1"></p></div><form class="ai-chat-composer"><label for="ai-chat-message">Message AI assistant</label><textarea id="ai-chat-message" rows="2" maxlength="1500" placeholder="Describe a shift, or answer my question…" aria-describedby="ai-chat-privacy"></textarea><div class="ai-chat-controls"><button class="ai-chat-new" type="button">New chat</button><button class="ai-chat-send" type="submit">Send message <span aria-hidden="true">↑</span></button></div><p id="ai-chat-privacy">Chat stays in this tab. Messages and active team names are sent to OpenAI. Avoid sensitive information. Review before saving.</p></form>';
  document.body.append(launcher, dialog);
  const find = selector => dialog.querySelector(selector);
  const messages = find('.ai-chat-messages'); const card = find('.ai-chat-suggestion'); const status = find('.ai-chat-status');
  const composer = find('textarea'); const send = find('.ai-chat-send'); const form = find('form');
  const intro = find('#ai-chat-intro');
  intro.textContent = manager ? 'Let’s make the working week easier. Tell me which shift you need, and I’ll prepare it for your review. You can answer my questions here.' : 'Employee availability and automatic claims are coming in the next increments. For now, use My shifts or Open shifts; this assistant cannot assign or claim shifts for you.';
  if (!manager) { chat.reset(); form.hidden = true; }
  let busy = false; let revision = 0; let reviewing = false;
  composer.value = chat.value.composer;
  function say(role, text) {
    const bubble = element('div', `ai-chat-bubble ai-chat-${role}`);
    bubble.append(element('strong', 'ai-chat-speaker', role === 'user' ? 'You' : 'CoverShift'), element('p', '', text));
    messages.append(bubble); return bubble;
  }
  for (const message of chat.value.messages) say(message.role, message.text);
  function notice(text) { status.textContent = text; if (dialog.open) status.scrollIntoView({ block: 'nearest' }); }
  function close() { dialog.close(); }
  dialog.addEventListener('close', () => { launcher.setAttribute('aria-expanded', 'false'); if (!reviewing) launcher.focus(); reviewing = false; });
  find('.ai-chat-close').addEventListener('click', close);
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), textarea:not(:disabled), a[href]')].filter(node => node.getClientRects().length);
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  launcher.addEventListener('click', () => { dialog.showModal(); launcher.setAttribute('aria-expanded', 'true'); if (manager) composer.focus(); else find('.ai-chat-close').focus(); });
  composer.addEventListener('input', () => { chat.value.composer = composer.value; chat.save(); });
  function reviewSuggestion(data) {
    chat.value.pending = { draft: data.draft, timezone: data.timezone, createdAt: Date.now() };
    const persisted = chat.save();
    if (location.pathname === '/workspace/manager/schedule') {
      reviewing = true; close();
      if (openAiReview(data)) { chat.value.pending = null; chat.save(); }
      else { reviewing = false; dialog.showModal(); launcher.setAttribute('aria-expanded', 'true'); notice('The shift form is still loading or unavailable. Refresh workers or finish a pending save, then try Review shift again.'); }
    } else if (persisted) { location.assign('/workspace/manager/schedule'); }
    else { chat.value.pending = null; notice('This browser cannot carry a draft between pages. Open Schedule first, then create the suggestion there.'); }
  }
  function showSuggestion(data) {
    card.replaceChildren(); card.hidden = !data;
    if (!data) return;
    card.append(element('p', 'ai-chat-card-label', 'DRAFT · NOT SAVED'), element('h3', '', data.draft.title));
    const details = document.createElement('dl');
    for (const [label, value] of [['Worker', data.workerName], ['Starts', data.draft.startLocal.replace('T', ' at ')], ['Ends', data.draft.endLocal.replace('T', ' at ')], ['Timezone', data.timezone]]) details.append(element('dt', '', label), element('dd', '', value));
    const review = element('button', 'ai-chat-review', 'Review shift'); review.type = 'button';
    review.addEventListener('click', () => reviewSuggestion(data));
    card.append(details, element('p', '', 'Review and edit the form before creating this shift.'), review);
  }
  showSuggestion(chat.value.suggestion);
  find('.ai-chat-new').addEventListener('click', () => {
    revision++; chat.reset(); document.dispatchEvent(new Event('ai:cancel-review')); messages.replaceChildren(); showSuggestion(null); composer.value = '';
    notice(busy ? 'New chat started. The earlier request may still count toward your allowance; wait for it to finish before sending.' : 'New chat started. What shift would you like to create?'); composer.focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !manager) return;
    const text = composer.value.trim();
    if (!text) { notice('Write a message first.'); composer.focus(); return; }
    const history = chat.value.messages.map(({ role, text }) => ({ role, text }));
    const body = JSON.stringify({ description: text, history });
    if (history.length >= 10 || new TextEncoder().encode(JSON.stringify(history)).length > 4500 || new TextEncoder().encode(body).length > 8000) { notice('This chat has reached its context limit. Start a new chat and include the shift details again.'); return; }
    const version = ++revision; busy = true; send.disabled = true; send.textContent = 'Thinking…';
    chat.value.suggestion = null; chat.value.pending = null; chat.save(); showSuggestion(null);
    const pendingBubble = say('user', text);
    notice('Preparing a reply… You can close this panel and keep working.');
    try {
      const response = await requestJSON('/api/manager/ai-shift-draft', { method: 'POST', readOnly: true, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body });
      if (version !== revision) return;
      if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
      if (!response.ok) { const failure = new Error(); failure.userMessage = response.data.message || 'AI could not prepare a reply.'; throw failure; }
      const data = response.data;
      if (!['draft', 'clarification'].includes(data.kind)) throw new Error('AI could not prepare a reply.');
      const reply = data.kind === 'clarification' ? data.question : `Proposed shift: ${data.draft.title} for ${data.workerName}, ${data.draft.startLocal} to ${data.draft.endLocal}, ${data.timezone}. Nothing has been saved. You can ask me to change it or select Review shift.`;
      chat.value.messages.push({ role: 'user', text }, { role: 'assistant', text: reply }); say('assistant', reply);
      chat.value.suggestion = data.kind === 'draft' ? data : null; showSuggestion(chat.value.suggestion);
      // Preserve anything the user typed while waiting, without sending it yet.
      if (composer.value.trim() === text) composer.value = '';
      chat.value.composer = composer.value; chat.save();
      notice(data.kind === 'draft' ? 'Your shift draft is ready to review. Nothing has been saved.' : 'Reply below to continue. Nothing has been saved.');
      if (dialog.open) composer.focus();
    } catch (error) {
      if (version === revision) {
        pendingBubble.remove();
        chat.value.composer = composer.value; chat.save();
        notice(error.userMessage || 'AI is unavailable or took too long. Your message is preserved. Try sending again later or use the manual Schedule form. An attempt may still count toward your allowance.');
      }
    } finally {
      busy = false; send.disabled = false; send.innerHTML = 'Send message <span aria-hidden="true">↑</span>';
    }
  });
  // Independent Schedule/roster loading signals when a carried draft can be reviewed.
  document.addEventListener('ai:form-ready', () => {
    const pending = chat.value.pending;
    if (manager && pending && location.pathname === '/workspace/manager/schedule') {
      if (Date.now() - pending.createdAt >= 10 * 60 * 1000) { chat.value.pending = null; chat.save(); notice('The carried draft expired. Open the assistant and request a fresh suggestion.'); return; }
      if (openAiReview(pending)) { chat.value.pending = null; chat.save(); }
    }
  });
  return { clear() { revision++; chat.clear(); dialog.remove(); launcher.remove(); } };
}
