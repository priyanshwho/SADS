const form = document.querySelector('#signup-form');
const email = document.querySelector('#email');
const consent = document.querySelector('#consent');
const status = document.querySelector('#status');
const button = form.querySelector('button');
function errorFor(input, message) {
  document.querySelector(`#${input.id}-error`).textContent = message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  status.textContent = '';
  status.classList.remove('failure');
  const address = email.value.trim();
  const emailError = !address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254 ? 'Enter a valid email address.' : '';
  const consentError = consent.checked ? '' : 'Please agree before signing up.';
  errorFor(email, emailError);
  errorFor(consent, consentError);
  if (emailError || consentError) { (emailError ? email : consent).focus(); return; }
  button.disabled = true;
  button.textContent = 'Saving…';
  status.textContent = 'Saving your subscription…';
  try {
    const response = await fetch('./api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address, consent: true, interests: [...form.querySelectorAll('input[name=interests]:checked')].map(input => input.value) }) });
    const result = await response.json();
    if (!response.ok) {
      if (result.field === 'email' || result.field === 'consent') errorFor(result.field === 'email' ? email : consent, result.error);
      throw new Error(result.error || 'We could not save your subscription. Please try again.');
    }
    status.textContent = `${result.message} No emails are sent by this demo.`;
    form.reset();
  } catch (error) {
    status.classList.add('failure');
    status.textContent = error.message === 'Failed to fetch' ? 'Could not connect. Please check your connection and try again.' : error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Save my subscription ↗';
  }
});
