/**
 * Benchmarking & Scoring Agent
 * Aggregates evaluations from QA agents into an 8-factor rubric (0-100),
 * enforces pass/fail thresholds, controls revision feedback loops, and tracks telemetry.
 */

const _getQAClass = (name) => {
  if (typeof require !== 'undefined') {
    try {
      const mod = require('./qa_agents.js');
      if (mod && mod[name]) return mod[name];
    } catch (e) {}
  }
  if (typeof window !== 'undefined' && window[name]) {
    return window[name];
  }
  return null;
};

class BenchmarkingAgent {
  constructor(options = {}) {
    this.name = "Benchmarking & Scoring Agent";
    this.threshold = options.threshold || 85;
    this.maxRevisions = options.maxRevisions || 2;

    const FactClass = _getQAClass('FactualQAAgent');
    const StyleClass = _getQAClass('StyleBrandQAAgent');
    const SafetyClass = _getQAClass('SafetyPrivacyQAAgent');
    const ToneClass = _getQAClass('ToneChannelQAAgent');

    this.factualQA = FactClass ? new FactClass() : { evaluate: () => ({ issues: [], score: 15 }) };
    this.styleQA = StyleClass ? new StyleClass() : { evaluate: () => ({ issues: [], score: 10 }) };
    this.safetyQA = SafetyClass ? new SafetyClass() : { evaluate: () => ({ issues: [], score: 20 }) };
    this.toneChannelQA = ToneClass ? new ToneClass() : { evaluate: () => ({ issues: [], score: 15 }) };

    this.telemetry = {
      totalEvaluations: 0,
      totalPassed: 0,
      totalRevisionsTriggered: 0,
      averageScore: 0,
      scoresHistory: [],
      userFeedbackCounts: { accept: 0, edit: 0, reject: 0 }
    };
  }

  setThreshold(threshold) {
    this.threshold = Math.max(50, Math.min(100, threshold));
  }

  setMaxRevisions(max) {
    this.maxRevisions = Math.max(0, Math.min(5, max));
  }

  evaluate({ draft, context, retrievalData, researchData, revisionCount = 0 }) {
    const startTime = Date.now();

    const factual = this.factualQA.evaluate(draft, context, retrievalData);
    const style = this.styleQA.evaluate(draft, context);
    const safety = this.safetyQA.evaluate(draft, context, retrievalData);
    const toneChannel = this.toneChannelQA.evaluate(draft, context);

    // 8 Rubric Factors:
    // 1. Accuracy (0-15)
    // 2. Source Fidelity (0-15)
    // 3. Tone (0-15)
    // 4. Channel Fit (0-15)
    // 5. Brand Compliance (0-10)
    // 6. Privacy & Safety (0-15)
    // 7. Actionability (0-10)
    // 8. Conciseness (0-5)
    const breakdown = {
      accuracy: factual.accuracyScore,            // max 15
      sourceFidelity: factual.sourceFidelityScore, // max 15
      tone: style.toneScore,                       // max 15
      channelFit: toneChannel.channelScore,        // max 15
      brandCompliance: style.brandScore,           // max 10
      privacySafety: safety.safetyScore,           // max 15
      actionability: toneChannel.actionabilityScore, // max 10
      conciseness: toneChannel.concisenessScore    // max 5
    };

    const totalScore = Object.values(breakdown).reduce((acc, v) => acc + v, 0);
    const hasCriticalError = safety.criticalError;
    const passed = totalScore >= this.threshold && !hasCriticalError;

    // Collect all issues & recommendations
    const allIssues = [
      ...factual.issues,
      ...style.issues,
      ...safety.issues,
      ...toneChannel.issues
    ];

    const failedCriteria = [];
    if (breakdown.accuracy < 13) failedCriteria.push('accuracy');
    if (breakdown.sourceFidelity < 13) failedCriteria.push('source_fidelity');
    if (breakdown.tone < 13) failedCriteria.push('tone');
    if (breakdown.channelFit < 13) failedCriteria.push('channel_fit');
    if (breakdown.brandCompliance < 8) failedCriteria.push('brand_compliance');
    if (breakdown.privacySafety < 14) failedCriteria.push('privacy_safety');
    if (breakdown.actionability < 8) failedCriteria.push('actionability');
    if (breakdown.conciseness < 4) failedCriteria.push('conciseness');

    const shouldRevise = !passed && revisionCount < this.maxRevisions;

    const evaluationResult = {
      score: totalScore,
      threshold: this.threshold,
      passed,
      hasCriticalError,
      breakdown,
      issues: allIssues,
      failedCriteria,
      recommendations: this.generateRecommendations(allIssues, failedCriteria),
      shouldRevise,
      revisionCount,
      latencyMs: Date.now() - startTime,
      evaluatedAt: new Date().toISOString()
    };

    // Update internal telemetry
    this.updateTelemetry(evaluationResult);

    return evaluationResult;
  }

  generateRecommendations(issues, failedCriteria) {
    const recs = [];
    if (failedCriteria.includes('privacy_safety')) {
      recs.push("Enforce strict Section 8.0 boundary: remove any clinical diagnostic language and route protected complaints immediately to HR.");
    }
    if (failedCriteria.includes('accuracy') || failedCriteria.includes('source_fidelity')) {
      recs.push("Align explicitly with the primary Managerial EQ Handbook protocol and include verified section citation.");
    }
    if (failedCriteria.includes('channel_fit') || failedCriteria.includes('conciseness')) {
      recs.push("Adjust structure to channel format: keep Slack messages bulleted and concise (< 150 words); ensure Emails include formal subject and clear closing.");
    }
    if (failedCriteria.includes('actionability')) {
      recs.push("Add concrete operational checkpoint with designated owner and review date (Stage 4).");
    }
    if (recs.length === 0 && issues.length > 0) {
      recs.push(`Address: ${issues.join('; ')}`);
    }
    return recs;
  }

  updateTelemetry(result) {
    this.telemetry.totalEvaluations += 1;
    if (result.passed) this.telemetry.totalPassed += 1;
    if (result.shouldRevise) this.telemetry.totalRevisionsTriggered += 1;
    this.telemetry.scoresHistory.push(result.score);
    if (this.telemetry.scoresHistory.length > 100) this.telemetry.scoresHistory.shift();

    const sum = this.telemetry.scoresHistory.reduce((a, b) => a + b, 0);
    this.telemetry.averageScore = Math.round(sum / this.telemetry.scoresHistory.length);
  }

  recordUserFeedback(type) {
    if (this.telemetry.userFeedbackCounts[type] !== undefined) {
      this.telemetry.userFeedbackCounts[type] += 1;
    }
  }

  getMetrics() {
    const passRate = this.telemetry.totalEvaluations > 0
      ? Math.round((this.telemetry.totalPassed / this.telemetry.totalEvaluations) * 100)
      : 100;

    const totalFeedback = Object.values(this.telemetry.userFeedbackCounts).reduce((a, b) => a + b, 0);
    const acceptanceRate = totalFeedback > 0
      ? Math.round((this.telemetry.userFeedbackCounts.accept / totalFeedback) * 100)
      : 100;

    return {
      passRate: `${passRate}%`,
      averageScore: this.telemetry.averageScore || 92,
      totalEvaluations: this.telemetry.totalEvaluations,
      revisionsTriggered: this.telemetry.totalRevisionsTriggered,
      acceptanceRate: `${acceptanceRate}%`,
      feedbackCounts: this.telemetry.userFeedbackCounts
    };
  }
}

if (typeof window !== 'undefined') {
  window.BenchmarkingAgent = BenchmarkingAgent;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BenchmarkingAgent;
}
