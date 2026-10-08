/**
 * Options Controller
 * Handles agent provider configuration, GitHub repository OAuth, connection tests, and QA governance sliders.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const providerSelect = document.getElementById('providerSelect');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const modelInput = document.getElementById('modelInput');
  const customEndpointInput = document.getElementById('customEndpointInput');
  const apiKeyRow = document.getElementById('apiKeyRow');
  const toggleKeyBtn = document.getElementById('toggleKeyVisibility');
  const testConnBtn = document.getElementById('btnTestConnection');
  const testConnStatus = document.getElementById('testConnectionStatus');

  // GitHub Repo Field
  const githubRepoInput = document.getElementById('githubRepoInput');
  const testGithubBtn = document.getElementById('btnTestGithub');
  const githubStatusMsg = document.getElementById('githubStatusMsg');

  // Sliders
  const thresholdSlider = document.getElementById('qaThresholdSlider');
  const thresholdValLabel = document.getElementById('thresholdValLabel');
  const maxRevisionsSlider = document.getElementById('maxRevisionsSlider');
  const maxRevisionsLabel = document.getElementById('maxRevisionsLabel');
  const saveBtn = document.getElementById('btnSaveSettings');
  const saveStatus = document.getElementById('saveStatusMsg');

  // Mode Selection Radios & Cards
  const radioLocal = document.getElementById('modeRadioLocal');
  const radioAgentic = document.getElementById('modeRadioAgentic');
  const radioGithub = document.getElementById('modeRadioGithub');
  const cardModeLocal = document.getElementById('cardModeLocal');
  const cardModeAgentic = document.getElementById('cardModeAgentic');
  const cardModeGithub = document.getElementById('cardModeGithub');

  function updateModeSelectionUI(mode) {
    if (radioLocal) radioLocal.checked = (mode === 'local');
    if (radioAgentic) radioAgentic.checked = (mode === 'agentic');
    if (radioGithub) radioGithub.checked = (mode === 'github');

    if (cardModeLocal) cardModeLocal.classList.toggle('active', mode === 'local');
    if (cardModeAgentic) cardModeAgentic.classList.toggle('active', mode === 'agentic');
    if (cardModeGithub) cardModeGithub.classList.toggle('active', mode === 'github');
  }

  [radioLocal, radioAgentic, radioGithub].forEach(radio => {
    if (radio) {
      radio.addEventListener('change', () => {
        const chosen = document.querySelector('input[name="executionMode"]:checked')?.value || 'local';
        updateModeSelectionUI(chosen);
      });
    }
  });

  // Load existing settings
  let settings = {};
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      settings = await chrome.storage.local.get([
        'selectedMode', 'provider', 'apiKey', 'model', 'customEndpoint', 'qaThreshold', 'maxRevisions',
        'githubRepoUrl', 'apiConnectionVerified'
      ]) || {};
    } catch (e) {
      console.warn("[Options] Storage get warning:", e);
    }
  }

  const initialMode = settings.selectedMode || 'local';
  updateModeSelectionUI(initialMode);

  if (settings.provider) providerSelect.value = settings.provider;
  if (settings.apiKey) apiKeyInput.value = settings.apiKey;
  if (settings.model) modelInput.value = settings.model;
  if (settings.customEndpoint) customEndpointInput.value = settings.customEndpoint;
  if (settings.githubRepoUrl) githubRepoInput.value = settings.githubRepoUrl;

  if (settings.qaThreshold) {
    thresholdSlider.value = settings.qaThreshold;
    thresholdValLabel.textContent = `${settings.qaThreshold} / 100`;
  }
  if (settings.maxRevisions !== undefined) {
    maxRevisionsSlider.value = settings.maxRevisions;
    maxRevisionsLabel.textContent = `${settings.maxRevisions} Revisions`;
  }

  providerSelect.addEventListener('change', () => {
    const provChoice = providerSelect.value;
    switch (provChoice) {
      case 'gemini':
      case 'gemini_15_flash':
      case 'gemini_15_pro':
        modelInput.value = 'gemini-flash-latest';
        customEndpointInput.value = 'https://generativelanguage.googleapis.com/v1beta';
        break;
      case 'openai':
      case 'openai_gpt4o':
      case 'openai_gpt4o_mini':
      case 'openai_o1':
      case 'openai_o1_mini':
      case 'openai_o3_mini':
        modelInput.value = 'gpt-4o-mini';
        customEndpointInput.value = 'https://api.openai.com/v1';
        break;
      case 'anthropic':
      case 'anthropic_sonnet':
      case 'anthropic_haiku':
        modelInput.value = 'claude-3-5-sonnet-20241022';
        customEndpointInput.value = 'https://api.anthropic.com/v1';
        break;
      case 'mistral':
      case 'mistral_large':
      case 'mistral_small':
      case 'mistral_codestral':
      case 'mistral_nemo':
        modelInput.value = 'mistral-large-latest';
        customEndpointInput.value = 'https://api.mistral.ai/v1/chat/completions';
        break;
      case 'ollama':
        modelInput.value = 'llama3.2';
        customEndpointInput.value = 'http://localhost:11434';
        break;
      default:
        modelInput.value = 'gemini-flash-latest';
        customEndpointInput.value = 'https://generativelanguage.googleapis.com/v1beta';
        break;
    }
  });

  // Toggle Password
  toggleKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyBtn.textContent = 'Hide';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyBtn.textContent = 'Show';
    }
  });

  // Slider updates
  thresholdSlider.addEventListener('input', () => {
    thresholdValLabel.textContent = `${thresholdSlider.value} / 100`;
  });

  maxRevisionsSlider.addEventListener('input', () => {
    maxRevisionsLabel.textContent = `${maxRevisionsSlider.value} Revisions`;
  });

  // Back to Sidepanel Navigation
  const backBtn = document.getElementById('btnBackToSidepanel');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '../sidepanel/sidepanel.html';
      }
    });
  }

  // Invalidate verified status if credentials are typed or changed
  function markOptionsModified() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ apiConnectionVerified: false });
    }
  }
  apiKeyInput.addEventListener('input', markOptionsModified);
  modelInput.addEventListener('input', markOptionsModified);
  customEndpointInput.addEventListener('input', markOptionsModified);
  providerSelect.addEventListener('change', markOptionsModified);

  // Test AI Model Connection
  testConnBtn.addEventListener('click', async () => {
    testConnStatus.textContent = 'Testing connection...';
    testConnStatus.style.color = 'var(--text-secondary)';

    let prov = 'gemini';
    const sel = providerSelect.value;
    if (sel.startsWith('gemini')) prov = 'gemini';
    else if (sel.startsWith('openai')) prov = 'openai';
    else if (sel.startsWith('anthropic')) prov = 'anthropic';
    else if (sel.startsWith('mistral')) prov = 'mistral';
    else if (sel === 'ollama') prov = 'ollama';

    const defaultModel = prov === 'gemini' ? 'gemini-flash-latest' : (prov === 'openai' ? 'gpt-4o-mini' : (prov === 'anthropic' ? 'claude-3-5-sonnet-20241022' : (prov === 'mistral' ? 'mistral-large-latest' : 'llama3.2')));
    const defaultEndpoint = prov === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : (prov === 'openai' ? 'https://api.openai.com/v1' : (prov === 'anthropic' ? 'https://api.anthropic.com/v1' : (prov === 'mistral' ? 'https://api.mistral.ai/v1/chat/completions' : 'http://localhost:11434')));

    const testClient = new LLMClient({
      provider: prov,
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim() || defaultModel,
      customEndpoint: customEndpointInput.value.trim() || defaultEndpoint
    });

    const res = await testClient.testConnection();
    if (res.success) {
      testConnStatus.textContent = `✓ Connection successful: ${res.message}`;
      testConnStatus.style.color = 'var(--color-green)';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          apiConnectionVerified: true,
          apiConnectionDetails: {
            provider: prov,
            model: modelInput.value.trim(),
            latencyMs: res.latencyMs,
            verifiedAt: Date.now()
          },
          apiConnectionError: null
        });
      }
    } else {
      testConnStatus.textContent = `✗ Connection failed: ${res.error}`;
      testConnStatus.style.color = 'var(--color-red)';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          apiConnectionVerified: false,
          apiConnectionError: res.error
        });
      }
    }
  });

  // Attach & Save GitHub Repo Link
  testGithubBtn.addEventListener('click', async () => {
    const repo = githubRepoInput.value.trim();

    if (!repo) {
      githubStatusMsg.textContent = 'Please enter a valid GitHub repository link.';
      githubStatusMsg.style.color = 'var(--color-red)';
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ 
        githubRepoUrl: repo,
        selectedMode: 'github'
      });
    }
    updateModeSelectionUI('github');
    const short = repo.replace(/^https?:\/\/(www\.)?github\.com\/?/, '') || repo;
    githubStatusMsg.textContent = `✓ Repository link attached & mode activated: ${short}`;
    githubStatusMsg.style.color = 'var(--color-green)';
  });

  // Save Settings (Rigorously verifies credentials and respects selected mode)
  saveBtn.addEventListener('click', async () => {
    const chosenMode = document.querySelector('input[name="executionMode"]:checked')?.value || 'local';

    let prov = 'gemini';
    const sel = providerSelect.value;
    if (sel.startsWith('gemini')) prov = 'gemini';
    else if (sel.startsWith('openai')) prov = 'openai';
    else if (sel.startsWith('anthropic')) prov = 'anthropic';
    else if (sel.startsWith('mistral')) prov = 'mistral';
    else if (sel === 'ollama') prov = 'ollama';

    const defaultModel = prov === 'gemini' ? 'gemini-flash-latest' : (prov === 'openai' ? 'gpt-4o-mini' : (prov === 'anthropic' ? 'claude-3-5-sonnet-20241022' : (prov === 'mistral' ? 'mistral-large-latest' : 'llama3.2')));
    const defaultEndpoint = prov === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : (prov === 'openai' ? 'https://api.openai.com/v1' : (prov === 'anthropic' ? 'https://api.anthropic.com/v1' : (prov === 'mistral' ? 'https://api.mistral.ai/v1/chat/completions' : 'http://localhost:11434')));

    const enteredKey = apiKeyInput.value.trim();
    const model = modelInput.value.trim() || defaultModel;
    const endpoint = customEndpointInput.value.trim() || defaultEndpoint;
    const repoUrl = githubRepoInput.value.trim();
    const threshold = parseInt(thresholdSlider.value, 10);
    const revisions = parseInt(maxRevisionsSlider.value, 10);

    // Scenario 1: User explicitly chose Attach GitHub Repo
    if (chosenMode === 'github') {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          provider: prov,
          apiKey: enteredKey,
          model: model,
          customEndpoint: endpoint,
          githubRepoUrl: repoUrl,
          qaThreshold: threshold,
          maxRevisions: revisions,
          selectedMode: 'github'
        });
      }
      saveStatus.textContent = '✓ Settings saved: Active Mode set to GitHub Attached Repo.';
      saveStatus.style.color = 'var(--color-green)';
      setTimeout(() => { saveStatus.textContent = ''; }, 4000);
      return;
    }

    // Scenario 2: User explicitly chose Cloud AI Agent
    if (chosenMode === 'agentic') {
      if (!enteredKey && prov !== 'ollama') {
        saveStatus.textContent = `Please enter an API key for ${prov.toUpperCase()} to activate Cloud AI Agent mode. Reverting to Local Fallback.`;
        saveStatus.style.color = 'var(--color-red)';
        updateModeSelectionUI('local');
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({
            provider: prov,
            apiKey: '',
            model: model,
            customEndpoint: endpoint,
            githubRepoUrl: repoUrl,
            qaThreshold: threshold,
            maxRevisions: revisions,
            selectedMode: 'local',
            apiConnectionVerified: false
          });
        }
        return;
      }

      saveStatus.textContent = 'Validating connection with AI provider...';
      saveStatus.style.color = 'var(--text-secondary)';

      const testClient = new LLMClient({
        provider: prov,
        apiKey: enteredKey,
        model: model,
        customEndpoint: endpoint
      });
      const check = await testClient.testConnection();

      if (!check.success) {
        saveStatus.textContent = `✗ Connection failed: ${check.error}. Active mode set to Local Fallback.`;
        saveStatus.style.color = 'var(--color-red)';
        updateModeSelectionUI('local');
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({
            provider: prov,
            apiKey: enteredKey,
            model: model,
            customEndpoint: endpoint,
            githubRepoUrl: repoUrl,
            qaThreshold: threshold,
            maxRevisions: revisions,
            selectedMode: 'local',
            apiConnectionVerified: false,
            apiConnectionError: check.error
          });
        }
        return;
      }

      // Verified connection
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          provider: prov,
          apiKey: enteredKey,
          model: model,
          customEndpoint: endpoint,
          githubRepoUrl: repoUrl,
          qaThreshold: threshold,
          maxRevisions: revisions,
          selectedMode: 'agentic',
          apiConnectionVerified: true,
          apiConnectionDetails: {
            provider: prov,
            model: model,
            latencyMs: check.latencyMs,
            verifiedAt: Date.now()
          },
          apiConnectionError: null
        });
      }
      saveStatus.textContent = `✓ Connection verified! Active Mode set to Cloud AI Agent (${prov.toUpperCase()} - ${model}).`;
      saveStatus.style.color = 'var(--color-green)';
      setTimeout(() => { saveStatus.textContent = ''; }, 4000);
      return;
    }

    // Scenario 3: User explicitly chose Local Offline (Default)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        provider: prov,
        apiKey: enteredKey,
        model: model,
        customEndpoint: endpoint,
        githubRepoUrl: repoUrl,
        qaThreshold: threshold,
        maxRevisions: revisions,
        selectedMode: 'local'
      });
    }
    updateModeSelectionUI('local');
    saveStatus.textContent = '✓ Settings saved: Active Mode set to Local Offline Engine.';
    saveStatus.style.color = 'var(--color-green)';
    setTimeout(() => { saveStatus.textContent = ''; }, 4000);
  });
});
