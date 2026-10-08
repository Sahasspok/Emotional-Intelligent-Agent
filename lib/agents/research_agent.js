/**
 * Research Agent
 * Conducts independent organizational and behavioral research,
 * synthesizes peer-reviewed evidence (Jordan & Troth, Edmondson, Bakker & Demerouti, Gross),
 * and enforces the rule: "Source of truth wins unless user overrides."
 */

class ResearchAgent {
  constructor() {
    this.name = "Research Agent";
    this.role = "Independent Research & Academic Evidence Synthesizer";

    // Known evidence repository aligning with managerial organizational behavior
    this.evidenceRepo = {
      'client_escalation': {
        framework: "Hostile Negotiation & Cognitive De-escalation (Thomas, 1977; Gross, 1998)",
        keyInsight: "Cognitive reappraisal prevents defensive escalation. Acknowledging emotional impact while holding operational and legal boundaries prevents premature liability concession.",
        citation: "Gross, J. J. (1998). The emerging field of emotion regulation. Review of General Psychology, 2(3), 271-299."
      },
      'task_conflict': {
        framework: "Task vs Relationship Conflict Model (Jehn & Mannix, 2001; Jordan & Troth, 2002)",
        keyInsight: "Task conflict improves team performance when psychological safety is high. Emotion regulation prevents task disagreements from degenerating into relationship attacks.",
        citation: "Jehn, K. A., & Mannix, E. A. (2001). The dynamic nature of conflict. Academy of Management Journal, 44(2), 238-251."
      },
      'burnout_overload': {
        framework: "Job Demands-Resources (JD-R) Theory (Bakker & Demerouti, 2007)",
        keyInsight: "Burnout is a structural mismatch between demands and resources. Prescribing mindfulness or emotional intelligence to an overloaded team without reducing demands increases cynicism.",
        citation: "Bakker, A. B., & Demerouti, E. (2007). The Job Demands-Resources model: State of the art. Journal of Managerial Psychology, 22(3), 309-328."
      },
      'upward_pressure': {
        framework: "Assertive Boundary Setting & Psychological Safety (Edmondson, 1999; Thomas, 1977)",
        keyInsight: "Saying 'no' defensively damages upward trust. Framing constraints as explicit trade-offs ('Option A vs Option B with verifiable consequences') invites the executive into the decision rights.",
        citation: "Edmondson, A. (1999). Psychological safety and learning behavior in work teams. Administrative Science Quarterly, 44(2), 350-383."
      },
      'harassment_safety': {
        framework: "Statutory Duty of Care & Anti-Retaliation Governance (EEOC Guidance)",
        keyInsight: "Managers have a non-delegable duty to report protected complaints immediately. Informal resolution or forced mediation exposes the organization and victim to severe legal harm.",
        citation: "Equal Employment Opportunity Commission (EEOC). Enforcement Guidance on Vicarious Employer Liability for Unlawful Harassment by Supervisors."
      }
    };
  }

  async synthesize(retrievalData, context = {}) {
    const goal = context.goal || 'professional_reply';
    let matchedResearch = null;

    if (goal.includes('escalat')) {
      matchedResearch = this.evidenceRepo.client_escalation;
    } else if (goal.includes('conflict')) {
      matchedResearch = this.evidenceRepo.task_conflict;
    } else if (goal.includes('burnout') || goal.includes('overload')) {
      matchedResearch = this.evidenceRepo.burnout_overload;
    } else if (goal.includes('upward') || goal.includes('tradeoff')) {
      matchedResearch = this.evidenceRepo.upward_pressure;
    } else if (goal.includes('safety') || goal.includes('harass')) {
      matchedResearch = this.evidenceRepo.harassment_safety;
    } else {
      matchedResearch = this.evidenceRepo.task_conflict;
    }

    // Check for conflicts with Primary Source of Truth
    const conflictAudits = [];
    if (retrievalData.primaryScenario) {
      const whatNotToDo = retrievalData.primaryScenario.what_not_to_do || '';
      const escalationBoundary = retrievalData.primaryScenario.escalation_boundary || '';

      // Test common conflict scenarios
      if (whatNotToDo.toLowerCase().includes('concede liability') || whatNotToDo.toLowerCase().includes('promise compensation')) {
        conflictAudits.push({
          issue: "Liability / Commercial Concession",
          externalView: "Some customer service models recommend immediate unconditional concessions/refunds to delight the customer.",
          sourceOfTruthRule: "Handbook §4.1 strictly forbids conceding liability or promising compensation outside delegated authority. Separate operational fix from commercial remedy.",
          resolution: "SOURCE OF TRUTH WINS: Operational review committed; commercial remedies routed through formal legal/commercial channels."
        });
      }

      if (whatNotToDo.toLowerCase().includes('compel mediation') || whatNotToDo.toLowerCase().includes('informal investigation')) {
        conflictAudits.push({
          issue: "Informal Resolution vs Protected Escalation",
          externalView: "General interpersonal conflict books recommend hearing both sides together in an open circle.",
          sourceOfTruthRule: "Handbook §4.11 / §8.0 strictly forbids informal mediation for harassment, discrimination, or threats. Immediate formal escalation required.",
          resolution: "SOURCE OF TRUTH WINS: Mandatory HR/EEO escalation pathway enforced without private informal mediation."
        });
      }
    }

    return {
      independentFramework: matchedResearch.framework,
      keyScientificInsight: matchedResearch.keyInsight,
      academicCitation: matchedResearch.citation,
      conflictAudits: conflictAudits,
      ruleApplied: "Primary Source of Truth (Managerial EQ Handbook) has absolute precedence over external hypotheses."
    };
  }
}

if (typeof window !== 'undefined') {
  window.ResearchAgent = ResearchAgent;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResearchAgent;
}
