/**
 * Chrome API Polyfill & Shim for Localhost Web Simulator
 * Transparently emulates chrome.storage.local, chrome.runtime, chrome.tabs, and chrome.sidePanel
 * when running outside the Chrome Extension environment (e.g. at http://localhost:3000).
 */

(function () {
  if (typeof window === 'undefined') return;

  // If already running in a real Chrome extension context with storage, don't overwrite
  if (window.chrome && window.chrome.storage && window.chrome.storage.local && window.chrome.runtime && window.chrome.runtime.id) {
    return;
  }

  console.log("[ChromeShim] Initializing local storage and runtime polyfill for localhost simulation.");

  const memoryStorage = {};

  // Initialize storage from localStorage if available
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ext_eq_')) {
        const cleanKey = key.replace('ext_eq_', '');
        try {
          memoryStorage[cleanKey] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          memoryStorage[cleanKey] = localStorage.getItem(key);
        }
      }
    }
  } catch (e) {}

  const storageListeners = [];
  const messageListeners = [];

  const fakeChrome = {
    storage: {
      local: {
        get: (keys, callback) => {
          let result = {};
          if (keys === null || keys === undefined) {
            result = { ...memoryStorage };
          } else if (typeof keys === 'string') {
            result[keys] = memoryStorage[keys];
          } else if (Array.isArray(keys)) {
            for (const k of keys) {
              if (memoryStorage[k] !== undefined) result[k] = memoryStorage[k];
            }
          } else if (typeof keys === 'object') {
            for (const k in keys) {
              result[k] = memoryStorage[k] !== undefined ? memoryStorage[k] : keys[k];
            }
          }

          if (typeof callback === 'function') {
            setTimeout(() => callback(result), 0);
          }
          return Promise.resolve(result);
        },
        set: (items, callback) => {
          for (const k in items) {
            memoryStorage[k] = items[k];
            try {
              localStorage.setItem('ext_eq_' + k, JSON.stringify(items[k]));
            } catch (e) {}
          }
          if (typeof callback === 'function') {
            setTimeout(callback, 0);
          }
          return Promise.resolve();
        },
        remove: (keys, callback) => {
          const list = Array.isArray(keys) ? keys : [keys];
          for (const k of list) {
            delete memoryStorage[k];
            try {
              localStorage.removeItem('ext_eq_' + k);
            } catch (e) {}
          }
          if (typeof callback === 'function') setTimeout(callback, 0);
          return Promise.resolve();
        },
        clear: (callback) => {
          for (const k in memoryStorage) {
            delete memoryStorage[k];
            try {
              localStorage.removeItem('ext_eq_' + k);
            } catch (e) {}
          }
          if (typeof callback === 'function') setTimeout(callback, 0);
          return Promise.resolve();
        }
      },
      sync: null // will alias to local below
    },
    runtime: {
      id: "agentic-eq-localhost-sim",
      getURL: (filePath) => {
        if (!filePath) return window.location.origin;
        if (filePath.startsWith('/')) return filePath;
        return '/' + filePath;
      },
      onMessage: {
        addListener: (fn) => {
          messageListeners.push(fn);
        },
        removeListener: (fn) => {
          const idx = messageListeners.indexOf(fn);
          if (idx !== -1) messageListeners.splice(idx, 1);
        }
      },
      sendMessage: (message, callback) => {
        let responded = false;
        const sendResponse = (res) => {
          if (responded) return;
          responded = true;
          if (typeof callback === 'function') callback(res);
        };

        // Forward to window message if inside iframe
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "FROM_EXTENSION_SHIM", payload: message }, "*");
        }

        for (const listener of [...messageListeners]) {
          try {
            const willRespondAsync = listener(message, { tab: { id: 1, url: window.location.href } }, sendResponse);
            if (!willRespondAsync && !responded) {
              // Synchronous return
            }
          } catch (err) {
            console.error("[ChromeShim] Message listener error:", err);
          }
        }

        return Promise.resolve({ status: "ok" });
      },
      openOptionsPage: () => {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "OPEN_OPTIONS_PAGE" }, "*");
        } else {
          window.open('/options/options.html', '_blank');
        }
      }
    },
    tabs: {
      query: (queryInfo, callback) => {
        const tabs = [{ id: 1, url: window.location.href, title: "Active Tab Simulator", windowId: 1 }];
        if (typeof callback === 'function') callback(tabs);
        return Promise.resolve(tabs);
      },
      sendMessage: (tabId, message, callback) => {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "SEND_TAB_MESSAGE", message: message }, "*");
        }
        if (typeof callback === 'function') callback({ success: true });
        return Promise.resolve({ success: true });
      }
    },
    sidePanel: {
      open: ({ windowId } = {}) => {
        console.log("[ChromeShim] sidePanel.open called for window:", windowId);
        return Promise.resolve();
      },
      setPanelBehavior: () => Promise.resolve()
    },
    commands: {
      onCommand: { addListener: () => {} }
    },
    contextMenus: {
      create: () => {},
      removeAll: (cb) => { if (cb) cb(); },
      onClicked: { addListener: () => {} }
    }
  };

  fakeChrome.storage.sync = fakeChrome.storage.local;
  fakeChrome.storage.onChanged = {
    addListener: (fn) => {
      if (typeof fn === 'function') storageListeners.push(fn);
    },
    removeListener: (fn) => {
      const idx = storageListeners.indexOf(fn);
      if (idx !== -1) storageListeners.splice(idx, 1);
    }
  };

  // Safely augment window.chrome without replacing the read-only window.chrome reference in Chromium
  if (typeof window.chrome !== 'object' || window.chrome === null) {
    try {
      window.chrome = fakeChrome;
    } catch (e) {}
  }

  try {
    if (!window.chrome.storage) {
      window.chrome.storage = fakeChrome.storage;
    } else {
      if (!window.chrome.storage.local) window.chrome.storage.local = fakeChrome.storage.local;
      if (!window.chrome.storage.sync) window.chrome.storage.sync = fakeChrome.storage.sync;
      if (!window.chrome.storage.onChanged) window.chrome.storage.onChanged = fakeChrome.storage.onChanged;
    }

    if (!window.chrome.runtime) {
      window.chrome.runtime = fakeChrome.runtime;
    } else {
      for (const k in fakeChrome.runtime) {
        if (window.chrome.runtime[k] === undefined) {
          try { window.chrome.runtime[k] = fakeChrome.runtime[k]; } catch (e) {}
        }
      }
    }

    if (!window.chrome.tabs) {
      try { window.chrome.tabs = fakeChrome.tabs; } catch (e) {}
    }

    if (!window.chrome.sidePanel) {
      try { window.chrome.sidePanel = fakeChrome.sidePanel; } catch (e) {}
    }

    if (!window.chrome.commands) {
      try { window.chrome.commands = fakeChrome.commands; } catch (e) {}
    }

    if (!window.chrome.contextMenus) {
      try { window.chrome.contextMenus = fakeChrome.contextMenus; } catch (e) {}
    }
  } catch (err) {
    console.warn("[ChromeShim] Augmentation warning:", err);
  }

  // Listen for parent messages from the simulator
  window.addEventListener('message', (ev) => {
    if (ev.data && ev.data.type === "SIMULATOR_MESSAGE") {
      const msg = ev.data.payload;
      for (const listener of messageListeners) {
        listener(msg, { tab: { id: 1, url: window.location.href } }, () => {});
      }
    }
  });

})();
