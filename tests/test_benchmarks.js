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
const BenchmarkRunner = require('../lib/benchmarks/benchmark_runner.js');

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/rag/corpus.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/rag/index.json'), 'utf8'));
const goldSet = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/benchmarks/gold_set.json'), 'utf8'));

console.log('--- Running Gold Standard Regression Benchmarks ---');

const ragEngine = new RAGEngine(corpus, index);
const contextCollector = new ContextCollectorAgent();
const retrievalAgent = new RetrievalAgent(ragEngine);
const researchAgent = new ResearchAgent();
const localEngine = new LocalEQEngine(corpus);
const llmClient = new LLMClient();
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

const runner = new BenchmarkRunner(orchestrator);

async function run() {
  const summary = await runner.runAll({ tasks: goldSet, mode: 'local' });

  console.log('\n================ BENCHMARK REPORT ================');
  console.log(`Mode:                 ${summary.mode}`);
  console.log(`Total Gold Tasks:     ${summary.totalTasks}`);
  console.log(`Passed Tasks:         ${summary.passedTasks}`);
  console.log(`Pass Rate:            ${summary.passRate}`);
  console.log(`Average QA Score:     ${summary.averageScore}/100`);
  console.log(`Citation Coverage:    ${summary.citationCoverage}`);
  console.log(`Average Latency:      ${summary.averageLatencyMs}ms`);
  console.log('===================================================\n');

  for (const t of summary.taskDetails) {
    const status = t.passedAll ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} [${t.taskId}] ${t.taskName} (QA: ${t.qaScore}/100, Sec: §${t.matchedSection || 'N/A'}, Latency: ${t.latencyMs}ms)`);
    if (t.violations && t.violations.length > 0) {
      console.log(`   Violations: ${t.violations.join('; ')}`);
    }
  }

  assert(summary.totalTasks >= 6, 'Should have at least 6 gold tasks');
  assert.strictEqual(summary.citationCoverage, '100%', 'All gold tasks must have 100% citation coverage');
  assert(parseInt(summary.passRate) >= 80, `Pass rate should be >= 80%, was ${summary.passRate}`);
  console.log('\n✓ Gold Set Regression Benchmark passed successfully!\n');
}

run().catch(err => {
  console.error("Benchmark execution failed:", err);
  process.exit(1);
});
