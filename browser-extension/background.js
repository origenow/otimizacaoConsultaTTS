const DEFAULT_SERVER_URL = 'http://localhost:3000';
const ML_DOMAINS = ['mercadolivre.com.br', 'mercadolivre.com'];

chrome.cookies.onChanged.addListener(async (changeInfo) => {
  const { cookie, removed } = changeInfo;
  if (removed || cookie.name !== 'ssid') return;
  if (!ML_DOMAINS.some(domain => cookie.domain.includes(domain))) return;

  await syncCookieToBackend(cookie.value);
});

chrome.runtime.onStartup.addListener(syncCurrentCookie);
chrome.runtime.onInstalled.addListener(syncCurrentCookie);

async function syncCurrentCookie() {
  for (const domain of ML_DOMAINS) {
    const cookie = await chrome.cookies.get({
      url: `https://www.${domain}`,
      name: 'ssid'
    });
    if (cookie) {
      await syncCookieToBackend(cookie.value);
      return;
    }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'syncNow') {
    syncCurrentCookie().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function syncCookieToBackend(ssid) {
  const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get('serverUrl');
  const baseUrl = serverUrl.trim().replace(/\/+$/, '');

  try {
    const response = await fetch(`${baseUrl}/api/settings/ssid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssid })
    });

    if (response.ok) {
      console.log('[ML Sync] ✅ SSID synced to', serverUrl);
      await chrome.storage.local.set({ lastSync: new Date().toISOString(), lastStatus: 'success' });
    } else {
      console.error('[ML Sync] ❌ Server returned', response.status, response.statusText);
      await chrome.storage.local.set({ lastSync: new Date().toISOString(), lastStatus: 'error' });
    }
  } catch (err) {
    console.error('[ML Sync] ❌ Network/CORS error:', err.message, '→ URL:', baseUrl);
    await chrome.storage.local.set({ lastSync: new Date().toISOString(), lastStatus: 'offline' });
  }
}