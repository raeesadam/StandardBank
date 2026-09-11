/**
 * Demo-only chrome. Keeps demo concerns out of the product code: it adapts the
 * one control that assumes a server - the export download, which the embedded
 * viewer blocks - and explains where it does work.
 */
import { toast } from './ui.js';
import { t } from './i18n.js';

function adaptExportControl() {
  const link = document.querySelector('.topbar a[href="/api/export"]');
  if (!link) return false;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--sm';
  button.textContent = t('chrome.export');
  button.title = t('demo.exportTitle');
  button.addEventListener('click', () => toast(t('demo.exportHint')));
  link.replaceWith(button);
  return true;
}

// The header may already be on the page by the time this module runs, so try
// straight away and only fall back to watching for it.
if (!adaptExportControl()) {
  const observer = new MutationObserver(() => {
    if (adaptExportControl()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
