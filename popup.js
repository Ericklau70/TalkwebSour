// Popup script for TalkwebSour

const toggle = document.getElementById('enable-toggle');
const toggleBtn = document.getElementById('toggle-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const statusLabel = document.getElementById('status-label');

// Load current enabled state
chrome.storage.local.get(['tw_enabled'], (r) => {
  const enabled = r.tw_enabled !== false; // default true
  setEnabledUI(enabled);
});

function setEnabledUI(enabled) {
  toggle.checked = enabled;
  statusDot.className = 'status-dot' + (enabled ? ' on' : '');
  statusText.textContent = enabled ? '已启用' : '已禁用';
  statusLabel.className = 'toggle-label' + (enabled ? ' active' : '');
  toggleBtn.disabled = !enabled;
}

// Enable/disable toggle
toggle.addEventListener('change', async () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ tw_enabled: enabled });
  setEnabledUI(enabled);

  // If disabling, hide sidebar on all tabs
  if (!enabled) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'TW_HIDE' }).catch(() => {});
      }
    } catch (e) {}
  }
});

// Toggle sidebar — 由 background 统一注入，与快捷键行为一致
toggleBtn.addEventListener('click', async () => {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'TW_INJECT_TOGGLE' });
    if (!res || !res.ok) {
      if (res?.error === 'disabled') {
        showStatus('扩展已禁用');
      } else {
        showStatus('此页面不支持注入');
      }
      setTimeout(() => window.close(), 1200);
      return;
    }
    window.close();
  } catch (err) {
    showStatus('发生错误');
    setTimeout(() => window.close(), 1200);
  }
});

function showStatus(msg) {
  toggleBtn.textContent = msg;
  toggleBtn.style.color = '#ff4466';
}
