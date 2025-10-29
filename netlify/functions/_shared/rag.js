// netlify/functions/_shared/rag.js
// Resume-only (no OpenAI). Normalizes many common resume JSON shapes.

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
        const json = JSON.parse(txt);
        if (process.env.DEBUG === 'true') {
          console.log('RESUME: loaded from', p, 'keys=', Object.keys(json));
        }
        return json;
      }
    } catch (e) {
      console.error('RESUME: failed to read', p, e?.message || e);
    }
  }
  // If nothing found, still return an object to avoid 500s
  return {};
}

/* ---------------- Normalization helpers ---------------- */

function unique(list) {
  return Array.from(new Set(list.filter(Boolean).map(String)));
}

function asArray(x) {
  if (Array.isArray(x)) return x;
  if (x == null) return [];
  return [x];
}

function firstSentences(text, n = 2) {
  if (!text) return '';
  const parts = String(text).split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(' ');
}

function normalizeSkills(rawSkills) {
  // Accept: string[], [{name, keywords[]}] (JSON Resume), {category:[items]}, "a, b, c"
  if (!rawSkills) return [];
  if (typeof rawSkills === 'string') {
    return unique(rawSkills.split(/[,;|]\s*/));
  }
  if (Array.isArray(rawSkills)) {
    if (rawSkills.length && typeof rawSkills[0] === 'string') {
      return unique(rawSkills);
    }
    if (rawSkills.length && typeof rawSkills[0] === 'object') {
      // JSON Resume style buckets
      const all = [];
      for (const s of rawSkills) {
        if (s?.name) all.push(String(s.name));
        if (Array.isArray(s?.keywords)) all.push(...s.keywords.map(String));
        if (Array.isArray(s?.items)) all.push(...s.items.map(String));
      }
      return unique(all);
    }
  }
  if (typeof rawSkills === 'object') {
    // { Programming: ["Python", "Go"], Cloud: ["AWS", "GCP"] }
    const all = [];
    for (const v of Object.values(rawSkills)) {
      if (Array.isArray(v)) all.push(...v.map(String));
      else if (v) all.push(String(v));
    }
    return unique(all);
  }
  return [];
}

function normalizeExperience(raw) {
  // Accept arrays under many keys; map fields to {role, company, location, start, end, highlights[]}
  const keys = ['experience', 'experiences', 'work', 'employment', 'jobs', 'roles', 'positions'];
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === 'object') {
    for (const k of keys) {
      if (Array.isArray(raw[k])) { arr = raw[k]; break; }
    }
  }
  const result = [];
  for (const e of asArray(arr)) {
    if (!e || typeof e !== 'object') continue;
    const highlights =
      Array.isArray(e.highlights) ? e.highlights :
      Array.isArray(e.bullets) ? e.bullets :
      Array.isArray(e.responsibilities) ? e.responsibilities :
      e.summary ? [String(e.summary)] : [];
    result.push({
      role: e.role || e.title || e.position,
      company: e.company || e.name || e.employer || e.organization,
      location: e.location || e.city || e.place,
      start: e.start || e.startDate || e.from,
      end: e.end || e.endDate || e.to,
      highlights
    });
  }
  return result.filter(x => x.role || x.company || (x.highlights && x.highlights.length));
}

function normalizeProjects(raw) {
  const keys = ['projects', 'project', 'portfolio', 'workSamples'];
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === 'object') {
    for (const k of keys) {
      if (Array.isArray(raw[k])) { arr = raw[k]; break; }
    }
  }
  const result = [];
  for (const p of asArray(arr)) {
    if (!p || typeof p !== 'object') continue;
    const keywords =
      Array.isArray(p.keywords) ? p.keywords :
      Array.isArray(p.technologies) ? p.technologies :
      Array.isArray(p.stack) ? p.stack : [];
    const stack =
      p.stack || p.tech || (Array.isArray(keywords) ? keywords.join(', ') : undefined);
    const highlights =
      Array.isArray(p.highlights) ? p.highlights :
      Array.isArray(p.achievements) ? p.achievements : [];
    result.push({
      name: p.name || p.title,
      description: p.description || p.summary,
      stack,
      highlights
    });
  }
  return result.filter(x => x.name || x.description);
}

function normalizeEducation(raw) {
  const keys = ['education', 'educations', 'studies'];
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === 'object') {
    for (const k of keys) {
      if (Array.isArray(raw[k])) { arr = raw[k]; break; }
    }
  }
  const result = [];
  for (const e of asArray(arr)) {
    if (!e || typeof e !== 'object') continue;
    result.push({
      institution: e.institution || e.school || e.university || e.college || e.name,
      degree: e.degree || e.qualification,
      field: e.area || e.field || e.major,
      start: e.startDate || e.start || e.from,
      end: e.endDate || e.end || e.to
    });
  }
  return result;
}

function normalizeResume(raw) {
  const name = raw.name || raw.basics?.name || raw.profile?.name;
  const title = raw.title || raw.basics?.label || raw.profile?.title;
  const summary = raw.summary || raw.basics?.summary || raw.about || raw.profile?.summary;

  const experience = normalizeExperience(
    raw.experience ?? raw.experiences ?? raw.work ?? raw.employment ?? raw.jobs ?? raw.roles ?? raw.positions ?? raw
  );
  const projects = normalizeProjects(
    raw.projects ?? raw.project ?? raw.portfolio ?? raw
  );
  const skills = normalizeSkills(
    raw.skills ?? raw.skill ?? raw.technologies ?? raw.techStack ?? raw.stack ?? raw.tools
  );
  const education = normalizeEducation(
    raw.education ?? raw.educations ?? raw.study ?? raw
  );

  if (process.env.DEBUG === 'true') {
    console.log('RESUME normalized counts:', {
      experience: experience.length, projects: projects.length, skills: skills.length, education: education.length
    });
  }

  return { name, title, summary, experience, projects, skills, education };
}

/* ---------------- Answer helpers ---------------- */

function summarizeExperience(resume, max = 5) {
  const exp = resume.experience || [];
  if (!exp.length) return 'I do not have experience details available in my current resume data.';
  const items = exp.slice(0, max).map(e => {
    const role = e.role || 'Role';
    const company = e.company ? ` at ${e.company}` : '';
    const dates = [e.start, e.end].filter(Boolean).join(' - ');
    const h = Array.isArray(e.highlights) && e.highlights.length
      ? ` Key contributions include ${e.highlights.slice(0, 2).join('; ')}.`
      : '';
    return `${role}${company}${dates ? ` (${dates})` : ''}.${h}`;
  });
  const head = resume.summary ? `${firstSentences(resume.summary, 1)} ` : '';
  return head + items.join(' ');
}

function summarizeProjects(resume, max = 5) {
  const prj = resume.projects || [];
  if (!prj.length) return 'I do not have project details available in my current resume data.';
  const items = prj.slice(0, max).map(p => {
    const name = p.name || 'A project';
    const tech = p.stack ? ` using ${p.stack}` : '';
    const desc = p.description ? ` ${firstSentences(p.description, 1)}` : '';
    return `${name}${tech}.${desc}`;
  });
  return items.join(' ');
}

function summarizeSkills(resume) {
  const list = resume.skills || [];
  if (!list.length) return 'I do not have skills listed in the current resume data.';
  return `Here are my primary skills: ${list.join(', ')}.`;
}

function summarizeEducation(resume) {
  const ed = resume.education || [];
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

/** Lightweight intent routing + simple search fallback */
function answerFromResume(question, resume) {
  const q = String(question || '').trim().toLowerCase();

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

  // Naive relevance search across experience+projects
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  const score = (text) => tokens.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);

  const hits = [];

  for (const e of resume.experience || []) {
    const header = [e.role, e.company].filter(Boolean).join(' @ ');
    const base = [header, ...(Array.isArray(e.highlights) ? e.highlights : [])].join(' ');
    const s = score(base.toLowerCase());
    if (s > 0) hits.push({ kind: 'experience', text: `${header}. ${firstSentences(base, 1)}`, s });
  }
  for (const p of resume.projects || []) {
    const header = [p.name, p.stack].filter(Boolean).join(' — ');
    const base = [header, p.description || '', ...(Array.isArray(p.highlights) ? p.highlights : [])].join(' ');
    const s = score(base.toLowerCase());
    if (s > 0) hits.push({ kind: 'project', text: `${header}. ${firstSentences(p.description, 1)}`, s });
  }

  hits.sort((a, b) => b.s - a.s);
  const top = hits.slice(0, 4).map(h => `• ${h.text}`).join('\n');
  if (top) return `Based on my resume, here’s what’s most relevant to “${question}”:\n${top}`;

  return genericSummary(resume);
}

/** Public entry used by your Function */
export async function getAnswer(question) {
  const raw = loadResumeJson();
  const resume = normalizeResume(raw);
  return answerFromResume(question, resume);
}
