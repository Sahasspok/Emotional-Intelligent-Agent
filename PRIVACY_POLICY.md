# Privacy Policy for Agentic EQ Reply

**Effective Date:** October 8, 2026  
**Extension Name:** Agentic EQ Reply — Professional Communications Assistant  
**Repository:** [https://github.com/Sahasspok/Emotional-Intelligent-Agent](https://github.com/Sahasspok/Emotional-Intelligent-Agent)

---

## 1. Introduction
**Agentic EQ Reply** ("we", "our", or "the extension") is a Chrome browser extension designed to assist professionals in drafting emotionally intelligent, executive-grade replies across email, chat, and workplace communication tools. We are deeply committed to protecting your privacy and ensuring transparency regarding how your data is handled.

---

## 2. Single Purpose & Data Processing
The extension has a single, well-defined purpose: to analyze user-provided communication context and assist in generating structured, empathetic, and professional draft responses.

### A. Data Handled Locally
* **Message Context & Prompts**: Text you explicitly select on a web page or paste into the extension is processed in real time to generate draft responses.
* **User Preferences**: Your selected execution mode (Local Offline vs. Cloud AI Agent) and QA evaluation thresholds are stored exclusively on your device using `chrome.storage.local`.
* **API Credentials**: If you choose to connect a cloud AI provider (e.g., Google Gemini, OpenAI, Anthropic, or Mistral), your private API keys are stored locally on your device within `chrome.storage.local`. They are never transmitted to our servers or any third-party analytics services.

### B. Third-Party API Calls (Cloud AI Mode Only)
* **Local Offline Engine**: When operating in Local Offline mode, all draft generation and Managerial EQ protocol lookups occur 100% locally on your machine using the bundled offline knowledge index. No network requests are made.
* **Cloud AI Agent Mode**: If you explicitly configure and enable a third-party AI provider (Google Gemini, OpenAI, Anthropic, Mistral, or Ollama), the extension transmits only the message context needed to generate the reply directly from your browser to the chosen provider's official API endpoint using your personal API key. We do not operate intermediate proxy servers.

---

## 3. Data We Do NOT Collect
We strictly adhere to privacy-by-design principles:
* We **do not** collect or store Personally Identifiable Information (PII) such as your name, email address, physical address, or phone number.
* We **do not** collect health, biometric, financial, or payment information.
* We **do not** track your browsing history or record web pages you visit.
* We **do not** monitor keystrokes or background network activity.
* We **do not** sell, rent, lease, or monetize user data under any circumstance.
* We **do not** use user data for targeted advertising, credit scoring, or lending purposes.

---

## 4. Permissions Justification
* **`tabs`**: Used strictly to open or focus the extension's workspace tab and to insert user-approved drafted text into the active compose field on your command.
* **`storage`**: Used to save your chosen mode, local settings, and optional API keys directly within your private local browser profile.
* **`contextMenus`**: Allows you to right-click highlighted message text on a page and send it directly to the assistant for reply drafting.
* **`activeTab`**: Used only when you interact with the extension to read selected message text or insert the approved response into compose inputs (e.g., Gmail, Slack, LinkedIn).
* **Host Permissions**: Limited to official AI provider endpoints (`generativelanguage.googleapis.com`, `api.openai.com`, `api.anthropic.com`, `api.mistral.ai`, and localhost for Ollama) to allow direct browser-to-API communication when you opt into cloud model execution.

---

## 5. Security & Retention
All data stored by the extension resides in Chrome's sandboxed local storage on your device. You can permanently delete all stored credentials and preferences at any time by clicking "Reset" in the extension settings or by uninstalling the extension.

---

## 6. Chrome Web Store Policy Compliance
Agentic EQ Reply complies fully with the [Google Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/), including the Limited Use requirements.

---

## 7. Contact & Open Source Inquiries
If you have questions or feedback regarding this Privacy Policy, please open an issue on our GitHub repository:  
[https://github.com/Sahasspok/Emotional-Intelligent-Agent/issues](https://github.com/Sahasspok/Emotional-Intelligent-Agent/issues)
