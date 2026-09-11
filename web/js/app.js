import { el, clear } from './util.js';
import { loadMeta, state, setActor, initTheme, toggleTheme } from './state.js';
import { route, setNotFound, resolve, navigate } from './router.js';
import { renderDashboard } from './views/dashboard.js';
import { renderRegister } from './views/register.js';
import { renderTheme } from './views/theme.js';
import { toast } from './ui.js';

const NAV = [
  { path: '/', label: 'Dashboard' },
  { path: '/register', label: 'Complaint register' },
];

initTheme();

const outlet = el('main', { class: 'layout', id: 'main' });

function topbar() {
  const navButtons = NAV.map((item) => el('button', {
    type: 'button', dataset: { path: item.path },
    onclick: () => navigate(item.path),
  }, item.label));

  const actorInput = el('input', {
    type: 'text', value: state.actor, 'aria-label': 'Your name, recorded against every entry',
    title: 'Every entry you add is recorded against this name',
    onchange: (event) => {
      setActor(event.target.value);
      event.target.value = state.actor;
      toast(`Entries will be recorded as ${state.actor}.`);
    },
  });

  return el('header', { class: 'topbar' }, [
    el('div', {
      class: 'brand', role: 'link', tabindex: 0, style: { cursor: 'pointer' },
      onclick: () => navigate('/'),
      onkeydown: (e) => { if (e.key === 'Enter') navigate('/'); },
    }, [
      el('div', { class: 'brand__mark', text: 'RC' }),
      el('div', { class: 'brand__text' }, [
        el('div', { class: 'brand__title', text: 'Recurrent Complaints Management' }),
        el('div', { class: 'brand__sub', text: 'Themes · root causes · actions · incidents' }),
      ]),
    ]),
    el('nav', { class: 'nav', 'aria-label': 'Primary' }, navButtons),
    el('div', { class: 'topbar__spacer' }),
    el('div', { class: 'topbar__tools' }, [
      el('label', { class: 'actor' }, [el('span', { text: 'Working as' }), actorInput]),
      el('a', {
        class: 'btn btn--sm', href: '/api/export', download: 'recurrent-complaints-export.json',
        title: 'Download every record as JSON',
      }, 'Export'),
      el('button', {
        class: 'btn btn--sm', type: 'button', title: 'Switch between light and dark',
        onclick: (event) => {
          const next = toggleTheme();
          event.currentTarget.textContent = next === 'dark' ? 'Light' : 'Dark';
        },
      }, document.documentElement.getAttribute('data-theme') === 'dark' ? 'Light' : 'Dark'),
    ]),
  ]);
}

function markActiveNav() {
  const path = window.location.pathname;
  for (const button of document.querySelectorAll('.nav button')) {
    const target = button.dataset.path;
    const active = target === '/' ? path === '/' : path.startsWith(target);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
}

async function guard(render) {
  try {
    await render();
  } catch (error) {
    clear(outlet).appendChild(el('div', { class: 'empty' }, [
      el('div', { text: error.message || 'Something went wrong.' }),
      el('div', { style: { marginTop: '12px' } }, [
        el('button', { class: 'btn', type: 'button', onclick: () => resolve() }, 'Try again'),
      ]),
    ]));
  } finally {
    markActiveNav();
    window.scrollTo({ top: 0 });
  }
}

route('/', () => guard(() => renderDashboard(outlet)));
route('/register', (_params, query) => guard(() => renderRegister(outlet, query)));
route('/themes/:id', (params, query) => guard(() => renderTheme(outlet, params.id, query)));

setNotFound(() => {
  clear(outlet).appendChild(el('div', { class: 'empty' }, [
    el('div', { text: 'That page does not exist.' }),
    el('div', { style: { marginTop: '12px' } }, [
      el('button', { class: 'btn', type: 'button', onclick: () => navigate('/') }, 'Go to the dashboard'),
    ]),
  ]));
});

async function start() {
  document.body.appendChild(topbar());
  document.body.appendChild(outlet);
  try {
    await loadMeta();
  } catch (error) {
    toast(`Could not reach the platform API: ${error.message}`, 'error');
  }
  await resolve();
}

start();
