import { apiUrl } from './api.js';

const registrationForms = document.querySelectorAll('[data-registration-form]');

registrationForms.forEach((form) => {
  const statusMessage = form.querySelector('[data-status]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const studentType = formData.get('studentType');
    const studentDocuments = form.querySelector('[name="studentDocuments"]');
    if (studentType === 'new' && studentDocuments.files.length !== 4) {
      statusMessage.textContent = 'Select all four required documents together.';
      statusMessage.classList.remove('success');
      statusMessage.classList.add('error');
      return;
    }

    statusMessage.textContent = 'Submitting...';
    statusMessage.classList.remove('success', 'error');

    try {
      const response = await fetch(apiUrl('/api/register'), {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Registration failed.');
      }

      statusMessage.textContent = result.message;
      statusMessage.classList.add('success');
      form.reset();
    } catch (error) {
      statusMessage.textContent = error.message;
      statusMessage.classList.add('error');
    }
  });
});
