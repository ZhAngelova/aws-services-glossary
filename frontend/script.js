// AWS Services Glossary - frontend logic

// Config
const API_BASE = 'https://b16zplto5k.execute-api.eu-west-2.amazonaws.com/Prod';

// State
let allTerms = [];
let currentCategoryFilter = '';
let currentSearchQuery = '';
let editingTermName = null;

// DOM elements (resolved on DOMContentLoaded)
let toggleFormBtn, termForm, formTitle, submitBtn, cancelBtn, formMessage;
let searchInput, categoryFiltersContainer;
let resultsSummary, termsList;
let serviceNameInput, displayNameInput, descriptionInput, categoryInput, useCasesInput;


// API calls

async function fetchTerms() {
    const res = await fetch(`${API_BASE}/services`, { method: 'GET' });
    if (!res.ok) throw new Error(`Failed to fetch terms (HTTP ${res.status})`);
    const data = await res.json();
    return data.terms || [];
}

async function createTerm(payload) {
    const res = await fetch(`${API_BASE}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to create (HTTP ${res.status})`);
    return data;
}

async function updateTermRequest(name, payload) {
    const res = await fetch(`${API_BASE}/services/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to update (HTTP ${res.status})`);
    return data;
}

async function deleteTermRequest(name) {
    const res = await fetch(`${API_BASE}/services/${encodeURIComponent(name)}`, {
        method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to delete (HTTP ${res.status})`);
    return data;
}


// Rendering

function renderTerms() {
    const query = currentSearchQuery.trim().toLowerCase();
    const filtered = allTerms.filter(term => {
        if (currentCategoryFilter && term.category !== currentCategoryFilter) return false;
        if (query) {
            const haystack = `${term.serviceName} ${term.displayName} ${term.description}`.toLowerCase();
            if (!haystack.includes(query)) return false;
        }
        return true;
    });

    if (allTerms.length === 0) {
        resultsSummary.textContent = 'The glossary is empty. Add the first term using the button above.';
    } else if (filtered.length === 0) {
        resultsSummary.textContent = 'No terms match the current filter.';
    } else if (filtered.length === allTerms.length) {
        resultsSummary.textContent = `${filtered.length} term${filtered.length === 1 ? '' : 's'}`;
    } else {
        resultsSummary.textContent = `${filtered.length} of ${allTerms.length} terms`;
    }

    if (filtered.length === 0) {
        termsList.innerHTML = `<div class="empty-state">${allTerms.length === 0 ? 'Nothing here yet.' : 'No terms match your search or category filter.'}</div>`;
        return;
    }

    termsList.innerHTML = filtered.map(renderTermCard).join('');

    termsList.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => onEditClick(btn.dataset.name));
    });
    termsList.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', () => onDeleteClick(btn.dataset.name));
    });
}

function renderTermCard(term) {
    const useCases = Array.isArray(term.useCases) ? term.useCases : [];
    const useCasesHtml = useCases.length
        ? `<div class="term-use-cases">${useCases.map(uc => `<span class="term-use-case">${escapeHtml(uc)}</span>`).join('')}</div>`
        : '';

    const category = term.category
        ? `<span class="term-category">${escapeHtml(term.category)}</span>`
        : '';

    const updated = term.updatedAt ? new Date(term.updatedAt).toLocaleDateString() : '';
    const by = term.addedBy ? `by ${escapeHtml(term.addedBy)}` : '';
    const meta = (updated || by) ? `<p class="term-meta">Last updated ${updated} ${by}</p>` : '';

    return `
        <article class="term-card">
            <div class="term-card-header">
                <h3 class="term-card-title">${escapeHtml(term.displayName)} <small style="color:#687078;font-weight:normal;">(${escapeHtml(term.serviceName)})</small></h3>
                <div class="term-card-actions">
                    <button class="icon-btn" type="button" data-action="edit" data-name="${escapeHtml(term.serviceName)}">Edit</button>
                    <button class="icon-btn danger" type="button" data-action="delete" data-name="${escapeHtml(term.serviceName)}">Delete</button>
                </div>
            </div>
            ${category}
            <p class="term-description">${escapeHtml(term.description)}</p>
            ${useCasesHtml}
            ${meta}
        </article>
    `;
}

function renderCategoryButtons() {
    const categories = [...new Set(allTerms.map(t => t.category).filter(Boolean))].sort();
    const buttons = [`<button type="button" class="category-btn ${currentCategoryFilter === '' ? 'active' : ''}" data-category="">All</button>`];
    for (const cat of categories) {
        const active = currentCategoryFilter === cat ? 'active' : '';
        buttons.push(`<button type="button" class="category-btn ${active}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`);
    }
    categoryFiltersContainer.innerHTML = buttons.join('');
    categoryFiltersContainer.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => onCategoryClick(btn.dataset.category));
    });
}


// Helpers

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showForm(termToEdit) {
    if (termToEdit) {
        editingTermName = termToEdit.serviceName;
        formTitle.textContent = `Edit term: ${termToEdit.displayName}`;
        submitBtn.textContent = 'Update term';
        serviceNameInput.value = termToEdit.serviceName;
        serviceNameInput.disabled = true;
        displayNameInput.value = termToEdit.displayName || '';
        descriptionInput.value = termToEdit.description || '';
        categoryInput.value = termToEdit.category || '';
        useCasesInput.value = Array.isArray(termToEdit.useCases) ? termToEdit.useCases.join(', ') : '';
    } else {
        editingTermName = null;
        formTitle.textContent = 'Add a new term';
        submitBtn.textContent = 'Save term';
        termForm.reset();
        serviceNameInput.disabled = false;
    }
    formMessage.textContent = '';
    formMessage.className = 'form-message';
    termForm.classList.remove('hidden');
    toggleFormBtn.classList.add('hidden');
    serviceNameInput.focus();
    termForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideForm() {
    termForm.classList.add('hidden');
    toggleFormBtn.classList.remove('hidden');
    termForm.reset();
    serviceNameInput.disabled = false;
    editingTermName = null;
}

function showFormMessage(text, isSuccess) {
    formMessage.textContent = text;
    formMessage.className = isSuccess ? 'form-message success' : 'form-message';
}


// Event handlers

async function onSubmitForm(event) {
    event.preventDefault();
    const payload = {
        serviceName: serviceNameInput.value.trim().toLowerCase(),
        displayName: displayNameInput.value.trim(),
        description: descriptionInput.value.trim(),
        category: categoryInput.value.trim(),
        useCases: useCasesInput.value.split(',').map(s => s.trim()).filter(Boolean),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = editingTermName ? 'Updating...' : 'Saving...';

    try {
        if (editingTermName) {
            const updatePayload = {
                displayName: payload.displayName,
                description: payload.description,
                category: payload.category,
                useCases: payload.useCases,
            };
            await updateTermRequest(editingTermName, updatePayload);
        } else {
            await createTerm(payload);
        }
        await reloadAndRender();
        hideForm();
    } catch (err) {
        showFormMessage(err.message || 'Something went wrong', false);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingTermName ? 'Update term' : 'Save term';
    }
}

function onSearchInput(event) {
    currentSearchQuery = event.target.value;
    renderTerms();
}

function onCategoryClick(category) {
    currentCategoryFilter = category || '';
    categoryFiltersContainer.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === currentCategoryFilter);
    });
    renderTerms();
}

function onEditClick(serviceName) {
    const term = allTerms.find(t => t.serviceName === serviceName);
    if (term) showForm(term);
}

async function onDeleteClick(serviceName) {
    if (!confirm(`Delete "${serviceName}"? This cannot be undone.`)) return;
    try {
        await deleteTermRequest(serviceName);
        await reloadAndRender();
    } catch (err) {
        alert(`Could not delete: ${err.message}`);
    }
}


// Init

async function reloadAndRender() {
    try {
        allTerms = await fetchTerms();
        renderCategoryButtons();
        renderTerms();
    } catch (err) {
        termsList.innerHTML = `<div class="empty-state">Could not load terms: ${escapeHtml(err.message)}</div>`;
        resultsSummary.textContent = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    toggleFormBtn = document.getElementById('toggle-form-btn');
    termForm = document.getElementById('term-form');
    formTitle = document.getElementById('form-title');
    submitBtn = document.getElementById('submit-btn');
    cancelBtn = document.getElementById('cancel-btn');
    formMessage = document.getElementById('form-message');
    searchInput = document.getElementById('search-input');
    categoryFiltersContainer = document.getElementById('category-filters');
    resultsSummary = document.getElementById('results-summary');
    termsList = document.getElementById('terms-list');
    serviceNameInput = document.getElementById('serviceName');
    displayNameInput = document.getElementById('displayName');
    descriptionInput = document.getElementById('description');
    categoryInput = document.getElementById('category');
    useCasesInput = document.getElementById('useCases');

    toggleFormBtn.addEventListener('click', () => showForm(null));
    cancelBtn.addEventListener('click', hideForm);
    termForm.addEventListener('submit', onSubmitForm);
    searchInput.addEventListener('input', onSearchInput);

    reloadAndRender();
});