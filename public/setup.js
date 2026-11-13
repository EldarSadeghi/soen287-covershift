// Fragments never reach the HTTP server. Remove the bearer token from the
// address bar immediately; keep it only in this page's memory until completion.
let token = new URLSearchParams(location.hash.slice(1)).get('token');
history.replaceState(null, '', '/setup');
const form = document.querySelector('#setup-form');
const error = document.querySelector('#setup-error');
function showError(message) { error.textContent = message; error.hidden = false; error.focus(); }
async function post(path, body) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) { const e = new Error(data.message || 'Please try again.'); e.status = response.status; throw e; }
  return data;
}
async function load() {
  if (!token) { document.querySelector('#setup-context').textContent = 'Open the full setup link from your manager.'; showError('This page needs a valid setup link. Ask your manager for one.'); return; }
  try { const details = await post('/api/worker-setup/details', { token }); document.querySelector('#setup-context').textContent = `${details.name}, join ${details.businessName} using ${details.email}.`; form.hidden = false; }
  catch (e) { document.querySelector('#setup-context').textContent = 'We couldn’t verify your link.'; showError(e.message + (e.status === 400 ? '' : ' Reopen the original setup link to retry.')); }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); error.hidden = true;
  const password = document.querySelector('#password'); const confirmation = document.querySelector('#confirm-password');
  if (password.value !== confirmation.value) { showError('The passwords do not match.'); confirmation.focus(); return; }
  const button = form.querySelector('button[type=submit]'); button.disabled = true;
  try { await post('/api/worker-setup/complete', { token, password: password.value }); token = null; form.reset(); form.hidden = true; document.querySelector('#setup-success').hidden = false; document.querySelector('#setup-success').focus(); }
  catch (e) { showError(e.message); if (e.status === 400) { token = null; form.reset(); form.hidden = true; } }
  finally { button.disabled = false; }
});
document.querySelector('#show-password').addEventListener('click', event => { const password = document.querySelector('#password'); const showing = password.type === 'password'; password.type = showing ? 'text' : 'password'; event.currentTarget.textContent = showing ? 'Hide' : 'Show'; event.currentTarget.setAttribute('aria-pressed', String(showing)); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
load();
