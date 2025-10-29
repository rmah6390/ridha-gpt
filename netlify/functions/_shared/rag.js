// netlify/functions/_shared/rag.js
// Offline / resume-only mode (no OpenAI import or API key needed)

import fs from 'node:fs';
import path from 'node:path';

/** Load resume.json reliably on Netlify (base="frontend") and in local dev */
export function loadResumeJson() {
  const candidates = [
    path.join(process.cwd(), 'src', 'data', 'resume.json'),             // Netlify prod (base="frontend")
    path.join(process.cwd(), 'frontend', 'src', 'data', 'resume.json'), // local dev from repo root
    path.join(process.cwd(), '..', 'frontend', 'src', 'data', 'resume.json') // local when cwd=functions
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const txt = fs.readFileSync(p, 'utf-8');
        return JSON.parse(txt);
      }
    } catch {}
  }
  // Still return something so we *never* 500
  return { summary: 'No resume data was found.', experience: [], projects: [], skills: [] };
}

function firstSentences(text, n = 2) {
  if (!text) return '';
  const parts = String(text).split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(' ');
}

function summarizeExperience(resume, max = 5) {
  const exp = Array.isArray(resume.experience) ? resume.experience : [];
  if (!exp.length) return 'I do not have experience details available in my current resume data.';
  const items = exp.slice(0, max).map(e => {
    const role = e.role || e.title || 'Role';
    const company = e.company ? ` at ${e.company}` : '';
    const dates = [e.start, e.end].filter(Boolean).join(' - ');
    const highlights = Array.isArray(e.highlights) ? e.highlights.slice(0, 2).join('; ') : '';
    const h = highlights ? ` Key contributions include ${highlights}.` : '';
    return `${role}${company}${dates ? ` (${dates})` : ''}.${h}`;
  });
  const head = resume.summary ? `${firstSentences(resume.summary, 1)} ` : '';
  return head + items.join(' ');
}

function summarizeProjects(resume, max = 5) {
  const prj = Array.isArray(resume.projects) ? resume.projects : [];
  if (!prj.length) return 'I do not have project details available in my current resume data.';
  const items = prj.slice(0, max).map(p => {
    const name = p.name || 'A project';
    const tech = p.stack || p.tech ? ` using ${p.stack || p.tech}` : '';
    const desc = p.description ? ` ${firstSentences(p.description, 1)}` : '';
    return `${name}${tech}.${desc}`;
  });
  return items.join(' ');
}

function summarizeSkills(resume) {
  if (Array.isArray(resume.skills) && resume.skills.length) {
    return `Here are my primary skills: ${resume.skills.join(', ')}.`;
  }
  if (resume.skills && typeof resume.skills === 'object') {
    const flat = Object.entries(resume.skills)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join('; ');
    if (flat) return `Here are my skills by category: ${flat}.`;
  }
  return 'I do not have skills listed in the current resume data.';
}

function summarizeEducation(resume) {
  const ed = Array.isArray(resume.education) ? resume.education : [];
  if (!ed.length) return '';
  return ed.map(e => {
    const name = [e.degree, e.field].filter(Boolean).join(' in ');
    const at = e.institution ? ` at ${e.institution}` : '';
    const when = [e.start, e.end].filter(Boolean).join(' - ');
    return `${name}${at}${when ? ` (${when})` : ''}.`;
  }).join(' ');
}

function genericSummary(resume) {
  const parts = [];
  if (resume.summary) parts.push(firstSentences(resume.summary, 2));
  const exp = summarizeExperience(resume, 3);
  if (exp) parts.push(exp);
  const prj = summarizeProjects(resume, 3);
  if (prj) parts.push(`Projects: ${prj}`);
  const sk = summarizeSkills(resume);
  if (sk) parts.push(sk);
  const ed = summarizeEducation(resume);
  if (ed) parts.push(ed);
  return parts.filter(Boolean).join('\n\n');
}

/** Lightweight keyword routing + simple search fallback */
function answerFromResume(question, resume) {
  const q = String(question || '').trim().toLowerCase();

  // Keywords / intents
  if (!q || /^(hi|hello|hey)\b/.test(q)) {
    return genericSummary(resume);
  }
  if (/(summarize|overview).*(experience)/.test(q) || ['experience', 'experience?'].includes(q)) {
    return summarizeExperience(resume, 5);
  }
  if (/top\s*3\s*projects?/.test(q)) {
    return summarizeProjects(resume, 3);
  }
  if (/(projects?|portfolio)/.test(q)) {
    return summarizeProjects(resume, 5);
  }
  if (/skills?/.test(q)) {
    return summarizeSkills(resume);
  }
  if (/education|degree|university|college/.test(q)) {
    const ed = summarizeEducation(resume);
    return ed || 'I do not have education details available in my current resume data.';
  }

  // Naive search: score highlights + project text by token overlap
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  const score = (text) => tokens.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);

  const hits = [];

  const exp = Array.isArray(resume.experience) ? resume.experience : [];
  exp.forEach(e => {
    const header = [e.role || e.title, e.company].filter(Boolean).join(' @ ');
    const base = [header, e.description || ''].join(' ');
    let s = score(base.toLowerCase());
    if (Array.isArray(e.highlights)) {
      e.highlights.forEach(h => { s += score(String(h).toLowerCase()); });
    }
    if (s > 0) hits.push({ kind: 'experience', text: `${header}. ${Array.isArray(e.highlights) ? e.highlights.slice(0,2).join(' ') : ''}`, s });
  });

  const prj = Array.isArray(resume.projects) ? resume.projects : [];
  prj.forEach(p => {
    const header = [p.name, p.stack || p.tech].filter(Boolean).join(' — ');
    const base = [header, p.description || '', ...(Array.isArray(p.highlights)? p.highlights: [])].join(' ');
    const s = score(base.toLowerCase());
    if (s > 0) hits.push({ kind: 'project', text: `${header}. ${firstSentences(p.description, 1)}`, s });
  });

  hits.sort((a, b) => b.s - a.s);
  const top = hits.slice(0, 4).map(h => `• ${h.text}`).join('\n');
  if (top) {
    return `Based on my resume, here’s what’s most relevant to “${question}”:\n${top}`;
  }

  // Fallback generic summary
  return genericSummary(resume);
}

/** Public entry used by your Function */
export async function getAnswer(question) {
  const resume = loadResumeJson();
  return answerFromResume(question, resume);
}
