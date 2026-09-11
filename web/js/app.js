import { el, clear } from './util.js';
import { loadMeta, state, setActor, initTheme, toggleTheme } from './state.js';
import { t, LANGUAGES, getLanguage, setLanguage } from './i18n.js';
import { route, setNotFound, resolve, navigate } from './router.js';
import { renderDashboard } from './views/dashboard.js';
import { renderRegister } from './views/register.js';
import { renderTheme } from './views/theme.js';
import { toast } from './ui.js';

const NAV = [
  { path: '/', key: 'nav.dashboard' },
  { path: '/register', key: 'nav.register' },
];

initTheme();

const outlet = el('main', { class: 'layout', id: 'main' });
let header = null;

function isDark() {
  const stamped = document.documentElement.getAttribute('data-theme');
  if (stamped) return stamped === 'dark';
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function topbar() {
  const navButtons = NAV.map((item) => el('button', {
    type: 'button', dataset: { path: item.path },
    onclick: () => navigate(item.path),
  }, t(item.key)));

  const actorInput = el('input', {
    type: 'text', id: 'actor-name', value: state.actor,
    'aria-label': t('chrome.actorHint'), title: t('chrome.actorHint'),
    onchange: (event) => {
      setActor(event.target.value);
      event.target.value = state.actor;
      toast(t('chrome.actorChanged', { name: state.actor }));
    },
  });

  const languageSelect = el('select', {
    id: 'language', class: 'lang-select', 'aria-label': t('chrome.language'),
    title: t('chrome.language'),
    onchange: (event) => {
      setLanguage(event.target.value);
      rebuildChrome();
      resolve();
    },
  }, LANGUAGES.map((entry) => el('option', {
    value: entry.code, text: entry.label, selected: entry.code === getLanguage(),
  })));

  return el('header', { class: 'topbar' }, [
    el('div', {
      class: 'brand', role: 'link', tabindex: 0, style: { cursor: 'pointer' },
      onclick: () => navigate('/'),
      onkeydown: (e) => { if (e.key === 'Enter') navigate('/'); },
    }, [
      el('div', { class: 'brand__mark', text: 'SB' }),
      el('div', { class: 'brand__text' }, [
        el('div', { class: 'brand__title', text: t('app.name') }),
        el('div', { class: 'brand__sub', text: t('app.tagline') }),
      ]),
    ]),
    el('nav', { class: 'nav', 'aria-label': t('nav.primary') }, navButtons),
    el('div', { class: 'topbar__spacer' }),
    el('div', { class: 'topbar__tools' }, [
      el('label', { class: 'actor', for: 'actor-name' }, [
        el('span', { text: t('chrome.workingAs') }), actorInput,
      ]),
      languageSelect,
      el('a', {
        class: 'btn btn--sm', href: '/api/export', download: 'recurrent-complaints-export.json',
        title: t('chrome.exportHint'),
      }, t('chrome.export')),
      el('button', {
        class: 'btn btn--sm', type: 'button', title: t('chrome.themeHint'),
        onclick: (event) => {
          const next = toggleTheme();
          event.currentTarget.textContent =
            next === 'dark' ? t('chrome.themeLight') : t('chrome.themeDark');
        },
      }, isDark() ? t('chrome.themeLight') : t('chrome.themeDark')),
    ]),
  ]);
}

/** Rebuilt in place when the language changes, so the chrome re-reads its labels. */
function rebuildChrome() {
  const next = topbar();
  header.replaceWith(next);
  header = next;
  document.title = t('app.name');
  markActiveNav();
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
      el('div', { text: error.message || t('common.somethingWrong') }),
      el('div', { style: { marginTop: '12px' } }, [
        el('button', { class: 'btn', type: 'button', onclick: () => resolve() }, t('common.tryAgain')),
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
    el('div', { text: t('common.notFound') }),
    el('div', { style: { marginTop: '12px' } }, [
      el('button', { class: 'btn', type: 'button', onclick: () => navigate('/') },
        t('common.goToDashboard')),
    ]),
  ]));
});

async function start() {
  header = topbar();
  document.body.appendChild(header);
  document.body.appendChild(outlet);
  document.title = t('app.name');
  try {
    await loadMeta();
  } catch (error) {
    toast(t('chrome.apiUnreachable', { message: error.message }), 'error');
  }
  await resolve();
}

start();
