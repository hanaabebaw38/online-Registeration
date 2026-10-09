const loginForm = document.querySelector('#admin-login-form');
const tokenInput = document.querySelector('#admin-token');
const tokenHint = document.querySelector('#admin-token-hint');
const statusMessage = document.querySelector('#admin-status');
const resultsPanel = document.querySelector('#admin-results');
const registrationRows = document.querySelector('#registration-rows');
const registrationCount = document.querySelector('#registration-count');
const recordsStatus = document.querySelector('#records-status');
const logoutButton = document.querySelector('#admin-logout');
const editDialog = document.querySelector('#edit-dialog');
const editForm = document.querySelector('#edit-registration-form');
const editStatus = document.querySelector('#edit-status');
const cancelEditButton = document.querySelector('#cancel-edit');
let adminToken = '';
let currentRegistrations = [];
const isLocalAdminPage = ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (!isLocalAdminPage) {
  tokenInput.removeAttribute('inputmode');
  tokenInput.removeAttribute('minlength');
  tokenInput.removeAttribute('maxlength');
  tokenInput.removeAttribute('pattern');
  tokenInput.removeAttribute('title');
  tokenHint.textContent = 'Enter your configured admin token.';
}

tokenInput.addEventListener('input', () => {
  if (isLocalAdminPage) {
    tokenInput.value = tokenInput.value.replace(/[^0-9]/g, '').slice(0, 4);
  }
});

function setStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.classList.remove('success', 'error');
  if (type) statusMessage.classList.add(type);
}

function renderRegistrations(registrations) {
  currentRegistrations = registrations;
  registrationRows.replaceChildren();

  for (const registration of registrations) {
    const row = document.createElement('tr');
    const values = [
      registration.studentType === 'new' ? 'New student' : 'Senior student',
      registration.studentId,
      registration.name,
      registration.email,
      registration.phone,
      registration.program,
      registration.academicYear,
      registration.semester,
      registration.createdAt
    ];

    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value || '-';
      row.append(cell);
    }

    const documentsCell = document.createElement('td');
    if (registration.documents?.length) {
      for (const registrationDocument of registration.documents) {
        const documentEntry = document.createElement('div');
        documentEntry.className = 'document-entry';
        const documentName = document.createElement('span');
        documentName.className = 'document-name';
        documentName.textContent = registrationDocument.fileName;
        const viewButton = document.createElement('button');
        viewButton.className = 'record-action record-view';
        viewButton.type = 'button';
        viewButton.dataset.viewDocumentId = registrationDocument.id;
        viewButton.dataset.documentName = registrationDocument.fileName;
        viewButton.dataset.registrationId = registration.id;
        viewButton.textContent = 'View';
        viewButton.setAttribute('aria-label', `View ${registrationDocument.fileName} for ${registration.name}`);
        const downloadButton = document.createElement('button');
        downloadButton.className = 'record-action record-download';
        downloadButton.type = 'button';
        downloadButton.dataset.documentId = registrationDocument.id;
        downloadButton.dataset.documentName = registrationDocument.fileName;
        downloadButton.dataset.registrationId = registration.id;
        downloadButton.textContent = 'Download';
        downloadButton.setAttribute('aria-label', `Download ${registrationDocument.fileName} for ${registration.name}`);
        documentEntry.append(documentName, viewButton, downloadButton);
        documentsCell.append(documentEntry);
      }
    } else {
      documentsCell.textContent = registration.studentType === 'new' ? 'Missing' : 'Not required';
    }
    row.append(documentsCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'record-actions';
    const editButton = document.createElement('button');
    editButton.className = 'record-action record-edit';
    editButton.type = 'button';
    editButton.dataset.editId = registration.id;
    editButton.textContent = 'Edit';
    editButton.setAttribute('aria-label', `Edit registration for ${registration.name}`);
    const deleteButton = document.createElement('button');
    deleteButton.className = 'record-action record-delete';
    deleteButton.type = 'button';
    deleteButton.dataset.deleteId = registration.id;
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete registration for ${registration.name}`);
    actionsCell.append(editButton, deleteButton);
    row.append(actionsCell);
    registrationRows.append(row);
  }

  registrationCount.textContent = `${registrations.length} registration${registrations.length === 1 ? '' : 's'}`;
}

async function loadRegistrations(token = adminToken) {
  const response = await fetch('http://localhost:5000/api/admin/registrations', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Could not load registration records.');
  }

  renderRegistrations(result.data);
  return result.data;
}

async function sendAdminRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...options.headers
    }
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Admin request failed.');
  }

  return result;
}

async function downloadRegistrationDocument(registrationId, documentId, documentName) {
  const response = await fetch(`http://localhost:5000/api/admin/registrations/${registrationId}/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.message || `Could not download ${documentName}.`);
  }

  const documentFile = await response.blob();
  const extension = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png'
  }[documentFile.type] || '';
  const downloadLink = document.createElement('a');
  const objectUrl = URL.createObjectURL(documentFile);
  downloadLink.href = objectUrl;
  downloadLink.download = documentName || `student-document-${registrationId}${extension}`;
  downloadLink.click();
  URL.revokeObjectURL(objectUrl);
}

async function viewRegistrationDocument(registrationId, documentId, documentName) {
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) throw new Error('Allow pop-ups to view this document.');
  previewWindow.opener = null;

  try {
    const response = await fetch(`http://localhost:5000/api/admin/registrations/${registrationId}/documents/${documentId}?view=1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.message || `Could not view ${documentName}.`);
    }

    const objectUrl = URL.createObjectURL(await response.blob());
    previewWindow.document.title = documentName;
    previewWindow.location.replace(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}

function setRecordsStatus(message, type = '') {
  recordsStatus.textContent = message;
  recordsStatus.classList.remove('success', 'error');
  if (type) recordsStatus.classList.add(type);
}

function setEditStatus(message, type = '') {
  editStatus.textContent = message;
  editStatus.classList.remove('success', 'error');
  if (type) editStatus.classList.add(type);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Checking admin access...');

  try {
    const enteredToken = tokenInput.value;
    const registrations = await loadRegistrations(enteredToken);
    adminToken = enteredToken;
    tokenInput.value = '';
    loginForm.hidden = true;
    resultsPanel.hidden = false;
    setStatus(`${registrations.length} records loaded.`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

registrationRows.addEventListener('click', async (event) => {
  const viewButton = event.target.closest('[data-view-document-id]');
  if (viewButton) {
    setRecordsStatus(`Opening ${viewButton.dataset.documentName}...`);
    try {
      await viewRegistrationDocument(
        viewButton.dataset.registrationId,
        viewButton.dataset.viewDocumentId,
        viewButton.dataset.documentName
      );
      setRecordsStatus(`${viewButton.dataset.documentName} opened.`, 'success');
    } catch (error) {
      setRecordsStatus(error.message, 'error');
    }
    return;
  }

  const documentButton = event.target.closest('[data-document-id]');
  if (documentButton) {
    setRecordsStatus(`Downloading ${documentButton.dataset.documentName}...`);
    try {
      await downloadRegistrationDocument(
        documentButton.dataset.registrationId,
        documentButton.dataset.documentId,
        documentButton.dataset.documentName
      );
      setRecordsStatus(`${documentButton.dataset.documentName} download started.`, 'success');
    } catch (error) {
      setRecordsStatus(error.message, 'error');
    }
    return;
  }

  const editButton = event.target.closest('[data-edit-id]');
  if (editButton) {
    const registration = currentRegistrations.find((item) => item.id === Number(editButton.dataset.editId));
    if (!registration) return;

    for (const field of ['id', 'studentType', 'studentId', 'name', 'email', 'phone', 'program', 'academicYear', 'semester']) {
      editForm.elements[field].value = registration[field] ?? '';
    }
    setEditStatus('');
    editDialog.showModal();
    return;
  }

  const deleteButton = event.target.closest('[data-delete-id]');
  if (!deleteButton) return;

  const registration = currentRegistrations.find((item) => item.id === Number(deleteButton.dataset.deleteId));
  if (!registration || !window.confirm(`Delete the registration for ${registration.name}? This cannot be undone.`)) return;

  setRecordsStatus('Deleting registration...');
  try {
    const result = await sendAdminRequest(`http://localhost:5000/api/admin/registrations/${registration.id}`, {
      method: 'DELETE'
    });
    await loadRegistrations();
    setRecordsStatus(result.message, 'success');
  } catch (error) {
    setRecordsStatus(error.message, 'error');
  }
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(editForm).entries());
  const registrationId = formData.id;
  delete formData.id;
  setEditStatus('Saving changes...');

  try {
    const result = await sendAdminRequest(`http://localhost:5000/api/admin/registrations/${registrationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    await loadRegistrations();
    editDialog.close();
    setRecordsStatus(result.message, 'success');
  } catch (error) {
    setEditStatus(error.message, 'error');
  }
});

cancelEditButton.addEventListener('click', () => editDialog.close());
editDialog.addEventListener('close', () => editForm.reset());

logoutButton.addEventListener('click', () => {
  adminToken = '';
  currentRegistrations = [];
  registrationRows.replaceChildren();
  registrationCount.textContent = '';
  setRecordsStatus('');
  if (editDialog.open) editDialog.close();
  resultsPanel.hidden = true;
  loginForm.hidden = false;
  loginForm.reset();
  setStatus('');
});
