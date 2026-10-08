/**
 * Local EQ Engine (Offline Deterministic Fallback)
 * Generates structured, high-EQ, articulate responses using pre-indexed handbook scripts,
 * scenario protocols, and the 4-stage response model without external LLM API calls.
 */

class LocalEQEngine {
  constructor(corpus = []) {
    this.corpus = corpus;
  }

  setCorpus(corpus) {
    this.corpus = corpus;
  }

  async generateDraft({ context, retrievalData, researchData, channel, goal, tone, feedback }) {
    const scenario = retrievalData?.primaryScenario || null;
    const rawText = context.normalizedText || context.rawText || '';
    const rawLower = rawText.toLowerCase();
    const thread = context.thread || {};
    const effectiveChannel = channel || context.channel || 'email';

    // Extract core parameters
    let scenarioNum = scenario ? scenario.section_number : '2.0';
    let scenarioTitle = scenario ? scenario.title : 'Universal 4-Stage Response';
    let script = scenario && scenario.manager_script ? scenario.manager_script : 'I want to separate the immediate operational issue from wider concerns and establish a clear collaborative step.';
    let citation = scenario ? scenario.citation : '[Managerial EQ Handbook §2.0: Universal 4-Stage Real-Time Manager Response Model]';
    let escalation = scenario ? scenario.escalation_boundary : 'Review for formal escalation if threats or protected categories are involved.';

    // Participant resolution
    const recipientGreeting = thread.recipientName ? `Hi ${thread.recipientName},` : `Hi there,`;
    const senderSignoff = thread.senderName
      ? `${thread.senderName}${thread.senderRole ? '\n' + thread.senderRole : ''}`
      : 'Operations Management';

    let subject = '';
    let content = '';
    let breakdown = {
      stage1_detect_pause: 'Paused response, assessed safety/legal boundaries, and prevented defensive counter-reactions.',
      stage2_reappraise_regulate: 'Decoupled operational problem-solving from interpersonal friction and blame.',
      stage3_empathetic_engagement: 'Acknowledged urgency, perspective, and operational impact without conceding liability.',
      stage4_collaborative_resolution: 'Outlined clear operational next steps, explicit owners, and committed timelines.'
    };

    // -------------------------------------------------------------
    // SCENARIO 4.1: Client Escalation & Boundary Management
    // -------------------------------------------------------------
    if (scenarioNum === '4.1' || goal === 'de-escalate_and_set_boundaries' || rawLower.includes('escalat') || rawLower.includes('crash') || rawLower.includes('lost sales')) {
      const isPlatformIncident = rawLower.includes('crash') || rawLower.includes('outage') || rawLower.includes('downtime') || rawLower.includes('unavailable') || rawLower.includes('disruption') || rawLower.includes('black friday') || rawLower.includes('lost sales') || rawLower.includes('revenue') || rawLower.includes('breach');

      if (isPlatformIncident) {
        // High-stakes platform crash / outage incident (e.g. Black Friday launch / financial loss)
        const financialMention = thread.financialImpact
          ? `, including your noted ${thread.financialImpact}`
          : '';
        const campaignWindow = rawLower.includes('black friday')
          ? 'during your peak Black Friday launch window'
          : 'during this critical operational window';

        subject = rawLower.includes('black friday')
          ? `Re: Black Friday Platform Incident & Immediate Stability Plan [URGENT ESCALATION]`
          : `Re: Urgent Platform Status & Immediate Operational Incident Review`;

        content = `${recipientGreeting}\n\n` +
          `Thank you for reaching out to us directly regarding the platform outage. I understand the critical severity and the severe impact this event has had on your business operations ${campaignWindow}${financialMention}.\n\n` +
          `We take this incident with the utmost seriousness. I want to separate the immediate technical stabilization from wider commercial and legal concerns so our engineering leads can focus all resources on uninterrupted platform availability. I am personally leading our operational incident review today alongside our senior systems engineering team to ensure total root-cause remediation.\n\n` +
          `Here is our immediate operational incident action plan:\n` +
          `1. **Immediate Platform Stabilization & Failover Shielding**: Our incident response team has stabilized the production environment and applied dedicated resource shielding across all platform endpoints to guarantee zero further downtime during active campaign traffic. *(Owner: Senior Systems Engineering, Target: Immediate / Active Now)*\n` +
          `2. **Root-Cause Incident Audit & Safeguards**: Conducting an immediate end-to-end technical post-mortem into why the recent deployment triggered this failure, why it was not caught in pre-flight checks, and implementing automated deployment safeguards to prevent recurrence. *(Owner: ${thread.senderName || 'Technical Lead'} & Systems Engineering, Target: 2:00 PM today)*\n` +
          `3. **Technical Post-Mortem & Executive Status Brief**: We will deliver a verified technical post-incident summary outlining exact incident timeline, root cause, and permanent safeguards by 4:00 PM today. *(Owner: ${thread.senderName || 'Incident Commander'}, Target: 4:00 PM today)*\n\n` +
          `Regarding commercial matters and your note on financial impact, any discussion of commercial remedies and contract governance will be handled directly through our senior leadership and commercial governance process. Our immediate priority today is ensuring total, continuous platform stability for your operations.\n\n` +
          `Best regards,\n` +
          `${senderSignoff}`;

        breakdown = {
          stage1_detect_pause: 'Acknowledged the critical severity without defensive friction, counter-allegations, or premature excuses.',
          stage2_reappraise_regulate: 'Decoupled immediate operational stabilization from broader commercial and legal considerations.',
          stage3_empathetic_engagement: 'Validated client business impact during peak launch window while maintaining formal commercial governance.',
          stage4_collaborative_resolution: 'Committed to structured operational incident review today while directing commercial remedies to appropriate governance.'
        };
      } else {
        // Detailed thread-adaptive deliverables review (e.g. PM Amit -> Client Alex)
        const hasSpecificTopics = thread.specificTopics && thread.specificTopics.length > 0;
        const hasDeadlines = thread.deadlines && thread.deadlines.length > 0;
        const deadlineMention = hasDeadlines ? `especially with your ${thread.deadlines.join(' and ')}.` : `given the critical timeline ahead.`;
        let topicsStr = 'the pending deliverables';
        if (hasSpecificTopics) {
          if (thread.specificTopics.length === 1) {
            topicsStr = thread.specificTopics[0];
          } else if (thread.specificTopics.length === 2) {
            topicsStr = `${thread.specificTopics[0]} and ${thread.specificTopics[1]}`;
          } else {
            const allButLast = thread.specificTopics.slice(0, -1).join(', ');
            topicsStr = `${allButLast}, and ${thread.specificTopics[thread.specificTopics.length - 1]}`;
          }
        }

        let subjectSuffix = 'Tomorrow\'s Stakeholder Review';
        if (hasDeadlines) {
          const d = thread.deadlines[0].toLowerCase();
          if (d.includes('stakeholder review') && d.includes('tomorrow')) {
            subjectSuffix = "Tomorrow's Stakeholder Review";
          } else {
            subjectSuffix = thread.deadlines[0].replace(/^[a-z]/, c => c.toUpperCase());
          }
        }

        subject = hasDeadlines
          ? `Re: Page Updates Review & Action Plan Ahead of ${subjectSuffix}`
          : `Re: Operational Update & Action Plan [Client Escalation]`;

        content = `${recipientGreeting}\n\n` +
          `Thank you for reaching out directly and sharing this feedback. I hear your frustration and recognize the urgency here, ${deadlineMention}\n\n` +
          `I understand how critical this is, and having changes fall short of what was agreed is unacceptable for your workflow. I want to separate the immediate operational review from wider concerns so we can resolve this without delay. I am personally owning the investigation today to identify where the disconnect occurred between our discussion and development handoff.\n\n` +
          `Here is our immediate operational action plan:\n` +
          `1. **Requirements & Spec Audit**: Cross-referencing our agreed notes against the current staging build, specifically auditing ${topicsStr}. *(Owner: ${thread.senderName || 'Myself'}, Target: 1:00 PM today)*\n` +
          `2. **Development Correction**: Directing the development team to implement the confirmed specifications immediately following the audit. *(Owner: Development Team, Target: 4:00 PM today)*\n` +
          `3. **Staging Verification & Sign-off**: Personally testing the updated staging page against your feedback before sharing the revised link for your review and approval. *(Owner: ${thread.senderName || 'Myself'}, Target: 5:30 PM today)*\n\n` +
          `While any wider commercial considerations will be handled through standard commercial governance, our full focus right now is ensuring this is delivered cleanly and accurately.\n\n` +
          `Best regards,\n` +
          `${senderSignoff}`;

        breakdown = {
          stage1_detect_pause: `Acknowledged feedback directly and validated the critical timeline of ${hasDeadlines ? thread.deadlines.join(' / ') : 'upcoming reviews'}, pausing defensive reactions.`,
          stage2_reappraise_regulate: `Decoupled immediate operational review from panic or blame, taking personal ownership of requirements audit.`,
          stage3_empathetic_engagement: `Validated client frustration with review discrepancies while strictly adhering to commercial governance.`,
          stage4_collaborative_resolution: `Defined a concrete 3-step action plan with owners, milestones today, and same-day sign-off ahead of tomorrow's review.`
        };
      }
    }

    // -------------------------------------------------------------
    // SCENARIO 4.2: Team Task Conflict (Slack / Architectural Debate)
    // -------------------------------------------------------------
    else if (scenarioNum === '4.2' || goal === 'resolve_task_conflict' || rawLower.includes('mongodb') || rawLower.includes('postgresql') || rawLower.includes('architecture channel')) {
      subject = '';
      content = `Hey team — thanks for raising this in the channel.\n\n` +
        `• **Context & Priority**: Both proposals have distinct technical merits, and healthy architectural debate is vital for long-term scalability.\n` +
        `• **Objective Criteria**: Rather than debating tools in isolation, let's evaluate both approaches against our shared architecture criteria: **transaction ACID guarantees**, **read/write latency under peak load**, **schema evolution**, and **operational maintenance overhead**.\n` +
        `• **Decision Process**: I have scheduled a 25-minute architecture sync today at **2:00 PM** with the tech lead. We will review the trade-off matrix against these criteria and make the final decision rights determination then.\n\n` +
        `Let's unblock the PR review by documenting the decision criteria in our architecture ADR before the sync.`;

      breakdown = {
        stage1_detect_pause: 'Paused architectural debate in the public channel to prevent polarization.',
        stage2_reappraise_regulate: 'Decoupled ego and personal preference from objective technical criteria.',
        stage3_empathetic_engagement: 'Affirmed the legitimate engineering passion and valid trade-offs of both options.',
        stage4_collaborative_resolution: 'Set a concrete decision meeting today using shared criteria and clear decision rights.'
      };
    }

    // -------------------------------------------------------------
    // SCENARIO 4.4: Executive Pressure & Upward Demands
    // -------------------------------------------------------------
    else if (scenarioNum === '4.4' || goal === 'negotiate_upward_tradeoffs' || rawLower.includes('board demo') || rawLower.includes('work all weekend')) {
      subject = `Re: Board Demo Scope & Capacity Alignment`;
      content = `Hi there,\n\n` +
        `Thank you for the update on the board demo timing. I understand the critical urgency and high stakes of presenting a compelling demonstration on Monday.\n\n` +
        `To ensure we deliver a rock-solid, production-grade presentation without risking system stability or team burnout, we need to align on capacity and trade-offs. Given our current weekend capacity, attempting to rush the entire end-to-end analytics platform creates significant defect and failure risk during the live demo.\n\n` +
        `Here is our proposed trade-off plan to guarantee executive success:\n` +
        `1. **Core Demo Deliverable**: We will commit focused sprint capacity this weekend to polish the high-impact AI executive analytics flows that directly serve the board presentation script.\n` +
        `2. **Secondary Features**: We will defer background administrative workflows and secondary configuration screens to next week's scheduled release.\n` +
        `3. **Staging Verification**: I will share the staging demo walk-through link by **Sunday at 4:00 PM** for your final review and sign-off.\n\n` +
        `Let's confirm this trade-off so the team can focus exclusively on executing the core demo path flawlessly.\n\n` +
        `Best regards,\n` +
        `Engineering Management`;

      breakdown = {
        stage1_detect_pause: 'Acknowledged high-pressure executive demand without defensive pushback.',
        stage2_reappraise_regulate: 'Framed request in terms of delivery risk and objective engineering capacity.',
        stage3_empathetic_engagement: 'Validated the critical importance of the executive board demo.',
        stage4_collaborative_resolution: 'Negotiated clear feature trade-offs within available capacity with Sunday checkpoint.'
      };
    }

    // -------------------------------------------------------------
    // SCENARIO 4.5: Team Burnout & Chronic Overload
    // -------------------------------------------------------------
    else if (scenarioNum === '4.5' || goal === 'diagnose_burnout_and_rebalance_workload' || rawLower.includes('exhaustion') || rawLower.includes('burnout') || rawLower.includes('2 am')) {
      subject = '';
      content = `Hey team — thank you for raising this directly.\n\n` +
        `• **Workload Diagnostics**: Seeing senior engineers working until **2 AM** and missing PR deadlines indicates an unsustainable imbalance between sprint demands and team capacity. We are addressing this immediately.\n` +
        `• **Immediate Prioritization**: I am triaging our sprint queue today to prioritize only mission-critical tickets and defer all non-essential workload to the next cycle.\n` +
        `• **Recovery Boundaries**: **Hard stop at standard working hours** this week. No weekend tickets or late-night PR reviews. Let's protect recovery time while we systematically rebalance the workload.\n\n` +
        `I will follow up in our morning standup with the adjusted sprint scope.`;

      breakdown = {
        stage1_detect_pause: 'Recognized acute burnout signals without dismissing fatigue as individual weakness.',
        stage2_reappraise_regulate: 'Diagnosed systemic structural demands vs recovery resources using JD-R principles.',
        stage3_empathetic_engagement: 'Validated the heavy burden and exhaustion experienced by engineers.',
        stage4_collaborative_resolution: 'Implemented immediate workload de-scoping and protected recovery boundaries.'
      };
    }

    // -------------------------------------------------------------
    // SCENARIO 4.11: Harassment & Safety Escalation
    // -------------------------------------------------------------
    else if (scenarioNum === '4.11' || goal === 'formal_safety_escalation' || rawLower.includes('sexual') || rawLower.includes('harass') || rawLower.includes('hostile')) {
      subject = `CONFIDENTIAL: Formal Escalation & Support Resources`;
      content = `Dear Team Member,\n\n` +
        `Thank you for bringing this matter forward directly. I want to acknowledge your courage in sharing this report, and assure you that your safety, dignity, and well-being are our highest priority.\n\n` +
        `Under organizational policy and statutory guidelines, reports of inappropriate conduct and conditional advancement require immediate formal escalation. We do not conduct informal or private mediation for matters of this nature.\n\n` +
        `Here are the concrete next steps:\n` +
        `1. **Formal Escalation**: I am formally connecting you with our senior HR and Employee Relations leadership today to initiate the appropriate formal investigation pathway.\n` +
        `2. **Protection & Support**: HR will outline all available protection measures, support resources, and reporting protocols to ensure you are fully supported throughout the process.\n` +
        `3. **Confidentiality**: Your report will be handled with strict confidentiality under our governance standards.\n\n` +
        `HR will reach out to you directly today. Please let me know if there are any immediate workspace accommodations or support you need in the meantime.\n\n` +
        `Sincerely,\n` +
        `Leadership & People Operations`;

      breakdown = {
        stage1_detect_pause: 'Paused informal response and recognized statutory safety boundaries.',
        stage2_reappraise_regulate: 'Refused informal mediation in strict compliance with Section 8.0 rules.',
        stage3_empathetic_engagement: 'Acknowledged the reporter with profound psychological safety and institutional protection.',
        stage4_collaborative_resolution: 'Executed immediate formal escalation to HR and Employee Relations.'
      };
    }

    // -------------------------------------------------------------
    // SCENARIO 4.14: Toxic High-Performer Conduct Governance
    // -------------------------------------------------------------
    else if (scenarioNum === '4.14' || goal === 'toxic_high_performer_conduct_governance' || rawLower.includes('top billing') || rawLower.includes('berates')) {
      subject = `Executive Strategic Brief: Toxic High-Performer Conduct Governance`;
      content = `# Executive Strategic Brief: Toxic High-Performer Conduct Governance\n\n` +
        `## 1. Executive Context & Risk Framing\n` +
        `While top commercial revenue generation is recognized, recurring incivility, berating team members, and refusal to comply with core CRM processes create severe organizational culture and business continuity risks.\n\n` +
        `## 2. Decoupling Performance from Conduct\n` +
        `We must clearly decouple sales quota achievement from behavioral conduct standards. High individual revenue cannot excuse conduct that drives team turnover and undermines operational integrity.\n\n` +
        `## 3. Governance & Action Plan\n` +
        `* **Non-Negotiable Standards**: Establish that core behavioral standards and CRM compliance are non-negotiable prerequisites for all employees regardless of billing volume.\n` +
        `* **Formal Performance & Conduct Review**: Schedule a formal review meeting this week outlining explicit conduct expectations and documented consequences for continued incivility.\n` +
        `* **Account Transition Safeguards**: Begin cross-training secondary account leads to mitigate key-person continuity risk.\n` +
        `* **Escalation Boundary**: Any continued incivility triggers formal disciplinary action and leadership escalation.`;

      breakdown = {
        stage1_detect_pause: 'Paused commercial revenue justification to assess structural cultural impact.',
        stage2_reappraise_regulate: 'Decoupled revenue generation from behavioral conduct standards.',
        stage3_empathetic_engagement: 'Recognized psychological impact on supporting teams and customer success managers.',
        stage4_collaborative_resolution: 'Established non-negotiable conduct standards and formal governance checkpoints.'
      };
    }

    // -------------------------------------------------------------
    // DEFAULT CHANNEL-ADAPTIVE MANAGER RESPONSE
    // -------------------------------------------------------------
    else {
      if (effectiveChannel === 'slack') {
        subject = '';
        content = `Hey team — thanks for raising this.\n\n` +
          `• *Context & Priority*: Acknowledging the urgency and impact on current deliverables.\n` +
          `• *Core Alignment*: Focus on immediate operational clarity and clear ownership.\n` +
          `• *Next Action*: I will review the deliverables today and share the confirmed status by 4:00 PM.\n\n` +
          `Let me know if there are any immediate blockers in the meantime.`;
      } else if (effectiveChannel === 'support') {
        subject = `Service Update: Status & Operational Review`;
        content = `Dear Customer,\n\n` +
          `Thank you for contacting our team. We recognize the urgency and the operational friction this situation has caused.\n\n` +
          `Our technical and service leads are actively conducting an operational review today to resolve the issue swiftly.\n\n` +
          `Next Steps:\n` +
          `1. Technical Review: Root-cause inspection underway today.\n` +
          `2. Status Checkpoint: Verified status update provided by 4:00 PM.\n\n` +
          `Thank you for your partnership as we resolve this systematically.\n\n` +
          `Customer Operations Support`;
      } else if (effectiveChannel === 'strategy') {
        subject = `Strategic Brief: ${scenarioTitle}`;
        content = `# Executive Strategic Brief: ${scenarioTitle}\n\n` +
          `## 1. Executive Context & Detection (Stage 1)\n` +
          `Assessing incoming signals to determine operational and organizational risk.\n\n` +
          `## 2. Reappraisal & Risk Framing (Stage 2)\n` +
          `Distinguishing deliverable-level tasks from structural team and governance dynamics.\n\n` +
          `## 3. Stakeholder Alignment & Empathetic Engagement (Stage 3)\n` +
          `Acknowledging urgency and concerns across all affected stakeholder groups.\n\n` +
          `## 4. Collaborative Action Plan (Stage 4)\n` +
          `* **Governing Protocol**: ${citation}\n` +
          `* **Operational Commitments**: Clear milestones and assigned ownership today.\n` +
          `* **Escalation Boundary**: ${escalation}`;
      } else {
        subject = `Re: Operational Update & Next Steps [${scenarioTitle}]`;
        content = `${recipientGreeting}\n\n` +
          `Thank you for reaching out directly regarding this situation. I understand the urgency and the friction this has created for your workflow.\n\n` +
          `I want to separate the immediate operational review from wider concerns so we can resolve this effectively and without delay. I am personally owning the operational review today to ensure all requirements are cleanly aligned.\n\n` +
          `Here is our agreed path forward:\n` +
          `1. Audit: We will verify requirements against current deliverables today.\n` +
          `2. Ownership: Dedicated leads assigned to complete corrective actions.\n` +
          `3. Review: We will review progress and provide updated confirmation by this afternoon.\n\n` +
          `Best regards,\n` +
          `${senderSignoff}`;
      }
    }

    // Apply feedback if revision requested
    if (feedback && feedback.failedCriteria && feedback.failedCriteria.length > 0) {
      if (feedback.failedCriteria.includes('conciseness') && effectiveChannel === 'slack') {
        content = `Team: Acknowledged urgency. Next checkpoint at 4:00 PM today. (Ref: ${citation})`;
      }
      if (feedback.failedCriteria.includes('privacy_safety')) {
        content += `\n\n[Escalation Note: Formal escalation initiated through standard organizational safety/HR process.]`;
      }
    }

    content = this.ensureImportantContentBold(content);

    return {
      subject,
      content,
      four_stage_breakdown: breakdown,
      primaryCitation: citation,
      escalationNotes: escalation
    };
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
  window.LocalEQEngine = LocalEQEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalEQEngine;
}
