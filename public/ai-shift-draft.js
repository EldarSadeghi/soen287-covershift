import { requestJSON } from './request.js';
import { element } from './shift-card.js';

// A suggestion is kept separate from the editable form. Only Apply replaces
// fields, so a late model response cannot erase manual edits.
export function mountAiShiftDraft(form, csrfToken, applyDraft) {
  const panel = document.createElement('details'); panel.className = 'ai-shift-helper'; panel.hidden = true;
  panel.innerHTML = '<summary>Draft a shift with AI</summary><p class="section-note">Describe one shift, including its title, worker, date and hours. AI can make mistakes: review every field before saving. “Next Thursday” means the next Thursday after today; “next week” means Monday–Sunday.</p><p class="section-note">Your description, business timezone and active team names are sent to OpenAI. Leave out private or sensitive information.</p><label for="ai-shift-description">Describe the shift</label><textarea id="ai-shift-description" rows="4" maxlength="1500" aria-describedby="ai-shift-help" placeholder="Opening service for Jamie Lee on December 3, 2026, from 9 AM to 3 PM."></textarea><p id="ai-shift-help" class="section-note">For clarification, edit this description to include your answer, then generate again. Each generation uses your AI allowance.</p><div class="ai-shift-actions"><button type="button" class="logout-button" id="ai-generate">Generate draft</button><button type="button" class="logout-button" id="ai-cancel" hidden>Cancel suggestion</button></div><p id="ai-shift-status" class="section-note" role="status" tabindex="-1"></p><div id="ai-shift-result" hidden></div>';
  form.before(panel);
  const find = id => panel.querySelector(`#${id}`);
  const description = find('ai-shift-description'); const generate = find('ai-generate'); const cancel = find('ai-cancel');
  const status = find('ai-shift-status'); const result = find('ai-shift-result');
  let revision = 0; let busy = false;
  const invalidate = () => {
    revision++; result.replaceChildren(); result.hidden = true; cancel.hidden = true;
    status.textContent = busy ? 'Suggestion cancelled. The request may still count toward your allowance. You can continue manually.' : '';
  };
  description.addEventListener('input', invalidate);
  cancel.addEventListener('click', () => { invalidate(); description.focus(); });
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); invalidate(); panel.open = false; panel.querySelector('summary').focus(); } });
  generate.addEventListener('click', async () => {
    if (busy) return;
    const text = description.value.trim();
    if (!text) { status.textContent = 'Describe one shift first.'; description.setAttribute('aria-invalid', 'true'); description.focus(); return; }
    description.removeAttribute('aria-invalid'); invalidate();
    const version = revision; busy = true; generate.disabled = true; cancel.hidden = false;
    status.textContent = 'Preparing your suggestion… You can still use the manual form.';
    try {
      const response = await requestJSON('/api/manager/ai-shift-draft', { method: 'POST', readOnly: true, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ description: text }) });
      if (version !== revision || !panel.isConnected) return;
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) { status.textContent = response.data.message || 'AI could not prepare a draft. Use the manual form.'; status.focus(); return; }
      const data = response.data;
      if (data.kind === 'clarification') { status.textContent = data.question; status.focus(); return; }
      if (data.kind !== 'draft' || !data.draft) throw new Error();
      status.textContent = 'Suggestion ready. Nothing has been saved.';
      result.append(element('h3', '', 'Review AI suggestion'));
      const list = document.createElement('dl');
      for (const [label, value] of [['Title', data.draft.title], ['Worker', data.workerName], ['Starts', data.draft.startLocal.replace('T', ' at ')], ['Ends', data.draft.endLocal.replace('T', ' at ')], ['Timezone', data.timezone]]) {
        list.append(element('dt', '', label), element('dd', '', value));
      }
      result.append(list, element('p', 'section-note', 'Applying replaces the four fields in the form below. Review them, then create the shift yourself.'));
      const apply = element('button', 'solid-link', 'Apply suggestion to form'); apply.type = 'button';
      apply.addEventListener('click', () => {
        if (version !== revision) return;
        if (applyDraft(data.draft)) { invalidate(); status.textContent = 'Draft applied to the form below. Nothing has been saved yet.'; }
        else { invalidate(); status.textContent = 'The form is unavailable or the roster changed. Finish any pending save or refresh workers before requesting a new draft.'; status.focus(); }
      });
      result.append(apply); result.hidden = false; status.focus();
    } catch {
      if (version === revision && panel.isConnected) {
        status.textContent = 'AI drafting is unavailable or took too long. Nothing was saved. Your description is preserved; try again later or use the manual form. A request may still count toward your allowance.'; status.focus();
      }
    } finally {
      busy = false; generate.disabled = false;
      if (version === revision) cancel.hidden = result.hidden;
    }
  });
  return { invalidate, setAvailable(available) { panel.hidden = !available; } };
}
