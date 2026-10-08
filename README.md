# Agentic EQ Reply — Manifest V3 Chrome Extension

> **A professional communications assistant powered by an agentic, RAG-backed workflow anchored in the Managerial EQ Handbook.**

---

## Highlights

- **Primary Source of Truth**: Evaluates, grounds, and cites the **Managerial EQ Handbook** (`Managerial_EQ_Handbook_FINAL.docx`) across 15 standardized scenario protocols (§4.1–§4.15).
- **Core Modes & Insistence UX**:
  - **Agentic Mode (Preferred)**: Full multi-agent orchestration (OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, Google Gemini, Ollama, Custom Webhooks).
  - **Local Fallback**: 100% offline deterministic execution. Displays a persistent but dismissible insistence banner: *"You're on local fallback. Connect an agent for better research, accuracy, and QA-verified replies."* (CTA: `Connect Agent` | Secondary: `Continue local`). Outputs are clearly watermarked *"Local fallback — lower confidence."*
- **Universal 4-Stage Real-Time Manager Response Model**:
  1. *Detect & Pause* (Emotional grounding, boundary checking)
  2. *Reappraise & Regulate* (Separating ego from operational reality)
  3. *Empathetic Engagement* (Acknowledging impact without conceding legal liability)
  4. *Collaborative Resolution* (Concrete actions, owners, timeline, escalation)
- **Multi-Agent Architecture**:
  - `Orchestrator / Planner`: Manages 9-step reversible state machine.
  - `Context Collector`: Analyzes channel constraints, tone, and statutory risk flags.
  - `Retrieval Agent`: Executes BM25 + Vector TF-IDF RAG retrieval against the Handbook corpus.
  - `Research Agent`: Synthesizes peer-reviewed research (Edmondson, Gross, Bakker & Demerouti); enforces rule that **Source of Truth wins** in case of conflicts.
  - `Doer Agent`: Drafts channel-formatted replies (Email, Slack, LinkedIn, Support, Strategy Memos).
  - `Multi-Agent QA Suite`: Factual QA, Style & Brand QA, Safety & Privacy QA (Section 8 boundaries), Tone & Channel QA.
  - `Benchmarking Agent`: Scores against an 8-factor rubric (0–100, threshold $\ge 85$) with automatic revision loop.
- **Apple Human Interface Guidelines (HIG)**:
  - SF Pro typography stack (`system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text"`).
  - 8pt grid, minimal chrome, subtle depth, dark mode support, reduced motion.
  - **Exact Brand Palette**:
    - **Navy (`#1a3a5c`)**: Anchor, cover backgrounds, page bands, wordmark.
    - **Accent Red (`#c8440a`)**: CTAs, key highlights, escalation/risk flags.
    - **Gold (`#d4a017`)**: Premium/AI marker, highlighted numerals.
    - **Teal (`#0d7377`)**: Info cards, secondary topics, RAG score badges.
    - **Purple (`#6b3fa0`)**: Tertiary accent, research topics.
    - **Ink (`#0e1117`)**: Body text, dark panels.
    - **Paper (`#f8f5ef`)**: Base page background.
    - **Light BG (`#f0ece3`)**: Card zebra striping, accordion headers.
    - **Green (`#2d6a4f`)**: Success flags, passing scores only.
- **Side Panel as Primary UI**: Uses `chrome.sidePanel` to work smoothly alongside Gmail, Slack, and LinkedIn.
- **Universal DOM Injection**: Injects formatted replies directly into active `<textarea>`, `<input>`, or `contenteditable` compose boxes.

---

## Directory Structure

```
agentic-eq-reply-extension/
├── manifest.json                  # Manifest V3 configuration
├── background.js                  # Background service worker (sidepanel, menus, commands)
├── ARCHITECTURE.md                # Full system architecture document
├── TEST_PLAN.md                   # Acceptance criteria & test verification matrix
├── README.md                      # Documentation & user guide
├── sidepanel/                     # Primary Workspace UI
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
├── popup/                         # Compact HUD Popup
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                       # Settings & Agent Connectors
│   ├── options.html
│   ├── options.css
│   └── options.js
├── content/                       # Webpage Text Extraction & DOM Injection
│   ├── content.js
│   └── content.css
├── lib/
│   ├── rag/
│   │   ├── corpus.json            # 36 structured chunks parsed from Handbook
│   │   ├── index.json             # Precomputed BM25 inverted index (1,842 terms)
│   │   └── rag_engine.js          # Client-side hybrid BM25 + Vector RAG engine
│   ├── agents/
│   │   ├── orchestrator.js        # Reversible 9-step state machine
│   │   ├── context_collector.js   # Intent, channel, and risk flag analyzer
│   │   ├── retrieval_agent.js     # Handbook query & citation generator
│   │   ├── research_agent.js      # Behavioral science evidence & precedence
│   │   ├── doer_agent.js          # Channel-tailored 4-stage EQ drafter
│   │   ├── local_engine.js        # Offline deterministic fallback generator
│   │   ├── qa_agents.js           # Factual, Style, Safety, Tone QA suite
│   │   ├── benchmarking_agent.js  # 8-factor rubric (0-100) & revision manager
│   │   └── llm_client.js          # OpenAI, Claude, Gemini, Ollama multi-provider
│   ├── benchmarks/
│   │   ├── gold_set.json          # 6 Gold Standard regression tasks
│   │   └── benchmark_runner.js    # Automated benchmark executor & KPI tracker
│   └── icons/
│       ├── icon.svg
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
├── scripts/
│   └── build_corpus.py            # Reproducible docx parser and indexer
└── tests/
    ├── test_rag.js                # RAG retrieval unit tests
    ├── test_agents.js             # Agent suite & state machine tests
    └── test_benchmarks.js         # Gold set regression benchmark suite
```

---

## Quick Start & Installation

### 1. Load Unpacked in Google Chrome
1. Open Google Chrome.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in top right).
4. Click **Load unpacked**.
5. Select the directory:
   ```
   /Users/moderntechnepal/agentic-eq-reply-extension
   ```
6. The extension is now active. Click the extension icon in your Chrome toolbar to open the **Side Panel**.

### 2. Connect an External Agent (Optional, Recommended)
1. Click the **Gear icon** in the top right of the side panel (or right click the extension icon and select **Options**).
2. Choose your provider:
   - **OpenAI**: Enter API Key (`sk-...`) and select model (`gpt-4o` or `gpt-4o-mini`).
   - **Anthropic**: Enter API Key (`sk-ant-...`) and select model (`claude-3-5-sonnet-20241022`).
   - **Google Gemini**: Enter API Key and select model (`gemini-1.5-pro` or `gemini-1.5-flash`).
   - **Local Ollama**: No key required! Set endpoint to `http://localhost:11434` and model to `llama3.2`.
   - **Custom Webhook**: Enter custom API endpoint.
3. Click **Test Connection** to verify live connectivity.
4. Click **Save Settings**.

---

## Running Automated Tests

Run the full verification suite using Node.js:
```bash
cd /Users/moderntechnepal/agentic-eq-reply-extension
node tests/test_rag.js && node tests/test_agents.js && node tests/test_benchmarks.js
```

**Benchmark Results**:
- **Total Gold Tasks**: 6
- **Pass Rate**: 100%
- **Average QA Score**: 100/100
- **Citation Coverage**: 100%
- **Average Latency**: 3ms
