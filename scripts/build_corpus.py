#!/usr/bin/env python3
"""
Refined Corpus builder for Managerial EQ Handbook.
Parses /Users/moderntechnepal/Downloads/Managerial_EQ_Handbook_FINAL.docx
into normalized, tokenized, chunked, and indexed RAG corpus files.
"""

import zipfile
import xml.etree.ElementTree as ET
import json
import re
import os
import math

DOCX_PATH = '/Users/moderntechnepal/Downloads/Managerial_EQ_Handbook_FINAL.docx'
OUTPUT_DIR = '/Users/moderntechnepal/agentic-eq-reply-extension/lib/rag'

def extract_paragraphs(docx_path):
    with zipfile.ZipFile(docx_path) as docx:
        tree = ET.fromstring(docx.read('word/document.xml'))
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        paragraphs = []
        for p in tree.iterfind('.//w:p', ns):
            texts = [node.text for node in p.iterfind('.//w:t', ns) if node.text]
            if texts:
                t = ''.join(texts).strip()
                if t:
                    paragraphs.append(t)
    return paragraphs

def tokenize(text):
    text = text.lower()
    # Normalize punctuation
    tokens = re.findall(r'[a-z0-9_\-\.\@]+', text)
    stopwords = {
        'the', 'and', 'to', 'of', 'a', 'in', 'is', 'that', 'for', 'it', 'as', 'was',
        'with', 'be', 'by', 'on', 'not', 'he', 'i', 'this', 'are', 'or', 'his',
        'from', 'at', 'which', 'but', 'have', 'an', 'had', 'they', 'you', 'were',
        'their', 'one', 'all', 'we', 'can', 'her', 'has', 'there', 'been', 'if',
        'more', 'when', 'will', 'would', 'who', 'so', 'no', 'do', 'out', 'up', 'my',
        'about', 'into', 'than', 'them', 'some', 'could', 'him', 'into', 'then', 'now'
    }
    return [t for t in tokens if len(t) > 2 and t not in stopwords]

def build_corpus():
    paragraphs = extract_paragraphs(DOCX_PATH)
    print(f"Extracted {len(paragraphs)} paragraphs from {DOCX_PATH}")

    # Major section definitions with exact heading patterns
    section_patterns = [
        ("Abstract", r'^Abstract and Executive Summary'),
        ("Scope and Use", r'^Scope and Use'),
        ("1.0", r'^1\.\s+Theoretical Foundations of Managerial Emotional Intelligence'),
        ("1.1", r'^1\.1\s+What Emotional Intelligence Means'),
        ("1.2", r'^1\.2\s+JD-R:\s+Diagnose the Work Before'),
        ("1.3", r'^1\.3\s+Conflict,\s+Psychological Safety'),
        ("2.0", r'^2\.\s+Universal 4-Stage Real-Time Manager Response Model'),
        ("3.0", r'^3\.\s+Scenario Coverage Matrix and JD-R Audit Tool'),
        ("3.1", r'^3\.1\s+JD-R Audit Tool'),
        ("4.0", r'^4\.\s+Standardized Scenario Protocols$'),
        ("4.1", r'^4\.1\s+Client Escalation'),
        ("4.2", r'^4\.2\s+Team Task Conflict'),
        ("4.3", r'^4\.3\s+Team Relationship Conflict'),
        ("4.4", r'^4\.4\s+Executive Pressure and Aggressive Upward Demands'),
        ("4.5", r'^4\.5\s+Team Burnout and Chronic Overload'),
        ("4.6", r'^4\.6\s+Employee Performance Review'),
        ("4.7", r'^4\.7\s+Disciplinary Conversation'),
        ("4.8", r'^4\.8\s+Layoff or Restructuring Announcement'),
        ("4.9", r'^4\.9\s+Remote/Hybrid Team Disconnect'),
        ("4.10", r'^4\.10\s+Cross-Cultural Misunderstanding'),
        ("4.11", r'^4\.11\s+Harassment or Discrimination Report'),
        ("4.12", r'^4\.12\s+Ethical Dilemma or Whistleblowing'),
        ("4.13", r'^4\.13\s+Mental-Health Crisis or Acute Distress'),
        ("4.14", r'^4\.14\s+Toxic High-Performer'),
        ("4.15", r'^4\.15\s+Budget Cut or Resource Reduction'),
        ("5.0", r'^5\.\s+Four-Stage Integration Cross-Reference'),
        ("6.0", r'^6\.\s+Managerial EI Training Curriculum'),
        ("7.0", r'^7\.\s+Evaluation Dashboard and Accountability'),
        ("8.0", r'^8\.\s+Ethical,\s+Legal,\s+Clinical,\s+and Security Boundaries'),
        ("9.0", r'^9\.\s+Cultural and Contextual Validity'),
        ("10.0", r'^10\.\s+30-60-90 Day Implementation Roadmap'),
        ("11.0", r'^11\.\s+Limitations and Future Directions'),
        ("12.0", r'^12\.\s+One-Page Manager Quick Guide'),
        ("13.0", r'^13\.\s+References'),
        ("Appendix A", r'^Appendix A[\.:]\s+Documentation Template'),
        ("Appendix B", r'^Appendix B[\.:]\s+Evidence Interpretation Rules')
    ]

    anchors = []
    # Start scanning after TOC (p 27)
    for p_idx in range(27, len(paragraphs)):
        p = paragraphs[p_idx]
        for sec_id, pat in section_patterns:
            if re.search(pat, p):
                anchors.append((p_idx, sec_id, p))
                break

    print(f"Matched {len(anchors)} primary section anchors")

    chunks = []
    for i in range(len(anchors)):
        p_idx, sec_id, heading_text = anchors[i]
        next_p_idx = anchors[i+1][0] if i + 1 < len(anchors) else len(paragraphs)
        section_paragraphs = paragraphs[p_idx:next_p_idx]
        full_text = '\n\n'.join(section_paragraphs)

        clean_title = re.sub(r'^\d+(\.\d+)?\s+', '', heading_text).split('\t')[0].strip()
        if sec_id.startswith("Appendix"):
            clean_title = heading_text.split('\t')[0].strip()

        # Metadata extraction
        category = "General EQ Framework"
        evidence_base = ""
        early_warning = ""
        eq_competency = ""
        stage1 = ""
        stage2 = ""
        stage3 = ""
        stage4 = ""
        manager_script = ""
        what_not_to_do = ""
        escalation_boundary = ""
        follow_up = ""

        # Specific extraction for scenario protocols 4.1 to 4.15
        if sec_id.startswith("4.") and sec_id != "4.0":
            for line in section_paragraphs:
                if line.startswith("Category:"):
                    parts = line.split("Evidence base:")
                    category = parts[0].replace("Category:", "").strip().rstrip(".")
                    if len(parts) > 1:
                        evidence_base = parts[1].strip()
                elif line.startswith("Early warning signs."):
                    early_warning = line.replace("Early warning signs.", "").strip()
                elif line.startswith("EQ competency and likely deficit."):
                    eq_competency = line.replace("EQ competency and likely deficit.", "").strip()
                elif "Stage 1 - Detect & Pause:" in line:
                    stage1 = line.split("Stage 1 - Detect & Pause:")[1].strip()
                elif "Stage 2 - Reappraise & Regulate:" in line:
                    stage2 = line.split("Stage 2 - Reappraise & Regulate:")[1].strip()
                elif "Stage 3 - Empathetic Engagement:" in line:
                    stage3 = line.split("Stage 3 - Empathetic Engagement:")[1].strip()
                elif "Stage 4 - Collaborative Resolution:" in line:
                    stage4 = line.split("Stage 4 - Collaborative Resolution:")[1].strip()
                elif line.startswith("Manager script."):
                    manager_script = line.replace("Manager script.", "").strip().strip('“”"')
                elif line.startswith("What not to do."):
                    what_not_to_do = line.replace("What not to do.", "").strip()
                elif line.startswith("Escalation boundary."):
                    escalation_boundary = line.replace("Escalation boundary.", "").strip()
                elif line.startswith("Follow-up and documentation."):
                    follow_up = line.replace("Follow-up and documentation.", "").strip()

        elif sec_id == "2.0":
            category = "Universal 4-Stage Response Model"
            evidence_base = "Gross (1998); Jordan & Troth (2002); Edmondson (1999)"
            stage1 = "Detect & Pause: Notice emotional arousal; slow the response; assess immediate safety and process risk."
            stage2 = "Reappraise & Regulate: Separate ego threat from the operational issue; identify facts, authority, and constraints."
            stage3 = "Empathetic Engagement: Listen, acknowledge impact, ask neutral clarifying questions, and avoid judgment."
            stage4 = "Collaborative Resolution / Escalation: Agree actions, owners, timing, documentation, and formal escalation where required."
            manager_script = "Universal 4-stage response: (1) Detect & Pause -> (2) Reappraise & Regulate -> (3) Empathetic Engagement -> (4) Collaborative Resolution."
            escalation_boundary = "When safety risk, threats, illegal directives, harassment, discrimination, or mental-health crisis are identified, bypass collaboration and immediately route to formal HR/EAP/Legal/Security escalation."
        elif sec_id in ["1.2", "3.1"]:
            category = "JD-R & Workload Diagnostics"
            evidence_base = "Demerouti et al. (2001); Bakker & Demerouti (2007)"
            escalation_boundary = "When demand scores = 3 and resource scores = 0-1, immediate structural priority and capacity intervention is required. Do not substitute EQ coaching for structural fixes."
        elif sec_id == "8.0":
            category = "Ethical, Legal & Clinical Boundaries"
            evidence_base = "EEOC Guidance; Duty of Care; Psychological Safety Legislation; Whistleblower Protection Acts"
            escalation_boundary = "Immediate escalation to HR, Legal, or EAP. Managers MUST NOT conduct shadow investigations, diagnose clinical conditions, or negotiate away legal/safety rights."
        elif sec_id == "9.0":
            category = "Cultural & Contextual Validity"
            evidence_base = "Hofstede; Meyer (Culture Map); Cross-Cultural Communication Models"
        elif sec_id == "12.0":
            category = "Executive One-Page Action Guide"
            manager_script = "Step 1: Check safety & legality. Step 2: Breathe and pause. Step 3: Clarify facts vs emotions. Step 4: Act collaboratively within policy."

        slug = re.sub(r'[^a-z0-9]+', '_', f"{sec_id}_{clean_title}".lower()).strip('_')
        chunk_id = f"chunk_{slug}"

        # Rich searchable text representation
        rich_searchable = f"""
Section: {sec_id} {clean_title}
Category: {category}
Evidence Base: {evidence_base}
Early Warning Signs: {early_warning}
EQ Competency: {eq_competency}
Stage 1 (Detect & Pause): {stage1}
Stage 2 (Reappraise & Regulate): {stage2}
Stage 3 (Empathetic Engagement): {stage3}
Stage 4 (Collaborative Resolution): {stage4}
Manager Script: {manager_script}
What Not To Do: {what_not_to_do}
Escalation Boundary: {escalation_boundary}
Follow-up: {follow_up}
Full Content:
{full_text}
"""

        chunk = {
            "id": chunk_id,
            "section_number": sec_id,
            "title": clean_title,
            "category": category,
            "citation": f"[Managerial EQ Handbook §{sec_id}: {clean_title}]",
            "evidence_base": evidence_base,
            "early_warning_signs": early_warning,
            "eq_competency": eq_competency,
            "four_stages": {
                "stage1_detect_pause": stage1,
                "stage2_reappraise_regulate": stage2,
                "stage3_empathetic_engagement": stage3,
                "stage4_collaborative_resolution": stage4
            },
            "manager_script": manager_script,
            "what_not_to_do": what_not_to_do,
            "escalation_boundary": escalation_boundary,
            "follow_up": follow_up,
            "content": full_text,
            "keywords": list(set(tokenize(rich_searchable)))
        }
        chunks.append(chunk)

    # Save to lib/rag/corpus.json
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    corpus_path = os.path.join(OUTPUT_DIR, 'corpus.json')
    with open(corpus_path, 'w', encoding='utf-8') as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(chunks)} clean structured chunks to {corpus_path}")

    # Build inverted index & term frequencies for RAG engine
    inverted_index = {}
    doc_lengths = {}
    doc_term_freqs = {}
    idf = {}
    total_docs = len(chunks)

    for doc in chunks:
        doc_id = doc["id"]
        tokens = tokenize(f"{doc['title']} {doc['category']} {doc['evidence_base']} {doc['early_warning_signs']} {doc['manager_script']} {doc['escalation_boundary']} {doc['content']}")
        doc_lengths[doc_id] = len(tokens)
        
        freqs = {}
        for t in tokens:
            freqs[t] = freqs.get(t, 0) + 1
        doc_term_freqs[doc_id] = freqs

        for t in freqs:
            if t not in inverted_index:
                inverted_index[t] = []
            inverted_index[t].append(doc_id)

    for term, doc_list in inverted_index.items():
        df = len(doc_list)
        # BM25 standard IDF with smoothing
        idf[term] = math.log(1.0 + (total_docs - df + 0.5) / (df + 0.5))

    avg_dl = sum(doc_lengths.values()) / max(1, total_docs)

    index_data = {
        "total_docs": total_docs,
        "avg_doc_length": avg_dl,
        "doc_lengths": doc_lengths,
        "doc_term_freqs": doc_term_freqs,
        "idf": idf,
        "inverted_index": inverted_index
    }

    index_path = os.path.join(OUTPUT_DIR, 'index.json')
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)
    print(f"Wrote optimized search index with BM25 term frequencies to {index_path}")

if __name__ == '__main__':
    build_corpus()
