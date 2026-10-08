/**
 * Retrieval Agent
 * Queries the primary source of truth (Managerial EQ Handbook RAG corpus),
 * extracts relevant scenario protocols, 4-stage models, and escalation boundaries.
 */

class RetrievalAgent {
  constructor(ragEngine) {
    this.name = "Retrieval Agent";
    this.role = "Primary Source-of-Truth Knowledge Retrieval";
    this.ragEngine = ragEngine;
  }

  async retrieve(query, context = {}) {
    const searchQuery = [
      query,
      context.goal || '',
      context.rawText ? context.rawText.substring(0, 200) : ''
    ].join(' ').trim();

    const results = this.ragEngine.search(searchQuery, {
      topK: 4,
      minScore: 0.12
    });

    // Identify primary scenario match
    let primaryMatch = null;
    const scenarioMatches = results.filter(r => r.section_number && r.section_number.startsWith('4.'));
    if (scenarioMatches.length > 0) {
      primaryMatch = scenarioMatches[0];
    } else if (results.length > 0) {
      primaryMatch = results[0];
    }

    // Always fetch Universal 4-Stage Model if not already included
    let universalModel = results.find(r => r.section_number === '2.0');
    if (!universalModel) {
      const uResults = this.ragEngine.search('Universal 4-Stage Real-Time Manager Response Model', { topK: 1 });
      if (uResults.length > 0) universalModel = uResults[0];
    }

    // Extract boundaries & JD-R if relevant
    const boundaryDoc = results.find(r => r.section_number === '8.0');
    const jdrDoc = results.find(r => r.section_number === '1.2' || r.section_number === '3.1');

    const allCitations = results.map(r => r.citation);
    if (primaryMatch && primaryMatch.citation && !allCitations.includes(primaryMatch.citation)) {
      allCitations.unshift(primaryMatch.citation);
    }
    if (universalModel && universalModel.citation && !allCitations.includes(universalModel.citation)) {
      allCitations.push(universalModel.citation);
    }

    return {
      query: searchQuery,
      totalRetrieved: results.length,
      primaryScenario: primaryMatch ? {
        id: primaryMatch.id,
        section_number: primaryMatch.section_number,
        title: primaryMatch.title,
        category: primaryMatch.category,
        citation: primaryMatch.citation,
        evidence_base: primaryMatch.evidence_base,
        four_stages: primaryMatch.four_stages,
        manager_script: primaryMatch.manager_script,
        what_not_to_do: primaryMatch.what_not_to_do,
        escalation_boundary: primaryMatch.escalation_boundary,
        relevance_score: primaryMatch.score
      } : null,
      universalModel: universalModel ? {
        citation: universalModel.citation,
        stages: universalModel.four_stages
      } : null,
      boundaryDoc: boundaryDoc ? boundaryDoc.citation : null,
      jdrDoc: jdrDoc ? jdrDoc.citation : null,
      retrievedSections: results,
      citationsFormatted: this.ragEngine.formatCitationMarkdown(results),
      citationList: allCitations
    };
  }
}

if (typeof window !== 'undefined') {
  window.RetrievalAgent = RetrievalAgent;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RetrievalAgent;
}
