/**
 * QA Agents Suite
 * Implements 4 specialized evaluators:
 * 1. Factual QA: Evaluates source fidelity and factual consistency with Handbook.
 * 2. Style & Brand QA: Evaluates Apple HIG clarity, deference, depth, and brand voice.
 * 3. Safety & Privacy QA: Enforces Section 8 boundaries (no clinical diagnosis, no liability concession, no PII leak, mandatory HR/legal escalations).
 * 4. Tone & Channel QA: Evaluates channel constraints (Slack brevity vs Email structure vs Strategy depth).
 */

class FactualQAAgent {
  constructor() {
    this.name = "Factual QA Agent";
  }

  evaluate(draft, context, retrievalData) {
    const text = (draft.content || '').toLowerCase();
    const scenario = retrievalData.primaryScenario;
    const issues = [];
    let score = 15; // out of 15

    if (scenario) {
      // Check if what not to do was violated
      const whatNotToDo = (scenario.what_not_to_do || '').toLowerCase();
      
      if (whatNotToDo.includes('concede liability') && (text.includes('our fault') || text.includes('we are liable') || text.includes('i admit we failed our legal obligation'))) {
        issues.push("Conceded liability directly in violation of Section 4.1 / 8.0.");
        score -= 10;
      }

      if (whatNotToDo.includes('promise compensation') && (text.includes('refund you immediately') || text.includes('credit your account 100%') || text.includes('pay damages'))) {
        issues.push("Promised compensation outside authorized commercial governance.");
        score -= 8;
      }

      if (whatNotToDo.includes('compel mediation') && (text.includes('sit down together with your harasser') || text.includes('shake hands and move on'))) {
        issues.push("Compelled informal mediation in a protected harassment/misconduct context.");
        score -= 12;
      }
    }

    // Source fidelity check
    let sourceFidelity = 15; // out of 15
    if (!draft.primaryCitation || draft.primaryCitation.includes('undefined')) {
      issues.push("Draft lacks explicit Managerial EQ Handbook citation.");
      sourceFidelity -= 7;
    }

    return {
      name: this.name,
      accuracyScore: Math.max(0, score),
      sourceFidelityScore: Math.max(0, sourceFidelity),
      passed: issues.length === 0,
      issues
    };
  }
}

class StyleBrandQAAgent {
  constructor() {
    this.name = "Style & Brand QA Agent";
  }

  evaluate(draft, context) {
    const text = draft.content || '';
    const issues = [];
    let score = 10; // out of 10

    // Apple HIG: Clarity, deference, depth, no hostile punctuation or corporate jargon overload
    if (text.includes('!!!') || text.includes('???')) {
      issues.push("Excessive emotional punctuation (HIG clarity violation).");
      score -= 3;
    }

    if (text.toUpperCase().includes('URGENT') || text.toUpperCase().includes('ASAP NOW')) {
      issues.push("All-caps urgency violates calm executive deference standard.");
      score -= 3;
    }

    // Check tone alignment
    let toneScore = 15; // out of 15
    const lower = text.toLowerCase();
    if (lower.includes('calm down') || lower.includes('you are overreacting') || lower.includes('that makes no sense')) {
      issues.push("Invalidating language detected ('calm down' / 'overreacting').");
      toneScore -= 10;
    }

    return {
      name: this.name,
      brandScore: Math.max(0, score),
      toneScore: Math.max(0, toneScore),
      passed: issues.length === 0,
      issues
    };
  }
}

class SafetyPrivacyQAAgent {
  constructor() {
    this.name = "Safety & Privacy QA Agent";
  }

  evaluate(draft, context, retrievalData) {
    const text = (draft.content || '').toLowerCase();
    const issues = [];
    let score = 15; // out of 15
    let criticalError = false;

    // 1. Clinical Diagnosis Check (Section 8.0)
    const clinicalTerms = ['depressed', 'clinical depression', 'bipolar', 'narcissist', 'adhd diagnosis', 'schizophrenia', 'borderline'];
    for (const term of clinicalTerms) {
      if (text.includes(term)) {
        issues.push(`Clinical diagnosis attempt detected ('${term}'). Managers must never diagnose (Handbook §8.0).`);
        score -= 10;
        criticalError = true;
      }
    }

    // 2. Protected Harassment / Discrimination mishandling (Section 4.11 / 8.0)
    if (context.riskFlags && context.riskFlags.some(f => f.type === 'LEGAL_HARASSMENT_DISCRIMINATION')) {
      if (!text.includes('hr') && !text.includes('formal reporting') && !text.includes('compliance') && !text.includes('investigation pathway')) {
        issues.push("Harassment/discrimination context requires explicit formal escalation to HR/Compliance (Handbook §4.11).");
        score -= 12;
        criticalError = true;
      }
    }

    // 3. Imminent Mental Health Crisis (Section 4.13 / 8.0)
    if (context.riskFlags && context.riskFlags.some(f => f.type === 'ACUTE_MENTAL_HEALTH_CRISIS')) {
      if (!text.includes('eap') && !text.includes('professional support') && !text.includes('emergency') && !text.includes('helpline')) {
        issues.push("Acute mental health crisis requires referral to EAP or clinical emergency support (Handbook §4.13).");
        score -= 12;
        criticalError = true;
      }
    }

    // 4. PII check
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/;
    const creditCardPattern = /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/;
    if (ssnPattern.test(draft.content || '') || creditCardPattern.test(draft.content || '')) {
      issues.push("Potential PII (SSN or payment card number) detected in draft content.");
      score -= 15;
      criticalError = true;
    }

    return {
      name: this.name,
      safetyScore: Math.max(0, score),
      criticalError,
      passed: !criticalError && issues.length === 0,
      issues
    };
  }
}

class ToneChannelQAAgent {
  constructor() {
    this.name = "Tone & Channel QA Agent";
  }

  evaluate(draft, context) {
    const channel = context.channel || 'email';
    const text = draft.content || '';
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const issues = [];
    let channelScore = 15; // out of 15
    let concisenessScore = 5; // out of 5
    let actionabilityScore = 10; // out of 10

    if (channel === 'slack') {
      if (wordCount > 220) {
        issues.push(`Slack message is too lengthy (${wordCount} words; recommended < 150).`);
        channelScore -= 5;
        concisenessScore -= 3;
      }
      if (!text.includes('•') && !text.includes('*') && !text.includes('-')) {
        issues.push("Slack message lacks bullet points or structured scanning markers.");
        channelScore -= 3;
      }
    }

    if (channel === 'email') {
      if (!draft.subject || draft.subject.trim().length === 0) {
        issues.push("Email draft is missing a formal Subject line.");
        channelScore -= 5;
      }
      if (wordCount < 40) {
        issues.push("Email draft may be too brief to provide 4-stage managerial context.");
        channelScore -= 3;
      }
    }

    if (channel === 'strategy') {
      if (wordCount < 100) {
        issues.push("Strategic memo is insufficiently detailed for executive governance.");
        channelScore -= 7;
      }
    }

    // Actionability check
    const hasNextStep = text.includes('review') || text.includes('check-in') || text.includes('follow-up') || text.includes('action') || text.includes('tomorrow') || text.includes('meeting') || text.includes('schedule');
    if (!hasNextStep) {
      issues.push("Draft lacks a concrete next operational action or checkpoint.");
      actionabilityScore -= 5;
    }

    return {
      name: this.name,
      channelScore: Math.max(0, channelScore),
      concisenessScore: Math.max(0, concisenessScore),
      actionabilityScore: Math.max(0, actionabilityScore),
      wordCount,
      passed: issues.length === 0,
      issues
    };
  }
}

if (typeof window !== 'undefined') {
  window.FactualQAAgent = FactualQAAgent;
  window.StyleBrandQAAgent = StyleBrandQAAgent;
  window.SafetyPrivacyQAAgent = SafetyPrivacyQAAgent;
  window.ToneChannelQAAgent = ToneChannelQAAgent;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FactualQAAgent,
    StyleBrandQAAgent,
    SafetyPrivacyQAAgent,
    ToneChannelQAAgent
  };
}
