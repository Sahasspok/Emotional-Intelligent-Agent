/**
 * Doer Agent
 * Generates drafts for Email, Slack, LinkedIn, Support, and Strategy Memos
 * using the Universal 4-Stage EQ Model and channel-appropriate styling.
 */

class DoerAgent {
  constructor(llmClient = null, localEngine = null) {
    this.name = "Doer Agent";
    this.role = "Response Drafter & Communication Architect";
    this.llmClient = llmClient;
    this.localEngine = localEngine;
  }

  setClients(llmClient, localEngine) {
    this.llmClient = llmClient;
    this.localEngine = localEngine;
  }

  async draft(payload, mode = 'agentic') {
    const { context, retrievalData, researchData, channel, goal, tone, feedback } = payload;

    // Check if we should use Agentic Mode or Local Fallback
    const isLocal = mode === 'local' || !this.llmClient || !this.llmClient.hasActiveKey();

    if (isLocal) {
      if (!this.localEngine) {
        throw new Error("Local fallback engine not initialized.");
      }
      const localResult = await this.localEngine.generateDraft({
        context,
        retrievalData,
        researchData,
        channel: channel || context.channel,
        goal: goal || context.goal,
        tone: tone || context.suggestedTone,
        feedback: feedback || null
      });

      return {
        ...localResult,
        mode: 'local',
        confidence: 0.76,
        isFallback: true,
        bannerNotice: "Local fallback — lower confidence. Connect an agent for better research, accuracy, and QA-verified replies."
      };
    }

    // Agentic LLM Mode
    const systemPrompt = this.buildSystemPrompt(channel, tone);
    const userPrompt = this.buildUserPrompt({
      context,
      retrievalData,
      researchData,
      channel,
      goal,
      tone,
      feedback
    });

    try {
      const llmResponse = await this.llmClient.complete({
        systemPrompt,
        userPrompt,
        temperature: 0.4
      });

      const parsed = this.parseDraftOutput(llmResponse, channel);
      return {
        ...parsed,
        mode: 'agentic',
        confidence: 0.96,
        isFallback: false,
        bannerNotice: null
      };
    } catch (err) {
      console.warn("Agentic LLM call failed, dropping to Local Fallback:", err);
      // Graceful drop to local fallback
      const localResult = await this.localEngine.generateDraft({
        context,
        retrievalData,
        researchData,
        channel: channel || context.channel,
        goal: goal || context.goal,
        tone: tone || context.suggestedTone,
        feedback: feedback || null
      });

      return {
        ...localResult,
        mode: 'local',
        confidence: 0.76,
        isFallback: true,
        error: err.message,
        bannerNotice: "Local fallback — lower confidence. (Agent connection failed; connect an agent for better research, accuracy, and QA-verified replies.)"
      };
    }
  }

  buildSystemPrompt(channel, tone) {
    return `You are a Senior Executive Communications & Managerial Emotional Intelligence Specialist.
Your primary source of truth is the Managerial EQ Handbook.
You must apply the Universal 4-Stage Real-Time Response Model:
1. Detect & Pause: Slow the response, assess safety/legal risks, avoid defensive counters.
2. Reappraise & Regulate: Separate ego/blame from operational reality, define scope & authority.
3. Empathetic Engagement: Acknowledge legitimate impact and urgency without conceding liability or making promises outside authority.
4. Collaborative Resolution: Define concrete operational steps, owners, deadlines, and escalate boundary breaches.

- Participant Detection: Accurately identify to whom the new reply is being composed of (RECIPIENT) and who is authoring the reply (SENDER). If an incoming message was sent by Sara to John (or Client Alex to PM Amit), address the incoming sender directly ("Hi Sara," / "Hi Alex,") and sign off as the incoming recipient ("Best regards,\nJohn\nProject Manager" / "Best regards,\nAmit\nProject Manager"). NEVER invert sender and recipient, and NEVER use placeholder brackets like [Your Name].
- Important Content Readability: Always emphasize important content in bold (**...**) — specifically key commitments, financial/dollar figures (e.g. **$80,000 in lost revenue**), launch windows, action step titles, owners, and target deadlines.
- Specificity & Tone: Address the concrete items raised (e.g. platform crash, Black Friday launch, safeguards, revenue loss, hero section, pricing, CTA). Write with executive composure, empathy, and clear operational milestones today.
- No Meta Leaks: Never mention internal stage names ("Stage 1"), rubrics, or handbook citations in the body text.

CHANNEL RULES:
- Email: Clear Subject line. Professional, structured paragraphs, empathetic opening, explicit numbered next steps and owners, professional sign-off.
- Slack: Direct, conversational yet professional markdown. Bullet points for actions. No bloated fluff. Concise (< 150 words).
- LinkedIn: Warm, networking-appropriate, concise, setting clear expectations.
- Support: Empathetic acknowledgment, ticket/operational clarity, SLA-grounded steps, strict avoidance of liability concessions.
- Strategy Memo: Executive Brief format: Context, Problem Framing (JD-R / Conflict), Trade-Offs, Action Plan, Escalation Triggers.

STRICT BOUNDARIES:
- Never admit legal fault or offer unauthorized compensation.
- Never privately mediate harassment, discrimination, threats, or severe misconduct (mandatory formal escalation).
- Never diagnose mental health conditions.
- Always cite the relevant handbook section in your evidence references.`;
  }

  buildUserPrompt({ context, retrievalData, researchData, channel, goal, tone, feedback }) {
    let p = `CONTEXT / INCOMING MESSAGE:\n"""\n${context.normalizedText || context.rawText}\n"""\n\n`;
    p += `TARGET CHANNEL: ${channel.toUpperCase()}\n`;
    p += `GOAL: ${goal}\n`;
    p += `REQUESTED TONE: ${tone}\n\n`;

    if (context.thread) {
      const th = context.thread;
      if (th.recipientName) p += `RECIPIENT NAME: ${th.recipientName}\n`;
      if (th.senderName) p += `SENDER NAME: ${th.senderName} (${th.senderRole || 'Manager'})\n`;
      if (th.specificTopics && th.specificTopics.length > 0) p += `TOPICS TO ADDRESS: ${th.specificTopics.join(', ')}\n`;
      if (th.deadlines && th.deadlines.length > 0) p += `KEY DEADLINES: ${th.deadlines.join(', ')}\n`;
      p += '\n';
    }

    if (retrievalData && retrievalData.primaryScenario) {
      const ps = retrievalData.primaryScenario;
      p += `PRIMARY SOURCE OF TRUTH (MUST FOLLOW):\n`;
      p += `Section: ${ps.citation}\n`;
      p += `Evidence Base: ${ps.evidence_base}\n`;
      p += `Stage 1 (Detect & Pause): ${ps.four_stages.stage1_detect_pause}\n`;
      p += `Stage 2 (Reappraise & Regulate): ${ps.four_stages.stage2_reappraise_regulate}\n`;
      p += `Stage 3 (Empathetic Engagement): ${ps.four_stages.stage3_empathetic_engagement}\n`;
      p += `Stage 4 (Collaborative Resolution): ${ps.four_stages.stage4_collaborative_resolution}\n`;
      p += `Verified Manager Script: "${ps.manager_script}"\n`;
      p += `What Not To Do (Failure Modes): ${ps.what_not_to_do}\n`;
      p += `Escalation Boundary: ${ps.escalation_boundary}\n\n`;
    }

    if (researchData && researchData.independentFramework) {
      p += `INDEPENDENT RESEARCH CONTEXT:\n`;
      p += `Framework: ${researchData.independentFramework}\n`;
      p += `Insight: ${researchData.keyScientificInsight}\n`;
      p += `Citation: ${researchData.academicCitation}\n\n`;
    }

    if (feedback) {
      p += `REVISION FEEDBACK FROM PREVIOUS QA EVALUATION:\n`;
      p += `Score: ${feedback.score}/100\n`;
      p += `Failed criteria: ${feedback.failedCriteria.join(', ')}\n`;
      p += `Specific instructions to fix: ${feedback.recommendations.join('; ')}\n\n`;
    }

    p += `OUTPUT FORMAT REQUIRED:
Provide your response strictly in the following JSON structure:
{
  "subject": "Subject line (if email or support, else empty string)",
  "content": "The full formatted reply text ready to send",
  "four_stage_breakdown": {
    "stage1_detect_pause": "How the draft de-escalates / pauses",
    "stage2_reappraise_regulate": "How the draft separates facts from ego/allegations",
    "stage3_empathetic_engagement": "How the draft acknowledges impact and perspective",
    "stage4_collaborative_resolution": "The concrete next action, owner, and timeline"
  },
  "primaryCitation": "Exact handbook citation e.g. [Managerial EQ Handbook §4.1: Client Escalation]",
  "escalationNotes": "Any required escalation to HR, legal, security, or leadership"
}`;

    return p;
  }

  parseDraftOutput(rawOutput, channel) {
    let parsed = null;
    try {
      const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn("Could not parse JSON from LLM output, extracting text directly:", e);
    }

    if (!parsed) {
      let subject = "";
      let content = rawOutput;
      const subMatch = rawOutput.match(/Subject:\s*(.*)/i);
      if (subMatch) {
        subject = subMatch[1].trim();
        content = rawOutput.replace(/Subject:\s*.*\n*/i, '').trim();
      }

      parsed = {
        subject,
        content,
        four_stage_breakdown: {
          stage1_detect_pause: "De-escalated tone and checked boundaries.",
          stage2_reappraise_regulate: "Addressed operational problem separately from emotional charge.",
          stage3_empathetic_engagement: "Acknowledged perceived urgency and perspective.",
          stage4_collaborative_resolution: "Outlined clear operational steps and ownership."
        },
        primaryCitation: "[Managerial EQ Handbook §2.0: Universal 4-Stage Model]",
        escalationNotes: "Review for statutory or contractual escalation triggers."
      };
    }

    if (parsed.content) {
      parsed.content = this.ensureImportantContentBold(parsed.content);
    }
    return parsed;
  }

  ensureImportantContentBold(text) {
    if (!text) return '';
    let out = text;

    out = out.replace(/\*{3,}/g, '**');

    // 1. Numbered steps e.g. "1. Requirements & Spec Audit:"
    out = out.replace(/(?:^|\n)(\d+\.\s+)(?!\*\*)([A-Za-z0-9\s&/\-_]+?)(:|\s+[-–—]\s+)/g, (match, num, title, sep) => {
      return `${match.startsWith('\n') ? '\n' : ''}${num}**${title.trim()}**${sep}`;
    });

    // 2. Bullet points e.g. "• Context & Priority:"
    out = out.replace(/(?:^|\n)(•\s+)(?!\*\*)([A-Za-z0-9\s&/\-_]+?)(:|\s+[-–—]\s+)/g, (match, bullet, title, sep) => {
      return `${match.startsWith('\n') ? '\n' : ''}${bullet}**${title.trim()}**${sep}`;
    });

    // 3. Owners and targets e.g. "(Owner: Myself, Target: 1:00 PM today)"
    out = out.replace(/(Owner:\s*)([A-Za-z0-9\s&/]+?)(,|\)|;)/gi, (m, p1, p2, p3) => {
      if (p2.includes('**')) return m;
      return `${p1}**${p2.trim()}**${p3}`;
    });
    out = out.replace(/(Target:\s*|Completed by:\s*)([A-Za-z0-9\s:apmAPM/]+?)(,|\)|;|\n)/gi, (m, p1, p2, p3) => {
      if (p2.includes('**')) return m;
      return `${p1}**${p2.trim()}**${p3}`;
    });

    // Parity-safe phrase replacement (never injects ** inside an already open bold span)
    const safeBoldPhrases = (phrases) => {
      const sorted = [...phrases].sort((a, b) => b.length - a.length);
      for (const phrase of sorted) {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<!\\*\\*)(?:\\b)(${escaped})(?:\\b)(?!\\*\\*)`, 'gi');
        out = out.replace(regex, (match, p1, offset, fullString) => {
          const before = fullString.substring(0, offset);
          const asterisksBefore = (before.match(/\*\*/g) || []).length;
          if (asterisksBefore % 2 === 1) {
            return match;
          }
          return `**${p1}**`;
        });
      }
    };

    // 4. Financial impact figures e.g. $80,000 in lost revenue, $80,000 in revenue, $80,000
    out = out.replace(/(?<!\*\*)(\$[0-9,]+(?:\s*(?:in lost revenue|in revenue|revenue))?)(?!\*\*)/gi, (match, p1, offset, fullString) => {
      const before = fullString.substring(0, offset);
      const asterisksBefore = (before.match(/\*\*/g) || []).length;
      if (asterisksBefore % 2 === 1) return match;
      return `**${p1.trim()}**`;
    });

    // 5. Critical deadlines & milestones
    safeBoldPhrases([
      "tomorrow's stakeholder review",
      "stakeholder review tomorrow",
      "tomorrow's review",
      "tomorrow's meeting",
      "Monday board demo",
      "board demo on Monday",
      "peak Black Friday launch window",
      "peak Black Friday launch",
      "Black Friday launch window",
      "Black Friday launch",
      "Black Friday",
      "Cyber Monday launch",
      "Immediate / Active Now",
      "1:00 PM today",
      "2:00 PM today",
      "4:00 PM today",
      "5:30 PM today",
      "by 4:00 PM today"
    ]);

    // 6. High-impact operational incident & technical terms
    safeBoldPhrases([
      "restore full platform stability immediately",
      "uninterrupted platform availability",
      "total root-cause remediation",
      "dedicated resource shielding",
      "automated deployment safeguards",
      "technical post-incident summary",
      "technical post-incident report",
      "zero further downtime",
      "pre-deployment checks",
      "pre-flight checks",
      "recurring review discrepancy",
      "development team alignment",
      "hero section messaging",
      "homepage hero section",
      "pricing section updates",
      "pricing content",
      "pricing section",
      "CTA buttons",
      "CTA button",
      "transaction ACID guarantees",
      "read/write latency under peak load",
      "schema evolution",
      "operational maintenance overhead"
    ]);

    // 7. Leadership, Governance & Commitments
    safeBoldPhrases([
      "personally leading our operational incident review today",
      "personally owning the investigation today",
      "personally owning the operational review today",
      "personally leading our operational review today",
      "senior systems engineering team",
      "senior systems engineering",
      "senior management",
      "senior leadership",
      "commercial governance process",
      "commercial governance",
      "commercial remedies",
      "continuous platform stability"
    ]);

    // 8. Signoff names & titles
    out = out.replace(/(Best regards,?\s*\n+)(?!\*\*)([A-Za-z\s]+?)(\n+)(?!\*\*)([A-Za-z\s]+)$/g, (m, p1, name, p3, title) => {
      return `${p1}**${name.trim()}**${p3}**${title.trim()}**`;
    });

    // Clean up empty asterisks without stripping newlines
    out = out.replace(/\*\*[ \t]*\*\*/g, '');
    out = out.replace(/\*{3,}/g, '**');

    return out;
  }
}

if (typeof window !== 'undefined') {
  window.DoerAgent = DoerAgent;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DoerAgent;
}
