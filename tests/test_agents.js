const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RAGEngine = require('../lib/rag/rag_engine.js');
const ContextCollectorAgent = require('../lib/agents/context_collector.js');
const RetrievalAgent = require('../lib/agents/retrieval_agent.js');
const ResearchAgent = require('../lib/agents/research_agent.js');
const DoerAgent = require('../lib/agents/doer_agent.js');
const LocalEQEngine = require('../lib/agents/local_engine.js');
const { FactualQAAgent, StyleBrandQAAgent, SafetyPrivacyQAAgent, ToneChannelQAAgent } = require('../lib/agents/qa_agents.js');
const BenchmarkingAgent = require('../lib/agents/benchmarking_agent.js');
const LLMClient = require('../lib/agents/llm_client.js');
const { AgentOrchestrator, STEPS } = require('../lib/agents/orchestrator.js');

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/rag/corpus.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/rag/index.json'), 'utf8'));

console.log('--- Testing Agent Suite & Orchestrator ---');

const ragEngine = new RAGEngine(corpus, index);
const contextCollector = new ContextCollectorAgent();
const retrievalAgent = new RetrievalAgent(ragEngine);
const researchAgent = new ResearchAgent();
const localEngine = new LocalEQEngine(corpus);
const llmClient = new LLMClient(); // No key, local mode
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

async function runTests() {
  // Test 1: Context Collector
  const ctx = contextCollector.analyze("Subject: Outage issue\nWe lost money and will sue your company!");
  assert.strictEqual(ctx.channel, 'email', 'Channel should be email');
  assert(ctx.riskFlags.some(f => f.type === 'CONTRACTUAL_LEGAL_EXPOSURE'), 'Should detect legal exposure risk');
  console.log('✓ ContextCollectorAgent correctly identified channel & legal risk flag');

  // Test 2: Retrieval Agent
  const ret = await retrievalAgent.retrieve("client angry over service outage and threatening cancellation", ctx);
  assert(ret.primaryScenario !== null, 'Should find primary scenario');
  assert.strictEqual(ret.primaryScenario.section_number, '4.1');
  assert(ret.universalModel !== null, 'Should include universal 4-stage model');
  console.log('✓ RetrievalAgent retrieved primary scenario §4.1 and Universal 4-Stage Model');

  // Test 3: Research Agent
  const res = await researchAgent.synthesize(ret, ctx);
  assert(res.conflictAudits.length > 0, 'Should audit potential external conflicts');
  assert(res.ruleApplied.includes('Primary Source of Truth'), 'Should state source of truth precedence');
  console.log('✓ ResearchAgent synthesized independent evidence and enforced Source of Truth');

  // Test 4: Doer Agent (Local Fallback)
  const draft = await doerAgent.draft({
    context: ctx,
    retrievalData: ret,
    researchData: res,
    channel: 'email',
    goal: 'de-escalate_and_set_boundaries',
    tone: 'Empathetic & Firm'
  }, 'local');

  assert.strictEqual(draft.mode, 'local');
  assert(draft.isFallback, 'Should mark as fallback');
  assert(draft.bannerNotice.includes('Local fallback — lower confidence'), 'Should contain insisted banner notice');
  assert(draft.content.length > 100, 'Should generate structured content');
  console.log('✓ DoerAgent generated compliant local fallback draft with insisted banner');

  // Test 5: Safety QA Agent catches PII and Clinical Diagnosis
  const safetyQA = new SafetyPrivacyQAAgent();
  const badDraft = { content: "You seem clinically depressed, here is my SSN: 123-45-6789." };
  const safetyEval = safetyQA.evaluate(badDraft, ctx, ret);
  assert.strictEqual(safetyEval.criticalError, true, 'Should flag critical safety error');
  assert(safetyEval.issues.length >= 2, 'Should flag both clinical term and SSN');
  console.log('✓ SafetyPrivacyQAAgent blocked clinical diagnosis and PII');

  // Test 6: Benchmarking Agent 8-factor rubric
  const evalResult = benchmarkingAgent.evaluate({
    draft,
    context: ctx,
    retrievalData: ret,
    researchData: res
  });
  assert(evalResult.score >= 80, `Draft score should be high, was ${evalResult.score}`);
  assert.strictEqual(typeof evalResult.breakdown.accuracy, 'number');
  assert.strictEqual(typeof evalResult.breakdown.sourceFidelity, 'number');
  assert.strictEqual(typeof evalResult.breakdown.privacySafety, 'number');
  console.log(`✓ BenchmarkingAgent scored draft: ${evalResult.score}/100 across 8 factors`);

  // Test 7: Full Orchestrator Pipeline & Reversibility
  orchestrator.reset();
  assert.strictEqual(orchestrator.currentStep, STEPS.INTENT_CAPTURE);
  
  const delivery = await orchestrator.runFullPipeline(
    "Dave and Sarah are arguing about Postgres vs Mongo in Slack.",
    { channel: 'slack', goal: 'resolve_task_conflict' }
  );

  assert.strictEqual(orchestrator.currentStep, STEPS.FINAL_DELIVERY);
  assert(delivery.draft.content.length > 50);
  assert(delivery.isLocalFallback, 'Should be local fallback when no LLM key configured');
  assert(orchestrator.getInsistenceBanner() !== null, 'Should insist on connecting an agent');

  // Test Reversibility (Jump back to step 1)
  orchestrator.jumpToStep(STEPS.INTENT_CAPTURE);
  assert.strictEqual(orchestrator.currentStep, STEPS.INTENT_CAPTURE);
  // Test 8: LLM Client Connection Validation & Invalidation
  const testClient = new LLMClient({ provider: 'openai', apiKey: 'sk-invalid-test' });
  assert.strictEqual(testClient.isSuccessfullyConnected(), false, 'Unverified client must not report connected');
  const connRes = await testClient.testConnection();
  assert.strictEqual(connRes.success, false, 'Invalid credentials must fail connection test');
  assert.strictEqual(testClient.isSuccessfullyConnected(), false, 'Failed test must not mark client verified');

  const verifiedClient = new LLMClient({ provider: 'openai', apiKey: 'test-key', isVerified: true });
  assert.strictEqual(verifiedClient.isSuccessfullyConnected(), true, 'Pre-verified client is connected');
  verifiedClient.setConfig({ apiKey: 'altered-key' });
  assert.strictEqual(verifiedClient.isSuccessfullyConnected(), false, 'Credential modification must invalidate verification');
  console.log('✓ LLMClient connection validation and state invalidation verified');

  console.log('\nAll Agent Suite & Orchestrator tests passed successfully!\n');
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
