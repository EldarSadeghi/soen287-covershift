const form = document.querySelector('#signup-form');
const summary = document.querySelector('#form-errors');
const submit = document.querySelector('#signup-submit');
const password = document.querySelector('#password');
const fields = ['name', 'email', 'password', 'businessName', 'timezone'];
function clearErrors() {
  summary.hidden = true;
  for (const name of fields) {
    document.getElementById(name).removeAttribute('aria-invalid');
    document.getElementById(`${name}-error`).hidden = true;
  }
}
function showErrors(message, errors = {}) {
  summary.textContent = message;
  summary.hidden = false;
  for (const [name, message] of Object.entries(errors)) {
    if (!fields.includes(name)) continue;
    document.getElementById(name).setAttribute('aria-invalid', 'true');
    const target = document.getElementById(`${name}-error`);
    target.textContent = message;
    target.hidden = false;
  }
  summary.focus();
}
document.querySelector('#show-password').addEventListener('click', event => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? 'Hide' : 'Show';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  clearErrors();
  const errors = {};
  for (const name of fields) {
    const input = document.getElementById(name);
    if (!input.validity.valid) errors[name] = name === 'password' ? 'Use a password or passphrase of 15–128 characters.' : input.validationMessage;
  }
  if (password.value.length < 15 || password.value.length > 128) errors.password = 'Use a password or passphrase of 15–128 characters.';
  if (Object.keys(errors).length) { showErrors('Please check the highlighted fields.', errors); return; }
  submit.disabled = true;
  submit.textContent = 'Creating your account…';
  form.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json();
    if (!response.ok) { showErrors(result.message || 'Account creation failed. Please try again.', result.fields); return; }
    form.reset();
    password.type = 'password';
    form.hidden = true;
    document.querySelector('#signup-intro').hidden = true;
    document.querySelector('.signup-notice').hidden = true;
    document.querySelector('#success-message').textContent = `${result.manager.name}, your business “${result.business.name}” is ready.`;
    const success = document.querySelector('#signup-success');
    success.hidden = false;
    document.title = 'Account created · CoverShift';
    success.focus();
  } catch {
    showErrors('We couldn’t reach the server. Check your connection and try again.');
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Create account <span aria-hidden="true">↗</span>';
    form.removeAttribute('aria-busy');
  }
});
