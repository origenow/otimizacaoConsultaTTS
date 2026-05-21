const DEFAULT_SERVER_URL = 'http://localhost:3000';

const statusBadge = document.getElementById('status-badge');
const lastSyncEl = document.getElementById('last-sync');
const serverUrlInput = document.getElementById('server-url');
const saveUrlBtn = document.getElementById('save-url');
const syncNowBtn = document.getElementById('sync-now');
const toast = document.getElementById('toast');

const BADGE_CONFIG = {
  success: { text: 'OK',      className: 'badge success' },
  error:   { text: 'Erro',    className: 'badge error'   },
  offline: { text: 'Offline', className: 'badge offline' },
  unknown: { text: '—',       className: 'badge unknown' },
};

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.className = isError ? 'toast error' : 'toast';
  setTimeout(() => { toast.textContent = ''; }, 3000);
}

async function loadState() {
  const { serverUrl = DEFAULT_SERVER_URL, lastSync, lastStatus = 'unknown' }
    = await chrome.storage.local.get(['serverUrl', 'lastSync', 'lastStatus']);

  serverUrlInput.value = serverUrl;

  const cfg = BADGE_CONFIG[lastStatus] || BADGE_CONFIG.unknown;
  statusBadge.textContent = cfg.text;
  statusBadge.className = cfg.className;

  lastSyncEl.textContent = lastSync
    ? new Date(lastSync).toLocaleString('pt-BR')
    : 'Nunca';
}

saveUrlBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim();
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocolo inválido');
    await chrome.storage.local.set({ serverUrl: url });
    showToast('URL salva!');
  } catch {
    showToast('URL inválida. Use http:// ou https://', true);
  }
});

syncNowBtn.addEventListener('click', async () => {
  syncNowBtn.disabled = true;
  syncNowBtn.textContent = 'Sincronizando…';

  await chrome.runtime.sendMessage({ action: 'syncNow' });

  await new Promise(resolve => setTimeout(resolve, 800));
  await loadState();

  syncNowBtn.disabled = false;
  syncNowBtn.textContent = '⟳ Sincronizar agora';
  showToast('Sync concluído!');
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'syncDone') loadState();
});

loadState();