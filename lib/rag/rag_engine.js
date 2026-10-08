/**
 * RAG Engine for Managerial EQ Handbook
 * Implements hybrid BM25 + Vector TF-IDF semantic retrieval with citation generation.
 */

class RAGEngine {
  constructor(corpus = [], index = null) {
    this.corpus = corpus;
    this.corpusMap = new Map();
    this.index = index;
    this.stopwords = new Set([
      'the', 'and', 'to', 'of', 'a', 'in', 'is', 'that', 'for', 'it', 'as', 'was',
      'with', 'be', 'by', 'on', 'not', 'he', 'i', 'this', 'are', 'or', 'his',
      'from', 'at', 'which', 'but', 'have', 'an', 'had', 'they', 'you', 'were',
      'their', 'one', 'all', 'we', 'can', 'her', 'has', 'there', 'been', 'if',
      'more', 'when', 'will', 'would', 'who', 'so', 'no', 'do', 'out', 'up', 'my',
      'about', 'into', 'than', 'them', 'some', 'could', 'him', 'into', 'then', 'now'
    ]);

    this.initCorpusMap();
  }

  initCorpusMap() {
    for (const doc of this.corpus) {
      this.corpusMap.set(doc.id, doc);
    }
  }

  setCorpus(corpus, index = null) {
    this.corpus = corpus;
    this.index = index;
    this.initCorpusMap();
  }

  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    const normalized = text.toLowerCase();
    const rawTokens = normalized.match(/[a-z0-9_\-\.\@]+/g) || [];
    return rawTokens.filter(t => t.length > 2 && !this.stopwords.has(t));
  }

  computeVector(tokens) {
    const counts = {};
    for (const t of tokens) {
      counts[t] = (counts[t] || 0) + 1;
    }
    let norm = 0;
    for (const t in counts) {
      const idfVal = (this.index && this.index.idf[t]) ? this.index.idf[t] : 1.0;
      const weight = counts[t] * idfVal;
      norm += weight * weight;
    }
    norm = Math.sqrt(norm) || 1.0;
    return { counts, norm };
  }

  cosineSimilarity(queryVec, docVec) {
    let dot = 0;
    for (const t in queryVec.counts) {
      if (docVec.counts[t]) {
        const idfVal = (this.index && this.index.idf[t]) ? this.index.idf[t] : 1.0;
        const wQ = queryVec.counts[t] * idfVal;
        const wD = docVec.counts[t] * idfVal;
        dot += wQ * wD;
      }
    }
    return dot / (queryVec.norm * docVec.norm || 1.0);
  }

  search(query, options = {}) {
    const topK = options.topK || 4;
    const minScore = options.minScore || 0.1;
    const requiredCategory = options.category || null;

    if (!query || typeof query !== 'string' || !this.corpus.length) {
      return [];
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const k1 = 1.2;
    const b = 0.75;
    const avgDl = (this.index && this.index.avg_doc_length) ? this.index.avg_doc_length : 300;
    const idfTable = (this.index && this.index.idf) ? this.index.idf : {};
    const docTermFreqs = (this.index && this.index.doc_term_freqs) ? this.index.doc_term_freqs : {};
    const docLengths = (this.index && this.index.doc_lengths) ? this.index.doc_lengths : {};

    const bm25Scores = {};
    const queryVec = this.computeVector(queryTokens);

    for (const token of queryTokens) {
      const termIdf = idfTable[token] !== undefined ? idfTable[token] : 0.5;
      const matchingDocs = (this.index && this.index.inverted_index && this.index.inverted_index[token])
        ? this.index.inverted_index[token]
        : this.corpus.filter(d => (d.keywords || []).includes(token)).map(d => d.id);

      for (const docId of matchingDocs) {
        const tf = (docTermFreqs[docId] && docTermFreqs[docId][token]) ? docTermFreqs[docId][token] : 1;
        const dl = docLengths[docId] || 300;
        const score = termIdf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDl)));
        bm25Scores[docId] = (bm25Scores[docId] || 0) + score;
      }
    }

    // Boost exact phrase matches or scenario title matches
    const lowerQuery = query.toLowerCase();
    for (const doc of this.corpus) {
      let boost = 0;
      if (lowerQuery.includes(doc.title.toLowerCase())) {
        boost += 8.0;
      }
      if (doc.category && lowerQuery.includes(doc.category.toLowerCase())) {
        boost += 2.0;
      }
      // Section number match e.g. "4.1" or "§4.1"
      if (lowerQuery.includes(doc.section_number)) {
        boost += 10.0;
      }
      // Match early warning signs
      if (doc.early_warning_signs) {
        const ewsTokens = this.tokenize(doc.early_warning_signs);
        let matchCount = 0;
        for (const qt of queryTokens) {
          if (ewsTokens.includes(qt)) matchCount++;
        }
        if (matchCount > 0) {
          boost += matchCount * 2.5;
        }
      }
      // Specific scenario boosts for specialized managerial terms
      if (doc.section_number === '4.1' && (lowerQuery.includes('outage') || lowerQuery.includes('client') || lowerQuery.includes('sue') || lowerQuery.includes('contract'))) {
        boost += 5.0;
      }
      if (doc.section_number === '4.2' && (lowerQuery.includes('architecture') || lowerQuery.includes('disagree') || lowerQuery.includes('pr is blocked'))) {
        boost += 5.0;
      }
      if (doc.section_number === '4.4' && (lowerQuery.includes('board demo') || lowerQuery.includes('weekend') || lowerQuery.includes('make it happen'))) {
        boost += 5.0;
      }
      if (doc.section_number === '4.5' && (lowerQuery.includes('exhaustion') || lowerQuery.includes('overload') || lowerQuery.includes('burnout') || lowerQuery.includes('2 am'))) {
        boost += 5.0;
      }
      if (doc.section_number === '4.11' && (lowerQuery.includes('sexual') || lowerQuery.includes('harassment') || lowerQuery.includes('friendly'))) {
        boost += 6.0;
      }
      if (doc.section_number === '4.14' && (lowerQuery.includes('berates') || lowerQuery.includes('turnover') || lowerQuery.includes('billing') || lowerQuery.includes('toxic') || lowerQuery.includes('conduct'))) {
        boost += 6.0;
      }
      if (boost > 0) {
        bm25Scores[doc.id] = (bm25Scores[doc.id] || 0) + boost;
      }
    }

    // Normalize BM25 scores
    let maxBm25 = 0.001;
    for (const id in bm25Scores) {
      if (bm25Scores[id] > maxBm25) maxBm25 = bm25Scores[id];
    }

    // Calculate Hybrid Score
    const results = [];
    for (const doc of this.corpus) {
      if (requiredCategory && doc.category !== requiredCategory) continue;

      const rawBm25 = bm25Scores[doc.id] || 0;
      const normBm25 = rawBm25 / maxBm25;

      // Fast document vector for cosine similarity
      const docTokens = (this.index && this.index.doc_term_freqs && this.index.doc_term_freqs[doc.id])
        ? Object.keys(this.index.doc_term_freqs[doc.id])
        : (doc.keywords || []);
      const docVec = this.computeVector(docTokens);
      const cosine = this.cosineSimilarity(queryVec, docVec);

      const hybridScore = (normBm25 * 0.65) + (cosine * 0.35);

      if (hybridScore >= minScore || rawBm25 > 0) {
        results.push({
          id: doc.id,
          section_number: doc.section_number,
          title: doc.title,
          category: doc.category,
          citation: doc.citation || `[Managerial EQ Handbook §${doc.section_number}: ${doc.title}]`,
          evidence_base: doc.evidence_base,
          four_stages: doc.four_stages,
          manager_script: doc.manager_script,
          what_not_to_do: doc.what_not_to_do,
          escalation_boundary: doc.escalation_boundary,
          follow_up: doc.follow_up,
          excerpt: this.extractExcerpt(doc.content, queryTokens),
          score: Math.round(hybridScore * 100) / 100,
          raw_bm25: Math.round(rawBm25 * 100) / 100,
          cosine: Math.round(cosine * 100) / 100
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  extractExcerpt(content, tokens, maxLength = 280) {
    if (!content) return '';
    const clean = content.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;

    const lower = clean.toLowerCase();
    let bestIndex = 0;
    for (const t of tokens) {
      const idx = lower.indexOf(t);
      if (idx !== -1) {
        bestIndex = Math.max(0, idx - 40);
        break;
      }
    }

    let snippet = clean.substring(bestIndex, bestIndex + maxLength);
    if (bestIndex > 0) snippet = '...' + snippet;
    if (bestIndex + maxLength < clean.length) snippet = snippet + '...';
    return snippet;
  }

  formatCitationMarkdown(results) {
    if (!results || results.length === 0) return '_No explicit handbook section cited._';
    return results.map(r => {
      let md = `> **${r.citation}** (Relevance: ${Math.round(r.score * 100)}%)\n`;
      if (r.evidence_base) {
        md += `> _Evidence Base_: ${r.evidence_base}\n`;
      }
      if (r.manager_script) {
        md += `> _Authoritative Script_: "${r.manager_script}"\n`;
      }
      if (r.escalation_boundary) {
        md += `> _Escalation Rule_: ${r.escalation_boundary}\n`;
      }
      return md;
    }).join('\n\n');
  }
}

if (typeof window !== 'undefined') {
  window.RAGEngine = RAGEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RAGEngine;
}
