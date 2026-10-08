const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RAGEngine = require('../lib/rag/rag_engine.js');
const ContextCollectorAgent = require('../lib/agents/context_collector.js');
const RetrievalAgent = require('../lib/agents/retrieval_agent.js');
const ResearchAgent = require('../lib/agents/research_agent.js');
const DoerAgent = require('../lib/agents/doer_agent.js');
const LocalEQEngine = require('../lib/agents/local_engine.js');
const BenchmarkingAgent = require('../lib/agents/benchmarking_agent.js');
const LLMClient = require('../lib/agents/llm_client.js');
const { AgentOrchestrator } = require('../lib/agents/orchestrator.js');

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/rag/corpus.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/rag/index.json'), 'utf8'));
const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenarios_100.json'), 'utf8'));

console.log(`\n===============================================================`);
console.log(`🚀 Executing 100 Multi-Category Managerial EQ Test Scenarios`);
console.log(`===============================================================\n`);

const ragEngine = new RAGEngine(corpus, index);
const contextCollector = new ContextCollectorAgent();
const retrievalAgent = new RetrievalAgent(ragEngine);
const researchAgent = new ResearchAgent();
const localEngine = new LocalEQEngine(corpus);
const llmClient = new LLMClient({ provider: 'gemini', apiKey: '', model: 'gemini-flash-lite-latest' });
const doerAgent = new DoerAgent(llmClient, localEngine);
const benchmarkingAgent = new BenchmarkingAgent({ threshold: 85 });

const orchestrator = new AgentOrchestrator({
  ragEngine,
  contextCollector,
  retrievalAgent,
  researchAgent,
  doerAgent,
  benchmarkingAgent,
  llmClient,
  localEngine
});

async function runAll100() {
  const startTime = Date.now();
  let passedCount = 0;
  let totalScore = 0;
  const categoryStats = {};
  const failedScenarios = [];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const cat = s.category;
    if (!categoryStats[cat]) {
      categoryStats[cat] = { count: 0, passed: 0, totalScore: 0 };
    }
    categoryStats[cat].count++;

    try {
      const delivery = await orchestrator.runFullPipeline(s.input, {
        channel: s.channel,
        goal: s.goal,
        tone: s.tone,
        agentSelection: { mode: 'local' }
      });

      const qa = delivery.qaResult;
      const draft = delivery.draft;
      const score = qa.score || 0;
      totalScore += score;
      categoryStats[cat].totalScore += score;

      const hasContent = Boolean(draft && draft.content && draft.content.trim().length > 30);
      const hasCitation = Boolean(delivery.citations && delivery.citations.length > 0);
      const isPassed = qa.passed && hasContent && hasCitation;

      if (isPassed) {
        passedCount++;
        categoryStats[cat].passed++;
      } else {
        failedScenarios.push({
          id: s.id,
          name: s.name,
          score,
          issues: qa.issues
        });
      }

      // Progress tick every 20 scenarios
      if ((i + 1) % 20 === 0 || i === scenarios.length - 1) {
        console.log(`... processed ${i + 1}/${scenarios.length} scenarios (Current Pass Rate: ${Math.round((passedCount / (i + 1)) * 100)}%)`);
      }
    } catch (err) {
      console.error(`Error on scenario ${s.id}:`, err.message);
      failedScenarios.push({ id: s.id, name: s.name, error: err.message });
    }
  }

  const durationMs = Date.now() - startTime;
  const avgScore = Math.round(totalScore / scenarios.length);
  const passRate = Math.round((passedCount / scenarios.length) * 100);

  console.log(`\n================== 100 SCENARIOS REPORT ==================`);
  console.log(`Total Scenarios Tested:  ${scenarios.length}`);
  console.log(`Passed Scenarios:        ${passedCount}`);
  console.log(`Pass Rate:               ${passRate}%`);
  console.log(`Average QA Score:        ${avgScore}/100`);
  console.log(`Total Latency:           ${durationMs}ms (${Math.round(durationMs / scenarios.length)}ms/scenario)`);
  console.log(`==========================================================\n`);

  console.log(`--- Category Breakdown ---`);
  for (const [cat, stats] of Object.entries(categoryStats)) {
    const catRate = Math.round((stats.passed / stats.count) * 100);
    const catAvg = Math.round(stats.totalScore / stats.count);
    console.log(`• ${cat.padEnd(25)}: ${stats.passed}/${stats.count} passed (${catRate}%) | Avg QA: ${catAvg}/100`);
  }

  if (failedScenarios.length > 0) {
    console.log(`\n⚠️ Failed Scenarios (${failedScenarios.length}):`);
    for (const f of failedScenarios) {
      console.log(`  - [${f.id}] ${f.name} (Score: ${f.score}): ${JSON.stringify(f.issues || f.error)}`);
    }
  }

  assert.strictEqual(scenarios.length, 100, 'Must test exactly 100 scenarios');
  assert.strictEqual(passedCount, 100, `All 100 scenarios must pass QA threshold (passed: ${passedCount}/100)`);
  console.log(`\n✓ All 100 test scenarios passed with 100% success!\n`);
}

runAll100().catch(err => {
  console.error("100 Scenarios execution failed:", err);
  process.exit(1);
});
