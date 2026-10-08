/**
 * Orchestrator / Planner Agent & State Machine
 * Manages the 9-step reversible agentic workflow:
 * 1. Intent Capture
 * 2. Input Processing
 * 3. Agent Selection
 * 4. RAG Retrieval
 * 5. Independent Research
 * 6. Doer Draft
 * 7. QA Evaluation (with revision loop)
 * 8. Final Delivery
 * 9. Feedback & Telemetry
 */

const STEPS = {
  INTENT_CAPTURE: 1,
  INPUT_PROCESSING: 2,
  AGENT_SELECTION: 3,
  RAG_RETRIEVAL: 4,
  INDEPENDENT_RESEARCH: 5,
  DOER_DRAFT: 6,
  QA_EVALUATION: 7,
  FINAL_DELIVERY: 8,
  FEEDBACK: 9
};

const STEP_NAMES = {
  1: "Intent Capture",
  2: "Input Processing",
  3: "Agent Selection",
  4: "RAG Retrieval",
  5: "Independent Research",
  6: "Doer Draft",
  7: "QA Evaluation",
  8: "Final Delivery",
  9: "Feedback"
};

class AgentOrchestrator {
  constructor({
    ragEngine,
    contextCollector,
    retrievalAgent,
    researchAgent,
    doerAgent,
    benchmarkingAgent,
    llmClient,
    localEngine
  }) {
    this.name = "Orchestrator / Planner";
    this.ragEngine = ragEngine;
    this.contextCollector = contextCollector;
    this.retrievalAgent = retrievalAgent;
    this.researchAgent = researchAgent;
    this.doerAgent = doerAgent;
    this.benchmarkingAgent = benchmarkingAgent;
    this.llmClient = llmClient;
    this.localEngine = localEngine;

    this.currentStep = STEPS.INTENT_CAPTURE;
    this.stateData = {
      intent: { channel: 'email', goal: 'de-escalate_and_set_boundaries', tone: 'Empathetic & Firm' },
      inputContext: null,
      selectedAgent: {
        mode: 'auto', // 'auto' | 'agentic' | 'local'
        activeProvider: 'local',
        agentTeam: ['Doer', 'QA Suite', 'Retrieval', 'Research']
      },
      retrievalData: null,
      researchData: null,
      draftResult: null,
      qaResult: null,
      revisions: [],
      finalDelivery: null,
      userFeedback: null
    };

    this.stepHistory = [];
    this.isBannerDismissed = false;
    this.onStateChangeCallbacks = [];
  }

  onStateChange(fn) {
    this.onStateChangeCallbacks.push(fn);
  }

  notifyStateChange() {
    for (const fn of this.onStateChangeCallbacks) {
      try {
        fn(this.currentStep, this.stateData);
      } catch (e) {
        console.error("Error in onStateChange callback:", e);
      }
    }
  }

  getMode() {
    const hasAgentKey = this.llmClient && this.llmClient.hasActiveKey();
    if (this.stateData.selectedAgent.mode === 'local') return 'local';
    if (this.stateData.selectedAgent.mode === 'agentic' && hasAgentKey) return 'agentic';
    return hasAgentKey ? 'agentic' : 'local';
  }

  isLocalFallback() {
    return this.getMode() === 'local';
  }

  getInsistenceBanner() {
    if (this.isBannerDismissed) return null;
    if (this.isLocalFallback()) {
      return {
        message: "You're on local fallback. Connect an agent for better research, accuracy, and QA-verified replies.",
        primaryCTA: "Connect Agent",
        secondaryCTA: "Continue local"
      };
    }
    return null;
  }

  dismissBanner() {
    this.isBannerDismissed = true;
    this.notifyStateChange();
  }

  // Seamless Reversible Flow
  jumpToStep(stepNumber) {
    if (stepNumber >= 1 && stepNumber <= 9) {
      this.currentStep = stepNumber;
      this.notifyStateChange();
      return true;
    }
    return false;
  }

  reset() {
    this.currentStep = STEPS.INTENT_CAPTURE;
    this.stateData = {
      intent: { channel: 'email', goal: 'de-escalate_and_set_boundaries', tone: 'Empathetic & Firm' },
      inputContext: null,
      selectedAgent: {
        mode: 'auto',
        activeProvider: 'local',
        agentTeam: ['Doer', 'QA Suite', 'Retrieval', 'Research']
      },
      retrievalData: null,
      researchData: null,
      draftResult: null,
      qaResult: null,
      revisions: [],
      finalDelivery: null,
      userFeedback: null
    };
    this.notifyStateChange();
  }

  // Execution steps
  async step1_setIntent({ channel, goal, tone }) {
    this.currentStep = STEPS.INTENT_CAPTURE;
    this.stateData.intent = {
      channel: channel || this.stateData.intent.channel || 'email',
      goal: goal || this.stateData.intent.goal || 'professional_reply',
      tone: tone || this.stateData.intent.tone || 'Empathetic & Firm'
    };
    this.currentStep = STEPS.INPUT_PROCESSING;
    this.notifyStateChange();
    return this.stateData.intent;
  }

  async step2_processInput(rawInput) {
    this.currentStep = STEPS.INPUT_PROCESSING;
    const context = this.contextCollector.analyze(rawInput, this.stateData.intent);
    this.stateData.inputContext = context;
    this.currentStep = STEPS.AGENT_SELECTION;
    this.notifyStateChange();
    return context;
  }

  async step3_selectAgents(selection = {}) {
    this.currentStep = STEPS.AGENT_SELECTION;
    const hasKey = this.llmClient && this.llmClient.hasActiveKey();
    
    let mode = selection.mode || (hasKey ? 'agentic' : 'local');
    if (mode === 'agentic' && !hasKey) {
      // Force local fallback if no key exists
      mode = 'local';
    }

    this.stateData.selectedAgent = {
      mode,
      activeProvider: mode === 'agentic' ? (this.llmClient.provider || 'openai') : 'local',
      agentTeam: selection.agentTeam || ['Doer', 'QA Suite', 'Retrieval', 'Research'],
      autoSelected: selection.auto !== false
    };

    this.currentStep = STEPS.RAG_RETRIEVAL;
    this.notifyStateChange();
    return this.stateData.selectedAgent;
  }

  async step4_retrieveRAG() {
    this.currentStep = STEPS.RAG_RETRIEVAL;
    const query = [
      this.stateData.intent.goal,
      this.stateData.inputContext ? this.stateData.inputContext.normalizedText : ''
    ].join(' ');

    const retrievalData = await this.retrievalAgent.retrieve(query, this.stateData.inputContext || {});
    this.stateData.retrievalData = retrievalData;
    this.currentStep = STEPS.INDEPENDENT_RESEARCH;
    this.notifyStateChange();
    return retrievalData;
  }

  async step5_independentResearch() {
    this.currentStep = STEPS.INDEPENDENT_RESEARCH;
    const researchData = await this.researchAgent.synthesize(
      this.stateData.retrievalData,
      this.stateData.inputContext || {}
    );
    this.stateData.researchData = researchData;
    this.currentStep = STEPS.DOER_DRAFT;
    this.notifyStateChange();
    return researchData;
  }

  async step6_generateDraft(feedback = null) {
    this.currentStep = STEPS.DOER_DRAFT;
    const mode = this.getMode();

    const draftResult = await this.doerAgent.draft({
      context: this.stateData.inputContext,
      retrievalData: this.stateData.retrievalData,
      researchData: this.stateData.researchData,
      channel: this.stateData.intent.channel,
      goal: this.stateData.intent.goal,
      tone: this.stateData.intent.tone,
      feedback: feedback
    }, mode);

    this.stateData.draftResult = draftResult;
    this.currentStep = STEPS.QA_EVALUATION;
    this.notifyStateChange();
    return draftResult;
  }

  async step7_evaluateQA() {
    this.currentStep = STEPS.QA_EVALUATION;
    const revisionCount = this.stateData.revisions.length;

    const qaResult = this.benchmarkingAgent.evaluate({
      draft: this.stateData.draftResult,
      context: this.stateData.inputContext,
      retrievalData: this.stateData.retrievalData,
      researchData: this.stateData.researchData,
      revisionCount
    });

    this.stateData.qaResult = qaResult;

    // Check revision loop
    if (qaResult.shouldRevise && revisionCount < this.benchmarkingAgent.maxRevisions) {
      this.stateData.revisions.push({
        iteration: revisionCount + 1,
        priorDraft: this.stateData.draftResult,
        qaScore: qaResult.score,
        failedCriteria: qaResult.failedCriteria
      });

      // Loop back to Step 6 Doer Draft with QA recommendations
      await this.step6_generateDraft(qaResult);
      return await this.step7_evaluateQA();
    }

    this.currentStep = STEPS.FINAL_DELIVERY;
    this.notifyStateChange();
    return qaResult;
  }

  async step8_deliver() {
    this.currentStep = STEPS.FINAL_DELIVERY;
    const mode = this.getMode();
    const isLocal = mode === 'local';

    const retrievedCits = (this.stateData.retrievalData && this.stateData.retrievalData.citationList && this.stateData.retrievalData.citationList.length > 0)
      ? this.stateData.retrievalData.citationList
      : (this.stateData.draftResult?.primaryCitation ? [this.stateData.draftResult.primaryCitation] : ['[Managerial EQ Handbook §2.0: Universal 4-Stage Real-Time Manager Response Model]']);

    this.stateData.finalDelivery = {
      draft: this.stateData.draftResult,
      qaResult: this.stateData.qaResult,
      citations: retrievedCits,
      citationsFormatted: this.stateData.retrievalData ? this.stateData.retrievalData.citationsFormatted : '',
      confidence: isLocal ? 0.76 : 0.96,
      score: this.stateData.qaResult ? this.stateData.qaResult.score : 85,
      isLocalFallback: isLocal,
      fallbackNotice: isLocal ? "Local fallback — lower confidence. Connect an agent for better research, accuracy, and QA-verified replies." : null,
      deliveredAt: new Date().toISOString()
    };

    this.notifyStateChange();
    return this.stateData.finalDelivery;
  }

  async step9_submitFeedback(feedbackType, notes = "") {
    this.currentStep = STEPS.FEEDBACK;
    this.benchmarkingAgent.recordUserFeedback(feedbackType);

    this.stateData.userFeedback = {
      type: feedbackType, // 'accept' | 'edit' | 'reject'
      notes,
      submittedAt: new Date().toISOString()
    };

    this.notifyStateChange();
    return this.stateData.userFeedback;
  }

  // Full Pipeline Execution
  async runFullPipeline(rawInput, userIntent = {}) {
    await this.step1_setIntent(userIntent);
    await this.step2_processInput(rawInput);
    await this.step3_selectAgents(userIntent.agentSelection || {});
    await this.step4_retrieveRAG();
    await this.step5_independentResearch();
    await this.step6_generateDraft();
    await this.step7_evaluateQA();
    return await this.step8_deliver();
  }
}

if (typeof window !== 'undefined') {
  window.AgentOrchestrator = AgentOrchestrator;
  window.Orchestrator = AgentOrchestrator;
  window.STEPS = STEPS;
  window.STEP_NAMES = STEP_NAMES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STEPS,
    STEP_NAMES,
    AgentOrchestrator
  };
}
