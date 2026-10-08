/**
 * Background Service Worker (Manifest V3)
 * Full-Tab Mode: Opens and manages the Agentic EQ Reply Assistant in a full browser tab.
 */

const APP_PATH = "sidepanel/sidepanel.html";

/**
 * Opens the assistant in a full browser tab or focuses it if already open.
 */
async function openOrFocusAppTab(extraData = null) {
  const targetUrl = chrome.runtime.getURL(APP_PATH);

  if (extraData) {
    try {
      await chrome.storage.local.set(extraData);
    } catch (e) {
      console.warn("Could not save extraData to storage:", e);
    }
  }

  try {
    // Find if an app tab is already open in any window
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs.find(t => t.url && (t.url.startsWith(targetUrl) || t.url.includes(APP_PATH)));

    if (existingTab && existingTab.id) {
      // Focus existing tab and bring its window to front
      await chrome.tabs.update(existingTab.id, { active: true });
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true }).catch(() => {});
      }
      // Broadcast pending selection update
      if (extraData && extraData.pendingSelection) {
        chrome.runtime.sendMessage({
          type: "PENDING_SELECTION_READY",
          ...extraData.pendingSelection
        }).catch(() => {});
      }
      return existingTab;
    } else {
      // Open as a new full tab
      const newTab = await chrome.tabs.create({ url: targetUrl });
      return newTab;
    }
  } catch (err) {
    console.error("Error opening full tab:", err);
    // Fallback: create tab directly
    return await chrome.tabs.create({ url: targetUrl });
  }
}

// 1. On Install Setup
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Agentic EQ Reply Extension Installed (Full-Tab Mode).");

  // Set default settings if not already existing
  const defaults = {
    selectedMode: 'local',
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-flash-latest',
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
      title: "Draft EQ Reply (Open in Full Tab)",
      contexts: ["selection", "editable"]
    });

    chrome.contextMenus.create({
      id: "agentic_eq_analyze",
      title: "Analyze Conflict & 4-Stage EQ (Full Tab)",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "agentic_eq_open_app",
      title: "Open Agentic EQ Assistant (Full Tab)",
      contexts: ["page", "action"]
    });
  });
});

// 2. Toolbar Action Click -> Open Full Tab
chrome.action.onClicked.addListener(async (tab) => {
  await openOrFocusAppTab();
});

// 3. Handle Context Menu Clicks -> Open Full Tab
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText || "";

  if (info.menuItemId === "agentic_eq_draft" || info.menuItemId === "agentic_eq_analyze") {
    await openOrFocusAppTab({
      pendingSelection: {
        text: selectedText,
        action: info.menuItemId,
        timestamp: Date.now(),
        pageUrl: tab ? tab.url : ''
      }
    });
  } else if (info.menuItemId === "agentic_eq_open_app") {
    await openOrFocusAppTab();
  }
});

// 4. Handle Keyboard Shortcuts -> Open Full Tab
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "open_app" || command === "open_sidepanel") {
    await openOrFocusAppTab();
  } else if (command === "quick_draft") {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_SELECTION" }, async (response) => {
        const text = response && response.selection ? response.selection : "";
        await openOrFocusAppTab({
          pendingSelection: {
            text: text,
            action: "agentic_eq_draft",
            timestamp: Date.now(),
            pageUrl: tab.url
          }
        });
      });
    } else {
      await openOrFocusAppTab();
    }
  }
});

// 5. Message Relay (Content Scripts <-> Full Tab App)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_APP_WITH_TEXT" || message.type === "OPEN_SIDEPANEL_WITH_TEXT") {
    openOrFocusAppTab({
      pendingSelection: {
        text: message.text,
        action: "agentic_eq_draft",
        timestamp: Date.now(),
        pageUrl: sender.tab ? sender.tab.url : ''
      }
    }).then(() => {
      sendResponse({ status: "ok" });
    });
    return true; // async
  }

  if (message.type === "INSERT_TEXT_INTO_ACTIVE_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // If current active tab is our own extension app, find the most recent other tab
      if (tabs[0] && tabs[0].url && tabs[0].url.includes(chrome.runtime.id)) {
        chrome.tabs.query({ active: false, currentWindow: true }, (otherTabs) => {
          const target = otherTabs[0];
          if (target && target.id) {
            chrome.tabs.sendMessage(target.id, {
              type: "INJECT_REPLY_TEXT",
              text: message.text
            }, (res) => {
              sendResponse(res || { success: false });
            });
          } else {
            sendResponse({ success: false, error: "No target web page tab found" });
          }
        });
      } else if (tabs[0]) {
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
    return true; // async
  }
});
