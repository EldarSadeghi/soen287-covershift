import { clarificationSuggestions } from './ai-chat-routing.js';
import { responseDetails, revealResponse } from './ai-response-card.js';
import { requestJSON } from './request.js';
import { element } from './shift-card.js';

export function createChatView(manager, chat, flow) {
  const launcher = element('button', 'ai-launcher');
  launcher.type = 'button';
  launcher.id = 'ai-launcher';
  launcher.innerHTML =
    '<span class="ai-launcher-icon" aria-hidden="true">✦</span><span>AI assistant</span>';
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', 'ai-chat');
  launcher.setAttribute('aria-expanded', 'false');
  const dialog = document.createElement('dialog');
  dialog.className = 'ai-chat';
  dialog.id = 'ai-chat';
  dialog.setAttribute('aria-labelledby', 'ai-chat-title');
  dialog.innerHTML =
    '<div class="ai-chat-header"><div><span class="ai-chat-eyebrow">COVERSHIFT</span><h2 id="ai-chat-title">AI assistant <span aria-hidden="true">✦</span></h2></div><button class="ai-chat-close" type="button" aria-label="Close AI assistant">×</button></div><div class="ai-chat-body"><p class="ai-chat-intro" id="ai-chat-intro"></p><div class="ai-chat-messages" role="log" aria-label="AI conversation" aria-live="polite" aria-relevant="additions"></div><div class="ai-chat-suggestion" hidden></div><p class="ai-chat-status" role="status" tabindex="-1"></p></div><form class="ai-chat-composer"><label for="ai-chat-message">Message AI assistant</label><textarea id="ai-chat-message" rows="1" maxlength="1500" placeholder="Describe a shift, or answer my question…" aria-describedby="ai-chat-privacy"></textarea><div class="ai-chat-controls"><button class="ai-chat-new" type="button">New chat</button><button class="ai-chat-send" type="submit">Send message <span aria-hidden="true">↑</span></button></div><details class="ai-chat-privacy"><summary>Privacy and AI usage</summary><p id="ai-chat-privacy">Chat stays in this tab. Messages and active team names are sent to OpenAI. Avoid sensitive information. Review before saving.</p></details></form>';
  document.body.append(launcher, dialog);
  const find = (selector) => dialog.querySelector(selector);
  const messages = find('.ai-chat-messages');
  const card = find('.ai-chat-suggestion');
  const status = find('.ai-chat-status');
  const composer = find('textarea');
  const send = find('.ai-chat-send');
  const form = find('form');
  const intro = find('#ai-chat-intro');
  intro.textContent = manager
    ? 'Create a shift or ask about your team’s schedule.'
    : 'Ask about your work, find an opening, or save availability.';
  if (!manager) {
    composer.placeholder = 'Find an open shift next Thursday…';
    find('#ai-chat-privacy').textContent =
      'Chat stays in this tab. Messages are sent to OpenAI; saved shift records stay on this server. Avoid sensitive information. Confirm before requesting.';
  }
  const samples = element('div', 'ai-chat-samples');
  samples.setAttribute('aria-label', 'Suggested messages');
  intro.after(samples);
  function working(value) {
    flow.busy = value;
    send.disabled = value;
    find('.ai-chat-controls .ai-chat-new').disabled = value;
  }
  function outcomeText(text) {
    const last = chat.value.messages.at(-1);
    if (last?.role === 'assistant') {
      last.text = text;
      const bubble = messages.lastElementChild;
      if (bubble?.classList.contains('ai-chat-assistant'))
        bubble.lastElementChild.replaceWith(assistantReply(text));
    }
    chat.save();
  }
  composer.value = chat.value.composer;
  composer.placeholder = 'Ask or describe what you need…';
  const prompts = manager
    ? [
        ['Create a shift', 'Help me create a shift.'],
        ['Draft multiple shifts', 'Draft two shifts: '],
        ['Team schedule', 'Show the entire team’s schedule this week.'],
        ['Attention summary', 'Show the attention summary for this week.'],
      ]
    : [
        ['My next shift', 'When is my next shift?'],
        ['My working week', 'Show my working week.'],
        ['Find openings', 'Find an open shift Thursday.'],
        [
          'Save availability',
          'I can take one shift Thursday between 2 PM and 6 PM.',
        ],
      ];
  for (const [label, text] of prompts) {
    const button = element('button', '', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (flow.busy) return;
      composer.value = text;
      chat.value.composer = text;
      chat.save();
      composer.focus();
    });
    samples.append(button);
  }
  // Footer line: AI turns left today, from the server's daily allowance.
  const usageLine = element('p', 'ai-chat-usage');
  usageLine.setAttribute('aria-live', 'polite');
  usageLine.hidden = true;
  find('.ai-chat-controls').after(usageLine); // visible, not inside the collapsed privacy details
  let usageRead = 0;
  async function refreshUsage() {
    const read = ++usageRead;
    try {
      const result = await requestJSON('/api/ai-usage');
      if (read !== usageRead) return;
      const left = result.data?.remainingToday;
      if (!result.ok || !Number.isInteger(left)) {
        usageLine.hidden = true;
        return;
      }
      if (result.data.exhausted === 'lifetime') {
        usageLine.textContent =
          'This project’s AI request allowance is used up. You can still use the workspace directly.';
      } else if (left === 0) {
        usageLine.textContent =
          'No AI requests left today. They reset at midnight in your business timezone.';
      } else {
        usageLine.textContent = `${left} AI request${left === 1 ? '' : 's'} left today.`;
      }
      usageLine.classList.toggle('ai-chat-usage-low', left <= 3);
      usageLine.hidden = false;
    } catch {
      if (read === usageRead) usageLine.hidden = true; // Usage is informational.
    }
  }

  // Buttons under the generic question; each sends a locally routed message.
  function showQuickReplies() {
    const group = element('div', 'ai-chat-quick');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Choose what to check');
    for (const [label, example] of clarificationSuggestions(manager)) {
      const button = element('button', '', label);
      button.type = 'button';
      button.addEventListener('click', () => {
        if (flow.busy) return;
        composer.value = example;
        form.requestSubmit();
      });
      group.append(button);
    }
    messages.lastElementChild?.append(group);
  }
  function assistantReply(text) {
    return text.length > 180
      ? responseDetails('View earlier reply', text)
      : element('p', '', text);
  }
  function say(role, text) {
    const bubble = element('div', `ai-chat-bubble ai-chat-${role}`);
    bubble.append(
      element(
        'strong',
        'ai-chat-speaker',
        role === 'user' ? 'You' : 'CoverShift',
      ),
    );
    bubble.append(
      role === 'assistant' ? assistantReply(text) : element('p', '', text),
    );
    messages.append(bubble);
    samples.hidden = true;
    return bubble;
  }
  for (const message of chat.value.messages) say(message.role, message.text);
  function notice(text, announceOnly = false) {
    status.textContent = text;
    status.classList.toggle('ai-response-announcement', announceOnly);
    if (
      dialog.open &&
      (!dialog.contains(document.activeElement) ||
        document.activeElement === dialog)
    )
      composer.focus({ preventScroll: true });
  }
  function close() {
    dialog.close();
  }
  dialog.addEventListener('close', () => {
    launcher.setAttribute('aria-expanded', 'false');
    if (!flow.reviewing) launcher.focus();
    flow.reviewing = false;
  });
  find('.ai-chat-close').addEventListener('click', close);
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [
      ...dialog.querySelectorAll(
        'button:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href]',
      ),
    ].filter((node) => node.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      close();
  });
  launcher.addEventListener('click', () => {
    void refreshUsage();
    dialog.showModal();
    launcher.setAttribute('aria-expanded', 'true');
    composer.focus({ preventScroll: true });
    if (!card.hidden) revealResponse(card);
  });
  composer.addEventListener('input', () => {
    chat.value.composer = composer.value;
    chat.save();
  });
  composer.addEventListener('keydown', (event) => {
    if (
      event.key !== 'Enter' ||
      event.defaultPrevented ||
      event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.isComposing ||
      event.keyCode === 229
    )
      return;
    event.preventDefault();
    if (!event.repeat && !flow.busy && !send.disabled) form.requestSubmit(send);
  });
  function syncResponse() {
    const bubbles = [...messages.children];
    for (const bubble of bubbles) bubble.hidden = false;
    const last = bubbles.at(-1);
    if (!card.hidden && last?.classList.contains('ai-chat-assistant'))
      last.hidden = true;
  }
  const observer = new MutationObserver(() => {
    syncResponse();
    if (dialog.open && !card.hidden)
      requestAnimationFrame(() => revealResponse(card));
  });
  observer.observe(card, {
    childList: true,
    attributes: true,
    attributeFilter: ['hidden'],
  });

  return {
    launcher,
    dialog,
    find,
    messages,
    card,
    status,
    composer,
    send,
    form,
    samples,
    working,
    outcomeText,
    notice,
    close,
    say,
    showQuickReplies,
    refreshUsage,
    syncResponse,
    observer,
  };
}
