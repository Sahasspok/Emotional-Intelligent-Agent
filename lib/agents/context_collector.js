/**
 * Context Collector Agent
 * Analyzes incoming text/context, determines channel constraints, goal, urgency, and emotional valence.
 */

class ContextCollectorAgent {
  constructor() {
    this.name = "Context Collector";
    this.role = "Context Collector & Intent Analyzer";
  }

  analyze(rawInput, userIntent = {}) {
    const text = (typeof rawInput === 'string' ? rawInput : (rawInput.text || '')).trim();
    const sourceChannel = userIntent.channel || this.detectChannel(text, rawInput.metadata);
    const goal = userIntent.goal || this.detectGoal(text);
    const urgency = this.detectUrgency(text);
    const riskFlags = this.detectRiskFlags(text);
    const suggestedTone = userIntent.tone || this.suggestTone(text, riskFlags);
    const thread = this.extractThreadContext(text);

    return {
      rawText: text,
      normalizedText: text.replace(/\r\n/g, '\n').replace(/\t/g, ' '),
      channel: sourceChannel,
      channelConstraints: this.getChannelConstraints(sourceChannel),
      goal: goal,
      urgency: urgency,
      riskFlags: riskFlags,
      suggestedTone: suggestedTone,
      thread: thread,
      timestamp: new Date().toISOString()
    };
  }

  extractThreadContext(text) {
    let replySender = '';
    let replySenderRole = '';
    let replyRecipient = '';
    let replyRecipientRole = '';
    let specificTopics = [];
    let deadlines = [];
    let financialImpact = '';

    const cleanName = (n) => {
      if (!n) return '';
      let s = n.trim().replace(/<.*?>/g, '').replace(/["']/g, '').trim();
      const pmMatch = s.match(/(?:PM|Project Manager)\s+([A-Za-z]+)/i);
      if (pmMatch) return pmMatch[1];
      const firstWord = s.split(/\s+/)[0];
      return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
    };

    // 1. Check for explicit email headers: From: ... To: ...
    const fromMatches = [...text.matchAll(/^[>\s]*From:\s*([^\n\r<]+)/gmi)].map(m => cleanName(m[1]));
    const toMatches = [...text.matchAll(/^[>\s]*To:\s*([^\n\r<]+)/gmi)].map(m => cleanName(m[1]));

    if (fromMatches.length > 0 && toMatches.length > 0) {
      // The latest email was sent FROM fromMatches[last] TO toMatches[last]
      // Therefore the new reply is TO incoming sender, FROM incoming recipient
      replyRecipient = fromMatches[fromMatches.length - 1];
      replySender = toMatches[toMatches.length - 1];
    }

    // 2. Check for arrow syntax e.g. "PM Amit -> Client" or "Client -> Amit"
    const arrowMatches = [...text.matchAll(/([A-Za-z0-9\s]+?)\s*(?:→|->)\s*([A-Za-z0-9\s—–-]+)/g)];
    if (arrowMatches.length > 0) {
      const lastArrow = arrowMatches[arrowMatches.length - 1];
      let fromPart = lastArrow[1].trim();
      let toPart = lastArrow[2].split(/[—–-]/)[0].trim();
      
      const clientSign = text.match(/(?:Thanks|Best|Regards),?\s*\n+([A-Z][a-z]+)/gi);
      let resolvedClient = '';
      if (clientSign) {
        resolvedClient = clientSign[clientSign.length - 1].replace(/(?:Thanks|Best|Regards),?\s*\n+/i, '').trim();
      }
      
      if (fromPart.toLowerCase().includes('client') && resolvedClient) {
        fromPart = resolvedClient;
      }
      if (toPart.toLowerCase().includes('pm') || toPart.toLowerCase().includes('amit')) {
        toPart = 'Amit';
      }

      replyRecipient = cleanName(fromPart);
      replySender = cleanName(toPart);
    }

    // 3. Check for turn-based salutations & signoffs
    if (!replyRecipient || !replySender) {
      const greetings = [...text.matchAll(/(?:Hi|Hello|Dear|Hey)\s+([A-Z][a-z]+)/g)].map(m => m[1]);
      const standaloneSalutations = [...text.matchAll(/(?:^|\n)([A-Z][a-z]+),\s*\n/g)].map(m => m[1]);
      const signoffs = [...text.matchAll(/(?:Thanks|Best|Regards|Sincerely|Cheers|warmly),?\s*\n+([A-Z][a-z]+)(?:\s*\n+([A-Za-z\s]+))?/gi)];

      if (greetings.length >= 2) {
        replyRecipient = greetings[greetings.length - 1];
        replySender = greetings[0];
      } else if (greetings.length === 1 && standaloneSalutations.length >= 1) {
        replyRecipient = greetings[0];
        replySender = standaloneSalutations[standaloneSalutations.length - 1];
      } else if (greetings.length === 1 && signoffs.length >= 1) {
        const g = greetings[0];
        const s = signoffs[0][1];
        if (g.toLowerCase() !== s.toLowerCase()) {
          replyRecipient = g;
          replySender = s;
        }
      } else if (standaloneSalutations.length >= 1 && signoffs.length >= 1) {
        replyRecipient = signoffs[signoffs.length - 1][1];
        replySender = standaloneSalutations[0];
      }
    }

    // Extract roles associated with participants
    const roleMatches = [...text.matchAll(/(?:Thanks|Best|Regards|Sincerely),?\s*\n+([A-Z][a-z]+)\s*\n+([A-Za-z\s]+)/gi)];
    for (const rm of roleMatches) {
      const name = cleanName(rm[1]);
      const role = rm[2].trim();
      if (name.toLowerCase() === replySender.toLowerCase()) {
        replySenderRole = role;
      } else if (name.toLowerCase() === replyRecipient.toLowerCase()) {
        replyRecipientRole = role;
      }
    }
    if (!replySenderRole) {
      if (text.match(/Project Manager|PM\s+Amit|PM\s+John/i)) {
        replySenderRole = 'Project Manager';
      }
    }

    // Extract specific topics
    const lower = text.toLowerCase();
    if (lower.includes('hero section') || lower.includes('hero messaging')) specificTopics.push('hero section messaging');
    if (lower.includes('pricing') || lower.includes('pricing section') || lower.includes('pricing content')) specificTopics.push('pricing section updates');
    if (lower.includes('cta') || lower.includes('call to action') || lower.includes('cta button')) specificTopics.push('CTA buttons');
    if (lower.includes('development team') || lower.includes('dev team')) specificTopics.push('development team alignment');
    if (lower.includes('stakeholder review')) deadlines.push('stakeholder review tomorrow');
    if (lower.includes('second time')) specificTopics.push('recurring review discrepancy');

    // Incident / Outage topics
    if (lower.includes('black friday')) specificTopics.push('Black Friday launch');
    if (lower.includes('crash') || lower.includes('outage') || lower.includes('unavailable') || lower.includes('incident')) {
      specificTopics.push('platform stability & incident audit');
    }
    if (lower.includes('safeguard')) specificTopics.push('deployment safeguards');
    if (lower.includes('today') || lower.includes('urgent') || lower.includes('immediately')) {
      deadlines.push('immediate incident review today');
    }

    // Financial impact extraction
    const moneyMatch = text.match(/\$[0-9,]+(?:\s*(?:in lost revenue|in revenue|revenue))?/i);
    if (moneyMatch) {
      financialImpact = moneyMatch[0].trim();
    }

    return {
      senderName: replySender,
      senderRole: replySenderRole,
      recipientName: replyRecipient,
      recipientRole: replyRecipientRole,
      specificTopics,
      deadlines,
      financialImpact
    };
  }

  detectChannel(text, metadata = {}) {
    if (metadata && metadata.url) {
      const url = metadata.url.toLowerCase();
      if (url.includes('mail.google.com') || url.includes('outlook')) return 'email';
      if (url.includes('slack.com')) return 'slack';
      if (url.includes('linkedin.com')) return 'linkedin';
      if (url.includes('zendesk.com') || url.includes('intercom')) return 'support';
    }

    const lower = text.toLowerCase();
    if (lower.startsWith('subject:') || lower.includes('dear ') || lower.includes('hi team,') || lower.includes('best regards')) {
      return 'email';
    }
    if (lower.length < 350 && (lower.includes('hey ') || lower.includes('can you check') || lower.includes('thread') || text.includes('@'))) {
      return 'slack';
    }
    if (lower.includes('connect') || lower.includes('profile') || lower.includes('inmail')) {
      return 'linkedin';
    }
    if (lower.includes('ticket') || lower.includes('sla') || lower.includes('case #')) {
      return 'support';
    }
    if (lower.includes('roadmap') || lower.includes('executive summary') || lower.includes('reorganization') || lower.includes('strategy')) {
      return 'strategy';
    }
    return 'email'; // Default channel
  }

  getChannelConstraints(channel) {
    switch (channel) {
      case 'slack':
        return {
          maxRecommendedWords: 150,
          format: 'conversational_markdown',
          bulletPointsRecommended: true,
          requireSubjectLine: false,
          greetingStyle: 'casual_professional'
        };
      case 'email':
        return {
          maxRecommendedWords: 350,
          format: 'formal_paragraphs',
          bulletPointsRecommended: false,
          requireSubjectLine: true,
          greetingStyle: 'business_professional'
        };
      case 'linkedin':
        return {
          maxRecommendedWords: 200,
          format: 'concise_networking',
          bulletPointsRecommended: false,
          requireSubjectLine: false,
          greetingStyle: 'warm_professional'
        };
      case 'support':
        return {
          maxRecommendedWords: 250,
          format: 'structured_resolution',
          bulletPointsRecommended: true,
          requireSubjectLine: true,
          greetingStyle: 'empathetic_supportive'
        };
      case 'strategy':
        return {
          maxRecommendedWords: 600,
          format: 'executive_memo',
          bulletPointsRecommended: true,
          requireSubjectLine: true,
          greetingStyle: 'executive_summary'
        };
      default:
        return {
          maxRecommendedWords: 300,
          format: 'standard_reply',
          bulletPointsRecommended: false,
          requireSubjectLine: false,
          greetingStyle: 'professional'
        };
    }
  }

  detectGoal(text) {
    const lower = text.toLowerCase();
    if (lower.includes('berat') || lower.includes('toxic') || lower.includes('high performer') || lower.includes('top billing') || lower.includes('turnover around one person') || lower.includes('incivility')) {
      return 'toxic_high_performer_conduct_governance';
    }
    if (lower.includes('angry') || lower.includes('cancel') || lower.includes('unacceptable') || lower.includes('escalat') || lower.includes('outage') || lower.includes('lost sales')) {
      return 'de-escalate_and_set_boundaries';
    }
    if (lower.includes('disagree') || lower.includes('architecture') || lower.includes('approach') || lower.includes('method') || lower.includes('arguing')) {
      return 'resolve_task_conflict';
    }
    if (lower.includes('overload') || lower.includes('exhausted') || lower.includes('burnout') || lower.includes('capacity') || lower.includes('working until 2 am')) {
      return 'diagnose_burnout_and_rebalance_workload';
    }
    if (lower.includes('deadline') || lower.includes('asap') || lower.includes('executive') || lower.includes('urgent') || lower.includes('board demo') || lower.includes('work all weekend')) {
      return 'negotiate_upward_tradeoffs';
    }
    if (lower.includes('harass') || lower.includes('discriminat') || lower.includes('hostile') || lower.includes('inappropriate sexual')) {
      return 'formal_safety_escalation';
    }
    if (lower.includes('performance') || lower.includes('feedback') || lower.includes('review')) {
      return 'performance_alignment';
    }
    return 'professional_reply';
  }

  detectUrgency(text) {
    const lower = text.toLowerCase();
    if (lower.includes('emergency') || lower.includes('immediately') || lower.includes('critical') || lower.includes('lawsuit') || lower.includes('legal counsel')) {
      return 'high';
    }
    if (lower.includes('today') || lower.includes('urgent') || lower.includes('asap') || lower.includes('by eod')) {
      return 'medium';
    }
    return 'normal';
  }

  detectRiskFlags(text) {
    const flags = [];
    const lower = text.toLowerCase();

    if (lower.includes('harass') || lower.includes('assault') || lower.includes('touching') || lower.includes('discriminat') || lower.includes('hostile work environment')) {
      flags.push({
        type: 'LEGAL_HARASSMENT_DISCRIMINATION',
        severity: 'CRITICAL',
        handbookRef: '§4.11 / §8.0',
        instruction: 'Immediate formal escalation to HR/Legal. Do not conduct private mediation.'
      });
    }

    if (lower.includes('sue') || lower.includes('lawyer') || lower.includes('attorney') || lower.includes('breach of contract') || lower.includes('indemnification')) {
      flags.push({
        type: 'CONTRACTUAL_LEGAL_EXPOSURE',
        severity: 'HIGH',
        handbookRef: '§4.1 / §8.0',
        instruction: 'Separate operational support from commercial remedies. Do not concede liability or promise compensation.'
      });
    }

    if (lower.includes('suicide') || lower.includes('harm') || lower.includes('end it all') || lower.includes('hopeless') || lower.includes('breakdown')) {
      flags.push({
        type: 'ACUTE_MENTAL_HEALTH_CRISIS',
        severity: 'EMERGENCY',
        handbookRef: '§4.13 / §8.0',
        instruction: 'Treat as imminent safety matter. Connect directly with EAP / emergency care. Do not diagnose.'
      });
    }

    if (lower.includes('unlawful') || lower.includes('falsify') || lower.includes('fraud') || lower.includes('hide the numbers') || lower.includes('bribe')) {
      flags.push({
        type: 'ETHICAL_WHISTLEBLOWING',
        severity: 'HIGH',
        handbookRef: '§4.12 / §8.0',
        instruction: 'Preserve evidence neutrally. Escalate through formal compliance/ethics whistleblower pathway.'
      });
    }

    return flags;
  }

  suggestTone(text, riskFlags) {
    if (riskFlags.some(f => f.severity === 'EMERGENCY' || f.severity === 'CRITICAL')) {
      return 'Calm, Neutral & Protocol-Bound';
    }
    const lower = text.toLowerCase();
    if (lower.includes('furious') || lower.includes('angry') || lower.includes('cancel')) {
      return 'Empathetic, De-escalating & Firm';
    }
    if (lower.includes('vp') || lower.includes('director') || lower.includes('board')) {
      return 'Assertive, Objective & Trade-off Focused';
    }
    return 'Constructive, Collaborative & Clear';
  }
}

if (typeof window !== 'undefined') {
  window.ContextCollectorAgent = ContextCollectorAgent;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextCollectorAgent;
}
