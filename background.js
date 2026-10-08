/**
 * Background Service Worker (Manifest V3)
 * Manages side panel opening, context menus, keyboard shortcuts, and inter-agent communication.
 */

// On Install Setup
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Agentic EQ Reply Extension Installed.");

  // Configure Side Panel as Primary UI
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn("Could not set sidePanel action behavior:", err);
    });
  }

  // Set default settings if not existing
  const defaults = {
    selectedMode: 'auto',
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    customEndpoint: '',
    qaThreshold: 85,
    maxRevisions: 2,
    isBannerDismissed: false,
    telemetry: {
      totalEvaluations: 0,
      totalPassed: 0,
      totalRevisions: 0,
      acceptanceCounts: { accept: 0, edit: 0, reject: 0 }
    }
  };

  chrome.storage.local.get(Object.keys(defaults), (res) => {
    const toSet = {};
    for (const k in defaults) {
      if (res[k] === undefined) toSet[k] = defaults[k];
    }
    if (Object.keys(toSet).length > 0) {
      chrome.storage.local.set(toSet);
    }
  });

  // Create Context Menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "agentic_eq_draft",
      title: "Draft EQ Reply with Agentic RAG",
      contexts: ["selection", "editable"]
    });

    chrome.contextMenus.create({
      id: "agentic_eq_analyze",
      title: "Analyze Conflict & 4-Stage EQ (Handbook RAG)",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "agentic_eq_open_panel",
      title: "Open Agentic EQ Side Panel",
      contexts: ["page", "action"]
    });
  });
});

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText || "";

  if (info.menuItemId === "agentic_eq_draft" || info.menuItemId === "agentic_eq_analyze") {
    // Store pending selection
    await chrome.storage.local.set({
      pendingSelection: {
        text: selectedText,
        action: info.menuItemId,
        timestamp: Date.now(),
        pageUrl: tab ? tab.url : ''
      }
    });

    // Open side panel
    if (chrome.sidePanel && chrome.sidePanel.open && tab) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
    }

    // Broadcast message to active sidepanel
    chrome.runtime.sendMessage({
      type: "PENDING_SELECTION_READY",
      text: selectedText,
      action: info.menuItemId
    }).catch(() => {
      // Side panel may still be opening, stored pendingSelection will be read on DOMContentLoaded
    });
  } else if (info.menuItemId === "agentic_eq_open_panel") {
    if (chrome.sidePanel && chrome.sidePanel.open && tab) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
    }
  }
});

// Handle Keyboard Shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "open_sidepanel" && tab) {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
    }
  } else if (command === "quick_draft" && tab) {
    // Inject script to get selection
    chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_SELECTION" }, async (response) => {
      const text = response && response.selection ? response.selection : "";
      await chrome.storage.local.set({
        pendingSelection: {
          text: text,
          action: "agentic_eq_draft",
          timestamp: Date.now(),
          pageUrl: tab.url
        }
      });
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
      }
    });
  }
});

// Message Relay (Content Script <-> Side Panel)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_SIDEPANEL_WITH_TEXT") {
    chrome.storage.local.set({
      pendingSelection: {
        text: message.text,
        action: "agentic_eq_draft",
        timestamp: Date.now(),
        pageUrl: sender.tab ? sender.tab.url : ''
      }
    }).then(() => {
      if (sender.tab && chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch(console.error);
      }
      sendResponse({ status: "ok" });
    });
    return true;
  }

  if (message.type === "INSERT_TEXT_INTO_ACTIVE_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "INJECT_REPLY_TEXT",
          text: message.text
        }, (res) => {
          sendResponse(res || { success: false });
        });
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true; // async response
  }
});
