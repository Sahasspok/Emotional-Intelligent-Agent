/**
 * Popup Controller
 * Manages quick HUD actions, open sidepanel triggering, and connection status.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const badge = document.getElementById('popupModeBadge');
  const label = document.getElementById('popupModeLabel');
  const banner = document.getElementById('popupFallbackBanner');

  let settings = {};
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      settings = await chrome.storage.local.get([
        'selectedMode', 'provider', 'apiKey', 'customEndpoint', 'telemetry', 'apiConnectionVerified'
      ]) || {};
    } catch (e) {}
  }

  const client = new LLMClient({
    provider: settings.provider || 'openai',
    apiKey: settings.apiKey || '',
    customEndpoint: settings.customEndpoint || '',
    isVerified: Boolean(settings.apiConnectionVerified)
  });

  const isConnected = client.isSuccessfullyConnected();
  const isAgenticActive = settings.selectedMode === 'agentic' && isConnected;

  if (isAgenticActive) {
    badge.className = 'mode-pill pill-agentic';
    label.textContent = `Agentic (${(settings.provider || 'AI').toUpperCase()})`;
    banner.style.display = 'none';
  } else {
    badge.className = 'mode-pill pill-local';
    label.textContent = 'Local Fallback';
    banner.style.display = 'block';
  }

  // Populate telemetry
  if (settings.telemetry) {
    const t = settings.telemetry;
    const passRate = t.totalEvaluations > 0 ? Math.round((t.totalPassed / t.totalEvaluations) * 100) : 100;
    document.getElementById('hudPassRate').textContent = `${passRate}%`;
  }

  // Open Side Panel
  document.getElementById('btnOpenSidepanelPrimary').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  });

  // Draft from selection
  document.getElementById('btnDraftFromSelection').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_SELECTION" }, async (res) => {
        const text = res && res.selection ? res.selection : "";
        await chrome.storage.local.set({
          pendingSelection: {
            text,
            action: 'agentic_eq_draft',
            timestamp: Date.now()
          }
        });
        if (chrome.sidePanel && chrome.sidePanel.open) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
          window.close();
        }
      });
    }
  });

  // Connect Agent CTA
  document.getElementById('popupConnectAgentBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : window.open('../options/options.html');
  });

  document.getElementById('popupSettingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : window.open('../options/options.html');
  });
});
