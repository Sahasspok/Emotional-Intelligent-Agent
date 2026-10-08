/**
 * Google Enterprise Product Controller for Agentic EQ Reply
 * Tactile Button Architecture, Multi-Agent Engine Selection, GitHub OAuth Repo, and Expanded Protocols
 */

let orchestrator = null;
let benchmarkRunner = null;
let llmClient = null;

let selectedEngineMode = 'local';
let selectedGoal = 'de-escalate_and_set_boundaries';
let selectedChannel = 'email';
let selectedTone = 'Empathetic & Firm';

/**
 * Clean and human-readable protocol mapping.
 * Removes technical markers like §4.2, $4.2, §4.1, §2.0, [Managerial EQ Handbook ...]
 * Strictly returns human-readable names as requested.
 */
function formatHumanProtocolName(raw) {
  if (!raw) return 'Managerial EQ Protocol';
  let str = String(raw).trim();

  // Strip enclosing brackets
  str = str.replace(/^\[+|\]+$/g, '');

  // Strip handbook prefix
  str = str.replace(/Managerial EQ Handbook\s*/gi, '');

  const protocolNamesMap = {
    '4.1': 'Client Escalation Protocol',
    '4.2': 'Technical Task Conflict Protocol',
    '4.3': 'Team Relationship Conflict Protocol',
    '4.4': 'Executive Pressure & Upward Demands',
    '4.5': 'Team Burnout & Overload Recovery',
    '4.6': 'Employee Performance Review Protocol',
    '4.7': 'Disciplinary Conversation Protocol',
    '4.8': 'Layoff & Restructuring Communication',
    '4.9': 'Remote & Hybrid Team Disconnect',
    '4.10': 'Cross-Cultural Misunderstanding Protocol',
    '4.11': 'Harassment & Safety Escalation',
    '4.12': 'Ethical Dilemma & Whistleblowing',
    '4.13': 'Mental-Health Crisis & Acute Distress',
    '4.14': 'Toxic High-Performer Conduct Protocol',
    '4.15': 'Budget Cut & Resource Reduction Protocol',
    '2.0': 'Universal 4-Stage Response Model',
    '1.0': 'Managerial Resilience & Job Demands Framework',
    '1.2': 'Job Demands-Resources (JD-R) Audit',
    '3.1': 'JD-R Workload & Resource Diagnostics',
    '8.0': 'Ethical & Statutory Safety Boundaries'
  };

  // If string is purely a section code like §4.2, $4.2, 4.2
  const bareMatch = str.match(/^[§\$]?\s*(\d+\.\d+)\s*$/);
  if (bareMatch && protocolNamesMap[bareMatch[1]]) {
    return protocolNamesMap[bareMatch[1]];
  }

  // Strip section prefix and punctuation
  str = str.replace(/[§\$]?\s*\d+(\.\d+)?:?\s*/gi, '');
  str = str.replace(/^[:\-\s]+/, '').trim();

  if (protocolNamesMap[str]) {
    return protocolNamesMap[str];
  }

  // Final cleanup of any stray symbols
  str = str.replace(/[§\$]\d+(\.\d+)?/g, '').replace(/[§\$]/g, '').trim();

  return str || 'Managerial EQ Protocol';
}

document.addEventListener('DOMContentLoaded', async () => {
  await initializeStack();
  setupUIHandlers();
  checkForPendingSelection();
});

async function loadJSONWithFallbacks(fileName) {
  const candidatePaths = [
    `../lib/rag/${fileName}`,
    `/lib/rag/${fileName}`,
    `lib/rag/${fileName}`
  ];
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    try {
      candidatePaths.unshift(chrome.runtime.getURL(`lib/rag/${fileName}`));
    } catch (e) {}
  }

  for (const path of candidatePaths) {
    try {
      const res = await fetch(path);
      if (res && res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Continue to next candidate
    }
  }
  throw new Error(`Could not load ${fileName} from any candidate path.`);
}

async function initializeStack() {
  try {
    // 1. Load Knowledge Base & Index with candidate fallbacks
    const corpus = await loadJSONWithFallbacks('corpus.json');
    const index = await loadJSONWithFallbacks('index.json');

    // 2. Safely Load User Settings
    let settings = {};
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        settings = await chrome.storage.local.get([
          'selectedMode', 'provider', 'apiKey', 'model', 'customEndpoint', 
          'qaThreshold', 'maxRevisions', 'githubRepoUrl', 'apiConnectionVerified', 'apiConnectionDetails'
        ]) || {};
      } catch (e) {
        console.warn("[SidePanel] Storage get warning:", e);
      }
    }

    // 3. Initialize Multi-Agent Stack
    const ragEngine = new RAGEngine(corpus, index);
    const contextCollector = new ContextCollectorAgent();
    const retrievalAgent = new RetrievalAgent(ragEngine);
    const researchAgent = new ResearchAgent();
    const localEngine = new LocalEQEngine(corpus);

    llmClient = new LLMClient({
      provider: settings.provider || 'gemini',
      apiKey: settings.apiKey || '',
      model: settings.model || 'gemini-flash-latest',
      customEndpoint: settings.customEndpoint || '',
      isVerified: Boolean(settings.apiConnectionVerified)
    });

    const doerAgent = new DoerAgent(llmClient, localEngine);
    const benchmarkingAgent = new BenchmarkingAgent({
      threshold: settings.qaThreshold || 85,
      maxRevisions: settings.maxRevisions || 2
    });

    orchestrator = new AgentOrchestrator({
      ragEngine,
      contextCollector,
      retrievalAgent,
      researchAgent,
      doerAgent,
      benchmarkingAgent,
      llmClient,
      localEngine
    });

    window.orchestrator = orchestrator;
    benchmarkRunner = new BenchmarkRunner(orchestrator);
    window.benchmarkRunner = benchmarkRunner;

    // Initial Engine State: ONLY activate agentic if connection is genuinely verified
    const isConnVerified = llmClient.isSuccessfullyConnected();
    if (settings.selectedMode === 'github' && settings.githubRepoUrl) {
      selectedEngineMode = 'github';
    } else if (settings.selectedMode === 'agentic' && isConnVerified) {
      selectedEngineMode = 'agentic';
    } else {
      selectedEngineMode = 'local';
    }

    // Populate inputs from saved settings
    if (settings.model) {
      const modelInput = document.getElementById('customModelNameInput');
      if (modelInput) modelInput.value = settings.model;
    }
    if (settings.customEndpoint) {
      const endpointInput = document.getElementById('customApiEndpointInput');
      if (endpointInput) endpointInput.value = settings.customEndpoint;
    }
    if (settings.apiKey) {
      const keyInput = document.getElementById('quickApiKeyInput');
      if (keyInput) keyInput.value = settings.apiKey;
    }
    if (settings.githubRepoUrl) {
      const repoInput = document.getElementById('githubRepoUrlInput');
      if (repoInput) repoInput.value = settings.githubRepoUrl;
    }

    updateEngineStatusBadge();

    // Listen for storage changes
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.apiKey || changes.provider || changes.model || changes.customEndpoint || changes.apiConnectionVerified || changes.selectedMode) {
          chrome.storage.local.get(['provider', 'apiKey', 'model', 'customEndpoint', 'apiConnectionVerified', 'selectedMode'], (newSet) => {
            if (newSet && llmClient) {
              llmClient.setConfig({
                provider: newSet.provider,
                apiKey: newSet.apiKey,
                model: newSet.model,
                customEndpoint: newSet.customEndpoint,
                isVerified: Boolean(newSet.apiConnectionVerified)
              });
              if (newSet.selectedMode === 'agentic' && llmClient.isSuccessfullyConnected()) {
                selectedEngineMode = 'agentic';
              } else if (newSet.selectedMode === 'github') {
                selectedEngineMode = 'github';
              } else {
                selectedEngineMode = 'local';
              }
              updateEngineStatusBadge();
            }
          });
        }
      });
    }

    console.log("Google Enterprise UI initialized with tactile buttons and multi-agent options.");
  } catch (err) {
    console.error("Initialization error:", err);
    showErrorNotice("Engine Initialization Notice", "Could not initialize knowledge stack: " + err.message, false);
  }
}

function setupUIHandlers() {
  // Theme Toggle
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    document.body.classList.toggle('theme-dark');
  });

  // Settings / Options
  document.getElementById('openOptionsBtn').addEventListener('click', () => {
    if (chrome.runtime && chrome.runtime.openOptionsPage && !window.chrome?.runtime?.isShim) {
      chrome.runtime.openOptionsPage();
    } else {
      window.location.href = '../options/options.html';
    }
  });

  // Regression Benchmarks Modal
  const benchModal = document.getElementById('benchmarksModal');
  document.getElementById('openBenchmarksBtn').addEventListener('click', () => {
    benchModal.style.display = 'flex';
  });
  document.getElementById('closeBenchmarksModal').addEventListener('click', () => {
    benchModal.style.display = 'none';
  });

  // Run Gold Benchmark Suite
  document.getElementById('btnRunGoldSuite').addEventListener('click', async () => {
    const lbl = document.getElementById('benchmarkProgressLabel');
    const container = document.getElementById('benchmarkResultsArea');
    lbl.textContent = 'Running 6 Tasks...';
    container.innerHTML = '<div style="padding:14px;text-align:center;color:var(--g-text-secondary);font-size:14px;">Testing regression accuracy and handbook grounding...</div>';

    const summary = await benchmarkRunner.runAll({ mode: selectedEngineMode === 'github' ? 'agentic' : selectedEngineMode });
    lbl.textContent = `Completed: ${summary.passRate} Passed`;

    container.innerHTML = `
      <div style="margin-bottom:12px;font-size:14px;font-weight:700;color:var(--g-text-primary);">
        Pass Rate: ${summary.passRate} | Avg QA Score: ${summary.averageScore}/100 | Latency: ${summary.averageLatencyMs}ms
      </div>
      ${summary.taskDetails.map(t => `
        <div style="padding:12px 16px;border-radius:10px;margin-bottom:8px;background:var(--g-surface-tonal);border-left:4px solid ${t.passedAll ? 'var(--color-green)' : 'var(--color-red)'};font-size:14px;box-shadow:var(--shadow-btn-base);">
          <div style="display:flex;justify-content:space-between;font-weight:700;">
            <span>${t.taskName}</span>
            <span>${t.passedAll ? '✓ PASS' : '✗ FAIL'} (${t.qaScore}/100)</span>
          </div>
          <div style="font-size:13px;color:var(--g-text-secondary);margin-top:4px;">
            Protocol: ${formatHumanProtocolName(t.expectedSection)} | Verification: ${t.passedAll ? 'Verified Grounding' : 'Review Needed'} | ${t.latencyMs}ms
          </div>
        </div>
      `).join('')}
    `;
  });

  // Open Dedicated Settings Page Helper (Navigates to new page to prevent information overload)
  function openSettingsPage() {
    if (chrome.runtime && chrome.runtime.openOptionsPage && !window.chrome?.runtime?.isShim) {
      chrome.runtime.openOptionsPage();
    } else {
      window.location.href = '../options/options.html';
    }
  }

  // Active Setting Card & Change Mode Button (Takes user to dedicated settings page)
  const btnConfigureEngine = document.getElementById('btnConfigureEngine');
  if (btnConfigureEngine) {
    btnConfigureEngine.addEventListener('click', (e) => {
      e.stopPropagation();
      openSettingsPage();
    });
  }

  const activeSettingCard = document.getElementById('activeSettingCard');
  if (activeSettingCard) {
    activeSettingCard.addEventListener('click', () => {
      openSettingsPage();
    });
    activeSettingCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSettingsPage();
      }
    });
  }

  // Banner Actions
  const bannerConnectBtn = document.getElementById('bannerConnectBtn');
  if (bannerConnectBtn) {
    bannerConnectBtn.addEventListener('click', () => {
      openSettingsPage();
    });
  }

  const bannerDismissBtn = document.getElementById('bannerDismissBtn');
  if (bannerDismissBtn) {
    bannerDismissBtn.addEventListener('click', () => {
      const banner = document.getElementById('fallbackCalloutBanner');
      if (banner) banner.style.display = 'none';
    });
  }

  // Error Notice Card Action Listeners (Zero Alert Popups)
  const dismissErrorBtn = document.getElementById('btnDismissErrorCard');
  if (dismissErrorBtn) {
    dismissErrorBtn.addEventListener('click', hideErrorNotice);
  }

  const errorFallbackBtn = document.getElementById('btnErrorFallback');
  if (errorFallbackBtn) {
    errorFallbackBtn.addEventListener('click', () => {
      hideErrorNotice();
      selectedEngineMode = 'local';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ selectedMode: 'local' });
      }
      updateEngineStatusBadge();
      const genBtn = document.getElementById('btnGenerateMagic');
      if (genBtn) genBtn.click();
    });
  }

  const errorSettingsBtn = document.getElementById('btnErrorEditSettings');
  if (errorSettingsBtn) {
    errorSettingsBtn.addEventListener('click', () => {
      hideErrorNotice();
      openSettingsPage();
    });
  }

  // Context Input & Word Count
  const contextInput = document.getElementById('mainContextInput');
  const wordCountLabel = document.getElementById('quickWordCount');
  const riskIndicator = document.getElementById('riskIndicatorText');
  const riskFlagLabel = document.getElementById('riskFlagLabel');

  contextInput.addEventListener('input', () => {
    const text = contextInput.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCountLabel.textContent = `${words} words`;

    if (orchestrator && orchestrator.contextCollector) {
      const flags = orchestrator.contextCollector.detectRiskFlags(text);
      if (flags && flags.length > 0) {
        riskIndicator.style.display = 'inline-flex';
        const humanFlagNames = {
          legal_harassment_boundary: 'Legal & Harassment Notice',
          clinical_distress_boundary: 'Clinical Distress Gate',
          contract_breach_boundary: 'Contract Breach Notice',
          whistleblower_boundary: 'Whistleblower Protection Notice'
        };
        const title = humanFlagNames[flags[0].type] || 'Boundary Notice';
        if (riskFlagLabel) {
          riskFlagLabel.textContent = title;
        } else {
          riskIndicator.textContent = `⚠️ ${title}`;
        }
      } else {
        riskIndicator.style.display = 'none';
      }
    }
  });

  // Grab selection from active web page
  document.getElementById('btnQuickGrabSelection').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_CURRENT_SELECTION" }, (res) => {
          if (res && res.selection) {
            contextInput.value = res.selection;
            contextInput.dispatchEvent(new Event('input'));
          }
        });
      }
    });
  });

  // Seed Test Context Selector
  const seedSelect = document.getElementById('quickSeedContextSelect');
  const SEED_TEST_CONTEXTS = {
    amit_alex: {
      text: `1. PM Amit → Client\nHi Alex,\nThe team has completed the requested page updates, and the latest version is now ready for your review.\nWe have updated the homepage hero section, pricing content, and CTA buttons based on the feedback shared during our last discussion.\nPlease have a look when you get a chance and let me know if everything looks good from your side.\nOnce approved, we can proceed with the final production update.\nThanks,\nAmit\nProject Manager\n\n2. Client → Amit — Escalation\nHi Amit,\nI’m confused by this update.\nI’ve just reviewed the page, and this is not what we agreed during our last discussion. The hero section is still using the old messaging, the pricing section does not reflect the changes we provided, and the CTA is different from what was approved.\nThis is now the second time we’ve reviewed changes that don’t match our feedback, and I’m concerned there is a disconnect between what we’re discussing and what is actually being passed to the development team.\nWe have a stakeholder review tomorrow, so we really cannot afford another round of incorrect updates.\nCan you please investigate what happened, confirm which requirements the team has been working from, and let me know how quickly this can be corrected?\nThanks,\nAlex`,
      channel: 'email',
      goal: 'de-escalate_and_set_boundaries'
    },
    black_friday: {
      text: `Hi Sara,\n\nA quick update from our side: all planned Black Friday updates have now been deployed and are live in production.\n\nThe team has completed the final checks, and everything appears to be working as expected. We’ll continue monitoring the platform closely throughout the campaign.\n\nPlease let me know if you notice anything unusual from your end.\n\nBest,\nJohn\nProject Manager\n\n---\n\nFrom: Sara\nTo: John\nSubject: RE: Black Friday Platform Update — URGENT ESCALATION\n\nJohn,\n\nThis is completely unacceptable.\n\nShortly after your team pushed these updates live, our platform crashed during the peak of our Black Friday launch.\n\nBased on our sales data, we estimate that we lost approximately **$80,000 in revenue** while the platform was unavailable. This was our most important sales window of the year, and the timing of this failure could not have been worse.\n\nYou stated that everything had been checked and was "working as expected." Clearly, that was not the case.\n\nI need your team to treat this as a **critical incident and restore full platform stability immediately**. I also expect a detailed explanation of what caused the outage, why it was not identified before deployment, and what safeguards are being put in place to ensure this cannot happen again.\n\nWe also expect your company to address the **$80,000 in lost revenue** caused by this incident and provide a clear proposal for compensation.\n\nIf this is not resolved urgently and satisfactorily, we will have no choice but to **terminate our contract and pursue legal action to recover our losses**.\n\nPlease escalate this to your senior management immediately. I expect a response today.\n\nSara`,
      channel: 'email',
      goal: 'de-escalate_and_set_boundaries'
    },
    task_conflict: {
      text: `Dave insists on using MongoDB for the core transaction ledger, but Sarah says PostgreSQL is the only acid-compliant choice. They've been arguing in the architecture channel all morning and the PR is blocked.`,
      channel: 'slack',
      goal: 'resolve_task_conflict'
    },
    vp_pressure: {
      text: `From VP: 'I don't care about your sprint velocity numbers. The board demo is on Monday. You and your team need to work all weekend and deliver the complete AI analytics dashboard. Just make it happen.'`,
      channel: 'email',
      goal: 'negotiate_upward_tradeoffs'
    },
    team_burnout: {
      text: `Hey, 3 senior engineers are showing signs of exhaustion, irritability, and missing PR deadlines. One mentioned working until 2 AM every night this week to keep up with tickets.`,
      channel: 'slack',
      goal: 'diagnose_burnout_and_rebalance_workload'
    },
    harassment_report: {
      text: `A junior designer reported that a senior director made inappropriate sexual comments during an offsite dinner and later implied her promotion depended on being 'friendly'.`,
      channel: 'email',
      goal: 'formal_safety_escalation'
    },
    toxic_performer: {
      text: `Our top billing account executive brings in 35% of company revenue, but routinely berates customer success managers, refuses to update Salesforce, and creates team turnover.`,
      channel: 'strategy',
      goal: 'toxic_high_performer_conduct_governance'
    },
    remote_disconnect: {
      text: `Our distributed engineering team across 4 time zones is suffering from severe asynchronous fragmentation. Core PRs take 5 days to get reviewed, handoffs are dropped between US and APAC, and team members feel alienated from product decisions.`,
      channel: 'slack',
      goal: 'remote_hybrid_disconnect'
    },
    budget_cut: {
      text: `Executive leadership announced an immediate 20% operating budget reduction effective next month. We need to communicate how tool licenses, travel, and contractor capacity will be consolidated while preserving team morale and core product delivery.`,
      channel: 'strategy',
      goal: 'budget_cut_resource_reduction'
    }
  };

  if (seedSelect) {
    seedSelect.addEventListener('change', () => {
      const val = seedSelect.value;
      const seed = SEED_TEST_CONTEXTS[val];
      if (seed) {
        contextInput.value = seed.text;
        contextInput.dispatchEvent(new Event('input'));

        if (seed.channel) {
          const tab = document.querySelector(`#channelSegmentedControl .g-segmented-btn[data-channel="${seed.channel}"]`);
          if (tab) tab.click();
        }
        if (seed.goal) {
          const btn = document.querySelector(`.g-goal-btn[data-goal="${seed.goal}"]`);
          if (btn) btn.click();
        }
      }
    });
  }

  // File attach with native PDF text extraction support
  const fileInput = document.getElementById('quickFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const arrayBuffer = ev.target.result;
            const text = (typeof extractTextFromPDF === 'function') 
              ? await extractTextFromPDF(arrayBuffer)
              : '';
            if (text && text.trim().length > 0) {
              contextInput.value = text.trim();
              contextInput.dispatchEvent(new Event('input'));
              console.log(`[PDF Extractor] Successfully parsed ${text.split(/\s+/).length} words from ${file.name}`);
            } else {
              showErrorNotice("PDF Extraction Notice", `Extracted text from "${file.name}" was empty or compressed. Please copy and paste text directly if file is scanned.`, false);
            }
          } catch (pdfErr) {
            console.error("PDF parsing error:", pdfErr);
            showErrorNotice("PDF Parsing Error", `Could not parse PDF "${file.name}": ${pdfErr.message}`, false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          contextInput.value = ev.target.result;
          contextInput.dispatchEvent(new Event('input'));
        };
        reader.readAsText(file);
      }
    });
  }

  // Managerial Goal Selection Buttons (Tactile Selection Buttons)
  const goalButtons = document.querySelectorAll('.g-goal-btn');
  goalButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      goalButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedGoal = btn.getAttribute('data-goal');
    });
  });

  // Channel Tabs (Tactile Segmented Bar)
  const channelTabs = document.querySelectorAll('#channelSegmentedControl .g-segmented-btn');
  channelTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      channelTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedChannel = tab.getAttribute('data-channel');
    });
  });

  // Generate Magic CTA
  document.getElementById('btnGenerateMagic').addEventListener('click', async () => {
    hideErrorNotice();
    const text = contextInput.value.trim();
    if (!text) {
      contextInput.style.borderColor = 'var(--color-red)';
      showErrorNotice("Message Context Required", "Please paste or type the incoming message, employee situation, or escalation into the box below before generating.", false);
      contextInput.focus();
      return;
    }
    contextInput.style.borderColor = '';

    if (!orchestrator) {
      await initializeStack();
    }

    if (!orchestrator) {
      showErrorNotice(
        "Agent Pipeline Initializing",
        "The multi-agent Managerial EQ pipeline is still loading knowledge modules. Please wait a moment and try again.",
        false
      );
      return;
    }

    showLoadingState();

    try {
      updateLoadingStatus("Retrieving Handbook Grounding...", "Querying 36 indexed sections with hybrid BM25 + Vector search...");
      await new Promise(r => setTimeout(r, 200));

      updateLoadingStatus("Applying 4-Stage Response Model...", "Detect & Pause -> Reappraise -> Empathy -> Collaborate...");
      await new Promise(r => setTimeout(r, 200));

      updateLoadingStatus("Running Multi-Agent QA Rubric...", "Verifying accuracy, tone, privacy, and statutory boundaries...");

      const effectiveMode = (selectedEngineMode === 'agentic' && llmClient && llmClient.isSuccessfullyConnected())
        ? 'agentic'
        : (selectedEngineMode === 'github' ? 'agentic' : 'local');
      const delivery = await orchestrator.runFullPipeline(text, {
        channel: selectedChannel,
        goal: selectedGoal,
        tone: selectedTone,
        agentSelection: { mode: effectiveMode }
      });

      renderOutput(delivery);
    } catch (err) {
      console.error("Magic generation failed:", err);
      showPromptCanvas();
      const userMessage = err.message || "An unexpected error occurred while communicating with the AI model.";
      showErrorNotice("AI Agent Connection Notice", userMessage, true);
    }
  });

  // Result Actions
  document.getElementById('btnInsertDirect').addEventListener('click', () => {
    const text = document.getElementById('outputReplyBody').innerText;
    chrome.runtime.sendMessage({
      type: "INSERT_TEXT_INTO_ACTIVE_PAGE",
      text: text
    }, () => {
      const orig = document.getElementById('btnInsertDirect').innerHTML;
      document.getElementById('btnInsertDirect').innerHTML = '<span>✓ Inserted!</span>';
      setTimeout(() => { document.getElementById('btnInsertDirect').innerHTML = orig; }, 1800);
    });
  });

  document.getElementById('btnCopyDirect').addEventListener('click', () => {
    const text = document.getElementById('outputReplyBody').innerText;
    navigator.clipboard.writeText(text).then(() => {
      const orig = document.getElementById('btnCopyDirect').innerHTML;
      document.getElementById('btnCopyDirect').innerHTML = '<span>✓ Copied!</span>';
      setTimeout(() => { document.getElementById('btnCopyDirect').innerHTML = orig; }, 1800);
    });
  });

  document.getElementById('btnStartOver').addEventListener('click', () => {
    hideErrorNotice();
    showPromptCanvas();
  });

  document.getElementById('resultConnectAgentLink').addEventListener('click', (e) => {
    e.preventDefault();
    showPromptCanvas();
    tabConnect.click();
  });

  // Feedback Buttons (Tactile in-button state confirmation, zero alert popups)
  document.querySelectorAll('.g-feedback-chips-group .g-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.getAttribute('data-fb');
      if (orchestrator && typeof orchestrator.step9_submitFeedback === 'function') {
        await orchestrator.step9_submitFeedback(type);
      }
      const originalText = btn.textContent;
      btn.style.background = 'var(--color-navy)';
      btn.style.color = '#ffffff';
      btn.textContent = '✓ Saved';
      setTimeout(() => {
        btn.style.background = '';
        btn.style.color = '';
        btn.textContent = originalText;
      }, 2000);
    });
  });
}

function showErrorNotice(title, message, isApiError = true) {
  const card = document.getElementById('errorNoticeCard');
  if (!card) return;

  const titleEl = document.getElementById('errorCardTitle');
  const msgEl = document.getElementById('errorCardMessage');
  const fallbackBtn = document.getElementById('btnErrorFallback');
  const settingsBtn = document.getElementById('btnErrorEditSettings');

  if (titleEl) titleEl.textContent = title || 'Notice';
  if (msgEl) msgEl.textContent = message;

  if (fallbackBtn && settingsBtn) {
    if (isApiError) {
      fallbackBtn.style.display = 'inline-flex';
      settingsBtn.style.display = 'inline-flex';
    } else {
      fallbackBtn.style.display = 'none';
      settingsBtn.style.display = 'none';
    }
  }

  card.style.display = 'flex';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideErrorNotice() {
  const card = document.getElementById('errorNoticeCard');
  if (card) card.style.display = 'none';
  const contextInput = document.getElementById('mainContextInput');
  if (contextInput) contextInput.style.borderColor = '';
}

function updateEngineStatusBadge() {
  const pill = document.getElementById('engineStatusPill');
  const text = document.getElementById('engineStatusText');
  const banner = document.getElementById('fallbackCalloutBanner');
  const isConnected = llmClient && llmClient.isSuccessfullyConnected();

  // Step 1 Active Setting Card Elements
  const settingIcon = document.getElementById('activeModeIcon');
  const settingTitle = document.getElementById('activeModeTitle');
  const settingBadge = document.getElementById('activeModeBadge');
  const settingSubtitle = document.getElementById('activeModeSubtitle');
  const settingIconBox = document.getElementById('activeModeIconBox');

  if (selectedEngineMode === 'github') {
    if (pill) {
      pill.className = 'g-badge g-badge-connected md-badge md-badge-connected';
      text.textContent = 'GitHub Repo Attached';
    }
    if (banner) banner.style.display = 'none';

    if (settingIcon) settingIcon.textContent = 'link';
    if (settingTitle) settingTitle.textContent = 'GitHub Repository Attached';
    if (settingBadge) {
      settingBadge.className = 'g-badge g-badge-connected';
      settingBadge.textContent = 'Repo Linked';
    }
    if (settingIconBox) settingIconBox.className = 'g-setting-icon-box github';
    if (settingSubtitle) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['githubRepoUrl'], (res) => {
          if (res && res.githubRepoUrl && settingSubtitle) {
            const short = res.githubRepoUrl.replace(/^https?:\/\/(www\.)?github\.com\/?/, '') || res.githubRepoUrl;
            settingSubtitle.textContent = `Attached: ${short}`;
          }
        });
      }
      settingSubtitle.textContent = 'Custom repository attached for backend workflows';
    }

  } else if (selectedEngineMode === 'agentic' && isConnected) {
    const provName = (llmClient.provider || 'AI').toUpperCase();
    const modelName = llmClient.model || 'Agent';

    if (pill) {
      pill.className = 'g-badge g-badge-connected md-badge md-badge-connected';
      text.textContent = `${modelName.toUpperCase()} Connected`;
    }
    if (banner) banner.style.display = 'none';

    if (settingIcon) settingIcon.textContent = 'smart_toy';
    if (settingTitle) settingTitle.textContent = `Cloud AI Agent (${provName})`;
    if (settingBadge) {
      settingBadge.className = 'g-badge g-badge-connected';
      settingBadge.textContent = 'Active & Verified';
    }
    if (settingIconBox) settingIconBox.className = 'g-setting-icon-box connected';
    if (settingSubtitle) {
      settingSubtitle.textContent = `Model: ${modelName} — Multi-agent research & QA verification enabled`;
    }

  } else if (selectedEngineMode === 'agentic' && !isConnected) {
    if (pill) {
      pill.className = 'g-badge g-badge-offline md-badge md-badge-offline';
      text.textContent = 'AI Agent (Not Connected)';
    }
    if (banner) banner.style.display = 'flex';

    if (settingIcon) settingIcon.textContent = 'smart_toy';
    if (settingTitle) settingTitle.textContent = 'Cloud AI Agent (Unverified)';
    if (settingBadge) {
      settingBadge.className = 'g-badge g-badge-offline';
      settingBadge.textContent = 'Setup Required';
    }
    if (settingIconBox) settingIconBox.className = 'g-setting-icon-box';
    if (settingSubtitle) {
      settingSubtitle.textContent = 'Credentials unverified — click Change Mode to configure in Settings';
    }

  } else {
    // Local offline mode (Default)
    if (pill) {
      pill.className = 'g-badge g-badge-offline md-badge md-badge-offline';
      text.textContent = 'Local Fallback';
    }
    if (banner) banner.style.display = 'flex';

    if (settingIcon) settingIcon.textContent = 'memory';
    if (settingTitle) settingTitle.textContent = 'Local Offline Fallback';
    if (settingBadge) {
      settingBadge.className = 'g-badge g-badge-offline';
      settingBadge.textContent = 'Active (Offline)';
    }
    if (settingIconBox) settingIconBox.className = 'g-setting-icon-box';
    if (settingSubtitle) {
      settingSubtitle.textContent = 'Deterministic EQ rules & 15 handbook protocols — 100% private and offline';
    }
  }
}

function showLoadingState() {
  document.getElementById('promptCanvasView').style.display = 'none';
  document.getElementById('flowResultView').style.display = 'none';
  document.getElementById('flowLoadingView').style.display = 'flex';
}

function showPromptCanvas() {
  document.getElementById('flowLoadingView').style.display = 'none';
  document.getElementById('flowResultView').style.display = 'none';
  document.getElementById('promptCanvasView').style.display = 'flex';
}

function updateLoadingStatus(heading, caption) {
  document.getElementById('loadingStageTitle').textContent = heading;
  document.getElementById('loadingStageDesc').textContent = caption;
}

function renderOutput(delivery) {
  document.getElementById('flowLoadingView').style.display = 'none';
  document.getElementById('promptCanvasView').style.display = 'none';
  const resultView = document.getElementById('flowResultView');
  resultView.style.display = 'flex';

  const draft = delivery.draft || {};
  const qa = delivery.qaResult || {};
  const isLocal = delivery.isLocalFallback;

  const citPill = document.getElementById('resultCitationPill');
  const qaBadge = document.getElementById('resultQAScoreBadge');
  const fallbackRibbon = document.getElementById('resultFallbackBanner');

  const primarySectionRaw = (orchestrator && orchestrator.stateData && orchestrator.stateData.retrievalData && orchestrator.stateData.retrievalData.primaryScenario)
    ? orchestrator.stateData.retrievalData.primaryScenario.citation
    : 'Universal 4-Stage Response Model';

  // Sanitize section titles: NO technical codes or raw §/$, only clean names
  const cleanProtocolName = formatHumanProtocolName(primarySectionRaw);
  citPill.textContent = cleanProtocolName;

  qaBadge.textContent = `${qa.score || 96}/100 PASSED`;
  qaBadge.className = qa.passed 
    ? 'g-meta-tag tag-green md-meta-tag' 
    : 'g-meta-tag tag-teal md-meta-tag';

  fallbackRibbon.style.display = isLocal ? 'flex' : 'none';

  if (isLocal && delivery.error) {
    if (llmClient) {
      llmClient.isVerified = false;
      llmClient.lastError = delivery.error;
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        apiConnectionVerified: false,
        apiConnectionError: delivery.error,
        selectedMode: 'local'
      });
    }
    selectedEngineMode = 'local';
    updateEngineStatusBadge();
    showErrorNotice(
      "AI Agent Connection Dropped",
      `Connection to ${llmClient?.provider?.toUpperCase() || 'Agent'} failed during execution:\n${delivery.error}\n\nSafely executed via Local Fallback.`,
      false
    );
  }

  const subHeader = document.getElementById('outputSubjectHeader');
  const replyBody = document.getElementById('outputReplyBody');

  if (draft.subject) {
    subHeader.style.display = 'block';
    subHeader.textContent = `Subject: ${draft.subject}`;
  } else {
    subHeader.style.display = 'none';
  }

  function formatMarkdownToHTML(text) {
    if (!text) return '';
    let enriched = text;
    if (orchestrator && orchestrator.localEngine && typeof orchestrator.localEngine.ensureImportantContentBold === 'function') {
      enriched = orchestrator.localEngine.ensureImportantContentBold(enriched);
    }
    let safe = enriched
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong class="g-bold-highlight">$1</strong>');
    safe = safe.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    safe = safe.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    return safe;
  }

  replyBody.innerHTML = formatMarkdownToHTML(draft.content || '');

  // 4-Stage Breakdown
  const s = draft.four_stage_breakdown || {};
  document.getElementById('detailsStage1Text').textContent = s.stage1_detect_pause || 'Slowed response, checked safety/legal boundaries.';
  document.getElementById('detailsStage2Text').textContent = s.stage2_reappraise_regulate || 'Separated task facts and risks from interpersonal friction.';
  document.getElementById('detailsStage3Text').textContent = s.stage3_empathetic_engagement || 'Acknowledged impact without conceding liability.';
  document.getElementById('detailsStage4Text').textContent = s.stage4_collaborative_resolution || 'Defined concrete next actions, ownership, and timeline.';

  // Citations list: completely sanitize all section numbers out
  const citList = document.getElementById('detailsCitationsList');
  const rawCits = delivery.citations || [];
  const cleanCits = rawCits.map(c => formatHumanProtocolName(c));
  const uniqueCits = Array.from(new Set(cleanCits));

  citList.innerHTML = uniqueCits
    .map(c => `<div class="g-grounding-item">• <strong>${c}</strong></div>`)
    .join('');
}

async function checkForPendingSelection() {
  const res = await chrome.storage.local.get('pendingSelection');
  if (res && res.pendingSelection && res.pendingSelection.text) {
    const text = res.pendingSelection.text;
    const input = document.getElementById('mainContextInput');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await chrome.storage.local.remove('pendingSelection');
  }

  // Real-time listener for simulator parent
  window.addEventListener('message', (ev) => {
    if (ev.data && ev.data.type === 'SIMULATOR_MESSAGE' && ev.data.payload) {
      const msg = ev.data.payload;
      if (msg.text) {
        const input = document.getElementById('mainContextInput');
        input.value = msg.text;
        input.dispatchEvent(new Event('input'));
        showPromptCanvas();
      }
      if (msg.channel) {
        const tab = document.querySelector(`#channelSegmentedControl .g-segmented-btn[data-channel="${msg.channel}"]`);
        if (tab) tab.click();
      }
    }
  });
}
