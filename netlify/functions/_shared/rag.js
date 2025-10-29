// netlify/functions/_shared/rag.js
// ChatGPT-style answers biased to your resume, with a resume-only fallback.
// Works with your current resume.json shape.

import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

/* ---------- Load resume.json robustly (prod + local) ---------- */
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
        if (process.env.DEBUG === 'true') console.log('RESUME: loaded from', p, 'keys=', Object.keys(json));
        return json;
      }
    } catch (e) {
      console.error('RESUME read error', p, e?.message || e);
    }
  }
  return {}; // never 500 — we’ll fall back gracefully
}

/* ---------- Normalization helpers to fit your schema ---------- */
const asArray = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const unique = (xs) => Array.from(new Set(xs.filter(Boolean).map(String)));

function flattenTechnicalSkills(technical_skills) {
  // You provided: office_tools[], software[], programming_languages[], certifications[]
  if (!technical_skills || typeof technical_skills !== 'object') return [];
  const buckets = [];
  for (const [k, v] of Object.entries(technical_skills)) {
    if (Array.isArray(v)) buckets.push(...v.map(String));
    else if (v) buckets.push(String(v));
  }
  return unique(buckets);
}

function normalizeExperience(raw) {
  const arr = Array.isArray(raw?.experience) ? raw.experience : [];
  return arr.map(e => ({
    role: e.role || e.title,
    company: e.company,
    location: e.location,
    start: e.start || e.startDate,
    end: e.end || e.endDate,
    highlights: Array.isArray(e.bullets) ? e.bullets
             : Array.isArray(e.highlights) ? e.highlights
             : []
  })).filter(x => x.role || x.company || (x.highlights && x.highlights.length));
}

function normalizeProjects(raw) {
  const arr = Array.isArray(raw?.projects) ? raw.projects : [];
  return arr.map(p => ({
    name: p.name || p.title,
    description: Array.isArray(p.details) ? p.details.join(' ') : (p.description || ''),
    stack: Array.isArray(p.stack) ? p.stack.join(', ') : (p.stack || p.tech || ''),
    highlights: Array.isArray(p.details) ? p.details : (Array.isArray(p.highlights) ? p.highlights : [])
  })).filter(x => x.name || x.description);
}

function normalizeEducation(raw) {
  const arr = Array.isArray(raw?.education) ? raw.education : [];
  return arr.map(e => ({
    institution: e.school || e.institution || e.name,
    degree: e.degree,
    field: e.field || e.minor,
    end: e.expected_graduation || e.end || e.endDate
  }));
}

function normalizeResume(raw) {
  const name = raw.name || raw.basics?.name;
  const title = raw.title || raw.basics?.label;
  const summary =
    raw.summary || raw.basics?.summary ||
    (title ? `Currently ${title}.` : '');

  const skills = unique([
    ...flattenTechnicalSkills(raw.technical_skills),
    ...(Array.isArray(raw.languages_spoken) ? raw.languages_spoken : [])
  ]);

  const experience = normalizeExperience(raw);
  const projects = normalizeProjects(raw);
  const education = normalizeEducation(raw);

  if (process.env.DEBUG === 'true') {
    console.log('RESUME normalized counts:', {
      experience: experience.length, projects: projects.length, skills: skills.length, education: education.length
    });
  }

  return { name, title, summary, skills, experience, projects, education, links: raw.links, contact: raw.contact, location: raw.location };
}

/* ---------- Resume-only summarizers (also used as fallback) ---------- */
function firstSentences(text, n = 2) {
  if (!text) return '';
  const parts = String(text).split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(' ');
}

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
  return prj.slice(0, max).map(p => {
    const tech = p.stack ? ` using ${p.stack}` : '';
    const desc = p.description ? ` ${firstSentences(p.description, 1)}` : '';
    return `${p.name || 'A project'}${tech}.${desc}`;
  }).join(' ');
}

function summarizeSkills(resume) {
  const s = resume.skills || [];
  return s.length ? `Here are my primary skills: ${s.join(', ')}.` :
    'I do not have skills listed in the current resume data.';
}

function summarizeEducation(resume) {
  const ed = resume.education || [];
  if (!ed.length) return '';
  return ed.map(e => {
    const name = [e.degree, e.field].filter(Boolean).join(' in ');
    const at = e.institution ? ` at ${e.institution}` : '';
    const when = e.end ? ` (expected ${e.end})` : '';
    return `${name}${at}${when}.`;
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

/* ---------- Keyword shortcuts (fast, no model) ---------- */
function tryKeywordShortcuts(question, resume) {
  const q = String(question || '').trim().toLowerCase();

  if (!q || /^(hi|hello|hey)\b/.test(q)) return genericSummary(resume);
  if (['experience', 'experience?'].includes(q) || /summarize.*experience/.test(q))
    return summarizeExperience(resume, 5);
  if (/top\s*3\s*projects?/.test(q)) return summarizeProjects(resume, 3);
  if (/(projects?|portfolio)/.test(q)) return summarizeProjects(resume, 5);
  if (/skills?/.test(q)) return summarizeSkills(resume);
  if (/education|degree|university|college/.test(q)) {
    const ed = summarizeEducation(resume);
    return ed || 'I do not have education details available in my current resume data.';
  }
  return null;
}

/* ---------- Public entry: ChatGPT-style with resume bias ---------- */
export async function getAnswer(question) {
  const normalized = normalizeResume(loadResumeJson());

  // 1) Instant answers for common intents (no OpenAI latency)
  const shortcut = tryKeywordShortcuts(question, normalized);
  if (shortcut) return shortcut;

  // 2) ChatGPT-style answer, *not* restricted to the resume, but encouraged to use it
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const context = [
      normalized.name ? `Name: ${normalized.name}` : '',
      normalized.title ? `Title: ${normalized.title}` : '',
      normalized.location ? `Location: ${normalized.location}` : '',
      normalized.summary ? `Summary: ${normalized.summary}` : '',
      normalized.skills?.length ? `Skills: ${normalized.skills.join(', ')}` : '',
      (normalized.experience || []).length ? 'Experience:\n' + normalized.experience.slice(0, 8).map(e => {
        const head = [e.role, e.company].filter(Boolean).join(' @ ');
        const dates = [e.start, e.end].filter(Boolean).join(' - ');
        const bullets = Array.isArray(e.highlights) ? e.highlights.slice(0, 3).map(b => `  • ${b}`).join('\n') : '';
        return `- ${head}${dates ? ` (${dates})` : ''}\n${bullets}`;
      }).join('\n') : '',
      (normalized.projects || []).length ? 'Projects:\n' + normalized.projects.slice(0, 8).map(p => {
        const head = [p.name, p.stack].filter(Boolean).join(' — ');
        const desc = p.description ? `\n  • ${p.description}` : '';
        const hl = Array.isArray(p.highlights) ? p.highlights.slice(0, 2).map(h => `  • ${h}`).join('\n') : '';
        return `- ${head}${desc}${hl ? `\n${hl}` : ''}`;
      }).join('\n') : '',
      (normalized.education || []).length ? 'Education:\n' + normalized.education.map(e => {
        const line = [e.degree, e.field].filter(Boolean).join(' in ');
        const at = e.institution ? ` at ${e.institution}` : '';
        const end = e.end ? ` (expected ${e.end})` : '';
        return `- ${line}${at}${end}`;
      }).join('\n') : ''
    ].filter(Boolean).join('\n');

    const system = [
      'You are Ridha-GPT. Answer helpfully and truthfully.',
      'Use the resume context about Ridha when relevant, but you may also answer general questions beyond the resume.',
      'When a user asks specifically about Ridha and the fact is missing, say: "I cannot confirm this from my resume."',
      'Otherwise, provide a thorough, plain-English answer in full sentences.'
    ].join(' ');

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      messages: [
        { role: 'system', content: `${system}\n\n=== RESUME CONTEXT START ===\n${context}\n=== RESUME CONTEXT END ===` },
        { role: 'user', content: String(question || '').trim() || 'Introduce yourself.' }
      ]
    });

    const text = resp.choices?.[0]?.message?.content?.trim();
    if (text) return text;
  } catch (err) {
    console.error('OpenAI call failed:', err?.message || err);
  }

  // 3) Fallback: resume-only generic summary (never 500s)
  return genericSummary(normalized);
}
