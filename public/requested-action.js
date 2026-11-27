// A chat link (CS-067) such as ?invitation=ID&action=accept opens that item's
// existing confirmation once, after the page has loaded. The employee still
// confirms it here; the link itself never saves anything. The action is
// removed from the address so a refresh doesn't open it again.
const DONE = { accept: 'accepted', decline: 'declined', cancel: 'cancelled' };

export function openRequestedAction(main, key, prefix, allowed, feedback) {
  const params = new URLSearchParams(location.search);
  const id = params.get(key);
  const action = params.get('action');
  if (!id || !action) return;
  params.delete('action');
  history.replaceState(
    history.state,
    '',
    location.pathname + (params.size ? '?' + params : '') + location.hash,
  );
  if (!Object.hasOwn(DONE, action) || !allowed.includes(action)) return;
  const item = main.querySelector('#' + CSS.escape(prefix + id));
  const button = [...(item?.querySelectorAll('button') || [])].find(
    (candidate) =>
      (candidate.dataset.coverAction ||
        candidate.dataset.timeoffAction ||
        candidate.dataset.coverageAction) === action &&
      !candidate.disabled &&
      !candidate.hidden,
  );
  if (button) {
    button.click();
    return;
  }
  if (!feedback) return;
  feedback.textContent = `This item can no longer be ${DONE[action]}. Its current status is shown on this page.`;
  feedback.hidden = false;
  feedback.focus();
}
