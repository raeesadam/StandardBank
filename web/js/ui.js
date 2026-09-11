import { el, clear } from './util.js';

/* --------------------------------- toasts ------------------------------ */

let toastHost = null;

export function toast(message, kind = 'info') {
  if (!toastHost) {
    toastHost = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastHost);
  }
  const node = el('div', { class: `toast toast--${kind}`, text: message });
  toastHost.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 250);
  }, 4200);
}

/* --------------------------------- modal ------------------------------- */

export function openModal({ title, body, footer, onClose, width }) {
  const previouslyFocused = document.activeElement;

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    onClose?.();
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') trapFocus(event, panel);
  };

  const panel = el('div', {
    class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
    style: width ? { width: `min(${width}, 100%)` } : {},
  }, [
    el('div', { class: 'modal__head' }, [
      el('h2', { text: title }),
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', 'aria-label': 'Close', onclick: close }, '✕'),
    ]),
    el('div', { class: 'modal__body' }, body),
    footer ? el('div', { class: 'modal__foot' }, footer) : null,
  ]);

  const backdrop = el('div', {
    class: 'modal-backdrop',
    onclick: (event) => { if (event.target === backdrop) close(); },
  }, [panel]);

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeydown);
  panel.querySelector('input, select, textarea, button:not([aria-label="Close"])')?.focus();

  return { close, panel };
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(event, container) {
  const items = [...container.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
}

export function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };

    const { close } = openModal({
      title,
      width: '460px',
      body: [el('p', { text: message, style: { margin: 0, color: 'var(--ink-2)' } })],
      footer: [
        el('button', {
          class: 'btn', type: 'button',
          onclick: () => { done(false); close(); },
        }, 'Cancel'),
        el('button', {
          class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, type: 'button',
          onclick: () => { done(true); close(); },
        }, confirmLabel),
      ],
      onClose: () => done(false),
    });
  });
}

/* ---------------------------- form generation --------------------------- */

/**
 * Fields are described declaratively so every entity form - complaint theme,
 * monitoring entry, root cause, action, incident, note - is built the same way.
 *
 * field: { name, label, type, options, required, hint, wide, min, max, step }
 */
export function buildForm(fields, values = {}) {
  const inputs = new Map();
  const grid = el('div', { class: 'form-grid' });

  for (const field of fields) {
    const id = `f-${field.name}-${Math.random().toString(36).slice(2, 8)}`;
    const value = values[field.name] ?? field.default ?? '';
    let input;

    if (field.type === 'select') {
      input = el('select', { id, name: field.name },
        [
          field.allowEmpty ? el('option', { value: '', text: field.emptyLabel || '— none —' }) : null,
          ...(field.options || []).map((option) => {
            const optValue = typeof option === 'object' ? String(option.value) : String(option);
            const optLabel = typeof option === 'object' ? option.label : String(option);
            return el('option', {
              value: optValue, text: optLabel,
              selected: String(value ?? '') === optValue,
            });
          }),
        ]);
    } else if (field.type === 'textarea') {
      input = el('textarea', { id, name: field.name, rows: field.rows || 3, value: value ?? '' });
      input.value = value ?? '';
    } else if (field.type === 'checkbox') {
      input = el('input', { id, name: field.name, type: 'checkbox', checked: !!value });
    } else {
      input = el('input', {
        id, name: field.name,
        type: field.type || 'text',
        value: value ?? '',
        min: field.min, max: field.max, step: field.step,
        placeholder: field.placeholder,
      });
    }

    if (field.required) input.required = true;
    inputs.set(field.name, { input, field });

    const error = el('div', { class: 'field__error', hidden: true });
    const wrapper = el('div', { class: `field${field.wide ? ' field--wide' : ''}` },
      field.type === 'checkbox'
        ? [el('label', { class: 'switch', for: id }, [input, el('span', { text: field.label })]),
           field.hint ? el('div', { class: 'small muted', text: field.hint }) : null, error]
        : [el('label', { for: id, text: field.label + (field.required ? ' *' : '') }),
           input,
           field.hint ? el('div', { class: 'small muted', text: field.hint }) : null,
           error]);

    wrapper._error = error;
    grid.appendChild(wrapper);
  }

  const formError = el('div', { class: 'form-error', hidden: true });
  const form = el('form', { novalidate: true }, [formError, grid]);

  return {
    form,
    values() {
      const out = {};
      for (const [name, { input, field }] of inputs) {
        if (field.type === 'checkbox') { out[name] = input.checked; continue; }
        const raw = input.value;
        if (raw === '' && field.omitWhenEmpty !== false) { out[name] = field.nullable ? null : ''; continue; }
        out[name] = field.type === 'number' ? Number(raw) : raw;
      }
      return out;
    },
    showErrors(fieldErrors = {}, message = '') {
      for (const [, { input }] of inputs) {
        const wrapper = input.closest('.field');
        if (wrapper?._error) { wrapper._error.hidden = true; wrapper._error.textContent = ''; }
      }
      let first = null;
      for (const [name, text] of Object.entries(fieldErrors)) {
        const entry = inputs.get(name);
        if (!entry) continue;
        const wrapper = entry.input.closest('.field');
        if (wrapper?._error) {
          wrapper._error.textContent = `${entry.field.label} ${text}`;
          wrapper._error.hidden = false;
        }
        first = first || entry.input;
      }
      if (message) { formError.textContent = message; formError.hidden = false; }
      else { formError.hidden = true; }
      first?.focus();
    },
    focusFirst() { inputs.values().next().value?.input.focus(); },
  };
}

/**
 * Standard create/edit dialog: builds the form, wires Save, surfaces
 * field-level validation returned by the API back onto the inputs.
 */
export function openFormModal({ title, fields, values, submitLabel = 'Save', onSubmit, width = '680px' }) {
  const { form, values: readValues, showErrors } = buildForm(fields, values);
  const saveBtn = el('button', { class: 'btn btn--primary', type: 'submit' }, submitLabel);

  const submit = async (event) => {
    event?.preventDefault();
    saveBtn.disabled = true;
    try {
      await onSubmit(readValues());
      close();
    } catch (error) {
      showErrors(error.fields || {}, error.fields ? 'Please correct the highlighted fields.' : error.message);
    } finally {
      saveBtn.disabled = false;
    }
  };

  form.addEventListener('submit', submit);

  const { close, panel } = openModal({
    title, width,
    body: [form],
    footer: [
      el('button', { class: 'btn', type: 'button', onclick: () => close() }, 'Cancel'),
      saveBtn,
    ],
  });

  // The save button lives outside the <form> element, so forward its click.
  saveBtn.addEventListener('click', (event) => {
    if (!panel.contains(form)) return;
    event.preventDefault();
    submit();
  });

  return { close };
}

export function emptyState(message, actionLabel, onAction) {
  return el('div', { class: 'empty' }, [
    el('div', { text: message }),
    actionLabel ? el('div', { style: { marginTop: '12px' } }, [
      el('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: onAction }, actionLabel),
    ]) : null,
  ]);
}

export function loading(message = 'Loading…') {
  return el('div', { class: 'loading', text: message });
}

export function sectionHead(title, subtitle, actions = []) {
  return el('div', { class: 'section-head' }, [
    el('div', { style: { flex: '1 1 auto' } }, [
      el('h3', { text: title }),
      subtitle ? el('div', { class: 'small muted', text: subtitle }) : null,
    ]),
    ...actions,
  ]);
}

export { clear };
