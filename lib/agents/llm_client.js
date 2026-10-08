/**
 * Unified LLM & Agent Client
 * Connects to OpenAI, Mistral AI, Anthropic Claude, Google Gemini, Local Ollama, or Custom Webhook.
 * Handles secure API key verification, connection testing, and seamless localhost proxy fallback.
 */

class LLMClient {
  constructor(config = {}) {
    this.provider = config.provider || 'openai'; // 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'mistral' | 'custom'
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4o-mini';
    this.customEndpoint = config.customEndpoint || '';
    this.isVerified = Boolean(config.isVerified);
    this.lastVerifiedAt = config.lastVerifiedAt || null;
    this.lastError = config.lastError || null;
  }

  setConfig(config = {}) {
    const prevKey = this.apiKey;
    const prevProvider = this.provider;
    const prevModel = this.model;
    const prevEndpoint = this.customEndpoint;

    if (config.provider) this.provider = config.provider;
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.model) this.model = config.model;
    if (config.customEndpoint !== undefined) this.customEndpoint = config.customEndpoint;

    if (config.isVerified !== undefined) {
      this.isVerified = Boolean(config.isVerified);
    } else if (prevKey !== this.apiKey || prevProvider !== this.provider || prevModel !== this.model || prevEndpoint !== this.customEndpoint) {
      this.isVerified = false;
    }

    if (config.lastVerifiedAt !== undefined) this.lastVerifiedAt = config.lastVerifiedAt;
    if (config.lastError !== undefined) this.lastError = config.lastError;
  }

  hasActiveKey() {
    if (this.provider === 'ollama') return true; // Ollama runs locally without key
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  isSuccessfullyConnected() {
    return Boolean(this.isVerified && this.hasActiveKey());
  }

  /**
   * Smart fetch wrapper: tries direct fetch first (standard for Chrome extensions with host permissions),
   * and automatically falls back to the localhost proxy on port 3000 if browser CORS blocks a direct web request.
   */
  async safeFetch(url, options = {}) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (directErr) {
      // In standalone web mode on http://localhost:3000, browser CORS may block cross-origin LLM endpoints.
      // Automatically fall back to our local proxy endpoint.
      const isLocalServer = typeof window !== 'undefined' && 
                            window.location && 
                            (window.location.port === '3000' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      
      if (isLocalServer) {
        try {
          const proxyRes = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url,
              method: options.method || 'POST',
              headers: options.headers || {},
              body: options.body
            })
          });
          return proxyRes;
        } catch (proxyErr) {
          throw new Error(`Direct connection and local proxy both failed: ${directErr.message}`);
        }
      }
      throw directErr;
    }
  }

  /**
   * Real, rigorous connection test that pings the provider with actual credentials.
   * Never reports success for invalid, placeholder, or rejected keys.
   */
  async testConnection() {
    if (!this.hasActiveKey()) {
      this.isVerified = false;
      this.lastError = `No API key provided for ${this.provider.toUpperCase()}. Please enter your secret API key or continue on Local Fallback.`;
      return { 
        success: false, 
        error: this.lastError
      };
    }

    const startTime = Date.now();
    try {
      let sample = "";
      if (this.provider === 'ollama') {
        const baseUrl = this.customEndpoint || 'http://localhost:11434';
        const res = await this.safeFetch(`${baseUrl}/api/tags`, { method: 'GET' });
        if (!res.ok) throw new Error(`Ollama daemon returned HTTP ${res.status}. Ensure Ollama is running on port 11434.`);
        sample = await this.callOllama({
          systemPrompt: "You are a test ping agent.",
          userPrompt: "Respond strictly with the single word: PONG",
          maxTokens: 5,
          temperature: 0.1
        });
      } else {
        sample = await this.complete({
          systemPrompt: "You are a test ping agent.",
          userPrompt: "Respond strictly with the single word: PONG",
          maxTokens: 5,
          temperature: 0.1
        });
      }

      const latencyMs = Date.now() - startTime;
      this.isVerified = true;
      this.lastVerifiedAt = Date.now();
      this.lastError = null;

      return { 
        success: true, 
        latencyMs,
        provider: this.provider,
        model: this.model,
        message: `Verified and connected to ${this.provider.toUpperCase()} (${this.model}) in ${latencyMs}ms!`, 
        sample: (sample || '').trim() 
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      this.isVerified = false;
      this.lastError = err.message || "Provider rejected the request.";

      return { 
        success: false, 
        latencyMs,
        provider: this.provider,
        model: this.model,
        error: this.lastError
      };
    }
  }

  async complete({ systemPrompt, userPrompt, temperature = 0.3, maxTokens = 1200 }) {
    if (!this.hasActiveKey()) {
      throw new Error(`Agent not connected for provider: ${this.provider}. Local fallback must be used.`);
    }

    switch (this.provider) {
      case 'openai':
        return await this.callOpenAI({ systemPrompt, userPrompt, temperature, maxTokens });
      case 'anthropic':
        return await this.callAnthropic({ systemPrompt, userPrompt, temperature, maxTokens });
      case 'gemini':
        return await this.callGemini({ systemPrompt, userPrompt, temperature, maxTokens });
      case 'mistral':
        return await this.callMistral({ systemPrompt, userPrompt, temperature, maxTokens });
      case 'ollama':
        return await this.callOllama({ systemPrompt, userPrompt, temperature, maxTokens });
      case 'custom':
        return await this.callCustom({ systemPrompt, userPrompt, temperature, maxTokens });
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  async callOpenAI({ systemPrompt, userPrompt, temperature, maxTokens }) {
    let endpoint = this.customEndpoint && this.customEndpoint.includes('http') 
      ? this.customEndpoint 
      : 'https://api.openai.com/v1/chat/completions';
    
    if (endpoint.endsWith('/v1') || endpoint.endsWith('/v1/')) {
      endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
    }

    const payload = {
      model: this.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    };

    const res = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err.error && err.error.message) || err.message || res.statusText;
      if (res.status === 401) {
        throw new Error(`OpenAI API key is invalid or unauthorized (HTTP 401): ${msg}`);
      } else if (res.status === 429) {
        throw new Error(`OpenAI rate limit or credit quota exceeded (HTTP 429): ${msg}`);
      } else if (res.status === 404) {
        throw new Error(`OpenAI model '${this.model}' or endpoint not found (HTTP 404): ${msg}`);
      }
      throw new Error(`OpenAI error (${res.status}): ${msg}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  async callAnthropic({ systemPrompt, userPrompt, temperature, maxTokens }) {
    const endpoint = 'https://api.anthropic.com/v1/messages';
    const payload = {
      model: this.model || 'claude-3-5-sonnet-20241022',
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    };

    const res = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err.error && err.error.message) || res.statusText;
      if (res.status === 401) {
        throw new Error(`Anthropic API key is invalid (HTTP 401): ${msg}`);
      }
      throw new Error(`Anthropic API error (${res.status}): ${msg}`);
    }

    const data = await res.json();
    return data.content[0].text;
  }

  async callGemini({ systemPrompt, userPrompt, temperature, maxTokens }) {
    let baseModel = this.model || 'gemini-flash-lite-latest';
    if (baseModel === 'gemini-1.5-flash' || baseModel === 'gemini-2.0-flash' || baseModel === 'gemini') {
      baseModel = 'gemini-flash-lite-latest';
    }

    const candidateModels = [
      baseModel,
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest'
    ];
    const modelsToTry = Array.from(new Set(candidateModels));
    let lastErr = null;

    for (const model of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      const payload = {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [{ text: userPrompt }]
        }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        }
      };

      try {
        const res = await this.safeFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            return data.candidates[0].content.parts[0].text;
          }
        }

        const err = await res.json().catch(() => ({}));
        const msg = (err.error && err.error.message) || res.statusText;
        if (res.status === 400 || res.status === 403 || res.status === 401) {
          throw new Error(`Gemini API key is invalid or rejected (HTTP ${res.status}): ${msg}`);
        }
        lastErr = new Error(`Gemini API error (${res.status}): ${msg}`);
      } catch (callErr) {
        if (callErr.message && (callErr.message.includes('400') || callErr.message.includes('401') || callErr.message.includes('403'))) {
          throw callErr;
        }
        lastErr = callErr;
      }
    }

    throw lastErr || new Error("Gemini API call failed across candidate models.");
  }

  async callMistral({ systemPrompt, userPrompt, temperature, maxTokens }) {
    let endpoint = this.customEndpoint && this.customEndpoint.includes('http') 
      ? this.customEndpoint 
      : 'https://api.mistral.ai/v1/chat/completions';

    if (endpoint.endsWith('/v1') || endpoint.endsWith('/v1/')) {
      endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
    }

    const payload = {
      model: this.model || 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    };

    const res = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.detail || (err.error && err.error.message) || err.message || res.statusText;
      if (res.status === 401) {
        throw new Error(`Mistral API key is invalid or unauthorized (HTTP 401): ${msg}`);
      } else if (res.status === 429) {
        throw new Error(`Mistral API rate limit reached or quota exhausted (HTTP 429): ${msg}`);
      }
      throw new Error(`Mistral API error (${res.status}): ${msg}`);
    }

    const data = await res.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    return data.content || JSON.stringify(data);
  }

  async callOllama({ systemPrompt, userPrompt, temperature, maxTokens }) {
    const baseUrl = this.customEndpoint || 'http://localhost:11434';
    const endpoint = `${baseUrl}/api/chat`;
    const payload = {
      model: this.model || 'llama3.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      options: {
        temperature
      }
    };

    const res = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Ollama connection error (${res.status}): Is Ollama running on localhost:11434?`);
    }

    const data = await res.json();
    return data.message.content;
  }

  async callCustom({ systemPrompt, userPrompt, temperature, maxTokens }) {
    if (!this.customEndpoint) {
      throw new Error("No custom endpoint configured. Please enter your API Base URL or select a preset.");
    }

    let endpoint = this.customEndpoint;
    let body;
    const isChatCompletions = endpoint.includes('/chat/completions') || 
                              endpoint.includes('api.mistral.ai') || 
                              endpoint.includes('api.openai.com') ||
                              endpoint.includes('/v1');

    if (isChatCompletions) {
      if (endpoint.endsWith('/v1') || endpoint.endsWith('/v1/')) {
        endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
      }
      body = JSON.stringify({
        model: this.model || 'custom-model',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens
      });
    } else {
      body = JSON.stringify({ systemPrompt, userPrompt, temperature, maxTokens });
    }

    const res = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
      },
      body
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.message || (err.error && err.error.message) || err.detail || res.statusText;
      throw new Error(`Custom endpoint error (${res.status}): ${msg}`);
    }

    const data = await res.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    return data.content || data.reply || data.text || JSON.stringify(data);
  }
}

if (typeof window !== 'undefined') {
  window.LLMClient = LLMClient;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LLMClient;
}
