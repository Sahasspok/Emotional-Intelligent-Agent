/**
 * Content Script for Agentic EQ Reply Extension
 * Provides selection floating pill, text capture, and native input injection.
 */

let floatingPill = null;
let lastSelectedText = "";

// Listen for selection changes
document.addEventListener('mouseup', (e) => {
  // If clicking on our pill, don't remove it yet
  if (floatingPill && floatingPill.contains(e.target)) return;

  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";

  if (text && text.length >= 15) {
    lastSelectedText = text;
    showFloatingPill(e.pageX, e.pageY, text);
  } else {
    removeFloatingPill();
  }
});

document.addEventListener('mousedown', (e) => {
  if (floatingPill && !floatingPill.contains(e.target)) {
    removeFloatingPill();
  }
});

function showFloatingPill(x, y, text) {
  removeFloatingPill();

  floatingPill = document.createElement('div');
  floatingPill.className = 'agentic-eq-pill';
  floatingPill.innerHTML = `
    <svg class="agentic-eq-pill-icon" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
    </svg>
    <span>Draft EQ Reply</span>
  `;

  // Position nicely slightly above the selection
  floatingPill.style.left = `${Math.min(window.innerWidth - 140, Math.max(10, x - 20))}px`;
  floatingPill.style.top = `${Math.max(10, y - 42)}px`;

  floatingPill.addEventListener('click', (ev) => {
    ev.stopPropagation();
    ev.preventDefault();

    chrome.runtime.sendMessage({
      type: "OPEN_SIDEPANEL_WITH_TEXT",
      text: text
    });

    removeFloatingPill();
  });

  document.body.appendChild(floatingPill);
}

function removeFloatingPill() {
  if (floatingPill && floatingPill.parentNode) {
    floatingPill.parentNode.removeChild(floatingPill);
    floatingPill = null;
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'agentic-eq-toast';
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#2d6a4f">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3500);
}

// Message handler from Background or Side Panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_CURRENT_SELECTION") {
    const sel = window.getSelection() ? window.getSelection().toString().trim() : "";
    sendResponse({ selection: sel || lastSelectedText });
    return true;
  }

  if (request.type === "INJECT_REPLY_TEXT") {
    const replyText = request.text || "";
    const active = document.activeElement;

    let success = false;

    // 1. Textarea or Input
    if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && active.type === 'text'))) {
      const start = active.selectionStart || 0;
      const end = active.selectionEnd || 0;
      const val = active.value;
      active.value = val.substring(0, start) + replyText + val.substring(end);
      active.selectionStart = active.selectionEnd = start + replyText.length;
      active.dispatchEvent(new Event('input', { bubbles: true }));
      active.dispatchEvent(new Event('change', { bubbles: true }));
      success = true;
    }
    // 2. Contenteditable (Gmail compose, Slack web, Notion, LinkedIn)
    else if (active && (active.isContentEditable || active.getAttribute('contenteditable') === 'true')) {
      active.focus();
      if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
        document.execCommand('insertText', false, replyText);
        success = true;
      } else {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(replyText);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          success = true;
        }
      }
      active.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // 3. Find any visible compose box if no active focus
    else {
      const candidates = document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]');
      for (const el of candidates) {
        if (el.offsetParent !== null) { // visible
          el.focus();
          if (el.isContentEditable) {
            document.execCommand('insertText', false, replyText);
            success = true;
          } else {
            el.value = (el.value ? el.value + '\n\n' : '') + replyText;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            success = true;
          }
          break;
        }
      }
    }

    if (success) {
      showToast("EQ Reply successfully inserted into compose window!");
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(replyText).catch(() => {});
      showToast("Could not find focused input — reply copied to clipboard instead!");
    }

    sendResponse({ success });
    return true;
  }
});
