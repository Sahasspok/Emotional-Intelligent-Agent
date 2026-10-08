/**
 * Automated Benchmark Runner for Regression Testing
 * Executes gold set tasks, records latency, citation coverage, QA pass rates, and rubric scores.
 */

let goldSet = [];
if (typeof require !== 'undefined') {
  try {
    goldSet = require('./gold_set.json');
  } catch (e) {}
} else if (typeof window !== 'undefined' && window.GOLD_SET) {
  goldSet = window.GOLD_SET;
}

class BenchmarkRunner {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.results = [];
  }

  async getTasks() {
    if (goldSet && goldSet.length > 0) return goldSet;
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('../lib/benchmarks/gold_set.json');
        if (res.ok) {
          goldSet = await res.json();
          return goldSet;
        }
      } catch (e) {}
    }
    return [];
  }

  async runAll(options = {}) {
    const tasks = options.tasks || (await this.getTasks());
    const mode = options.mode || 'local'; // 'local' | 'agentic'
    const results = [];
    const startTime = Date.now();

    for (const task of tasks) {
      const taskStart = Date.now();
      try {
        this.orchestrator.reset();
        this.orchestrator.stateData.selectedAgent.mode = mode;

        const delivery = await this.orchestrator.runFullPipeline(task.input, {
          channel: task.channel,
          goal: task.goal,
          tone: task.tone,
          agentSelection: { mode: mode }
        });

        const draftText = (delivery.draft ? delivery.draft.content : '') || '';
        const lowerDraft = draftText.toLowerCase();

        // 1. Verify Citation Coverage
        const hasCitation = (delivery.citations && delivery.citations.length > 0) ||
                            draftText.includes('Managerial EQ Handbook');

        // 2. Check Expected Section
        const primarySection = this.orchestrator.stateData.retrievalData &&
                               this.orchestrator.stateData.retrievalData.primaryScenario
                               ? this.orchestrator.stateData.retrievalData.primaryScenario.section_number
                               : '';
        const sectionMatched = primarySection === task.expectedSection ||
                               (delivery.citations || []).some(c => c.includes(task.expectedSection));

        // 3. Check Forbidden Elements
        const violations = [];
        if (task.mustNotContain) {
          for (const phrase of task.mustNotContain) {
            if (lowerDraft.includes(phrase.toLowerCase())) {
              violations.push(`Contained forbidden phrase: "${phrase}"`);
            }
          }
        }

        // 4. Check Required Elements
        const missingRequired = [];
        if (task.mustContain) {
          for (const req of task.mustContain) {
            if (!lowerDraft.includes(req.toLowerCase())) {
              missingRequired.push(`Missing required topic/marker: "${req}"`);
            }
          }
        }

        const qaScore = delivery.score || 0;
        const passedQA = delivery.qaResult ? delivery.qaResult.passed : (qaScore >= 85);
        const passedAll = passedQA && sectionMatched && violations.length === 0 && hasCitation;

        results.push({
          taskId: task.id,
          taskName: task.name,
          channel: task.channel,
          expectedSection: task.expectedSection,
          matchedSection: primarySection,
          sectionMatched,
          hasCitation,
          qaScore,
          passedQA,
          passedAll,
          violations,
          missingRequired,
          latencyMs: Date.now() - taskStart
        });

      } catch (err) {
        results.push({
          taskId: task.id,
          taskName: task.name,
          error: err.message,
          passedAll: false,
          qaScore: 0,
          latencyMs: Date.now() - taskStart
        });
      }
    }

    const total = results.length;
    const passed = results.filter(r => r.passedAll).length;
    const avgScore = total > 0 ? Math.round(results.reduce((a, b) => a + (b.qaScore || 0), 0) / total) : 0;
    const avgLatency = total > 0 ? Math.round(results.reduce((a, b) => a + (b.latencyMs || 0), 0) / total) : 0;
    const citationCoverage = total > 0 ? Math.round((results.filter(r => r.hasCitation).length / total) * 100) : 0;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const summary = {
      mode,
      totalTasks: total,
      passedTasks: passed,
      passRate: `${passRate}%`,
      averageScore: avgScore,
      averageLatencyMs: avgLatency,
      citationCoverage: `${citationCoverage}%`,
      totalRunTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      taskDetails: results
    };

    this.results = summary;
    return summary;
  }
}

if (typeof window !== 'undefined') {
  window.BenchmarkRunner = BenchmarkRunner;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BenchmarkRunner;
}
