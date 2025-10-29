// netlify/functions/_shared/rag.js
// ESM module: matches "type": "module" in netlify/functions/package.json

import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

/** Find and load resume.json reliably in prod and local dev */
export function loadResumeJson() {
  const candidates = [
    // Production on Netlify with [build.base="frontend"]
    path.join(process.cwd(), 'src', 'data', 'resume.json'),
    // Local dev from repo root
    path.join(process.cwd(), 'frontend', 'src', 'data', 'resume.json'),
    // Local dev when cwd is "netlify/functions"
    path.join(process.cwd(), '..', 'frontend', 'src', 'data', 'resume.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const txt = fs.readFileSync(p, 'utf-8');
        return JSON.parse(txt);
      }
    } catch {}
  }
  throw new Error(
    'resume.json not found. Tried:\n' + candidates.map(p => ' - ' + p).join('\n')
  );
}

/** Build compact context from the resume (defensive to schema changes) */
function buildContext(resume) {
  const lines = [];
  if (resume.name) lines.push(`Name: ${resume.name}`);
  if (resume.title) lines.push(`Title: ${resume.title}`);
  if (resume.summary) lines.push(`Summary: ${resume.summary}`);

  if (Array.isArray(resume.experience) && resume.experience.length) {
    lines.push('Experience:');
    for (const exp of resume.experience.slice(0, 8)) {
      const company = [exp.company, exp.location].filter(Boolean).join(' — ');
      const dates = [exp.start, exp.end].filter(Boolean).join(' - ');
      const header = [exp.role || exp.title, company].filter(Boolean).join(' @ ');
      lines.push(`- ${header}${dates ? ` (${dates})` : ''}`);
      if (Array.isArray(exp.highlights)) {
        for (const h of exp.highlights.slice(0, 3)) lines.push(`  • ${h}`);
      }
    }
  }

  if (Array.isArray(resume.projects) && resume.projects.length) {
    lines.push('Projects:');
    for (const p of resume.projects.slice(0, 8)) {
      const header = [p.name, p.stack || p.tech].filter(Boolean).join(' — ');
      lines.push(`- ${header}`);
      if (p.description) lines.push(`  • ${p.description}`);
      if (Array.isArray(p.highlights)) {
        for (const h of p.highlights.slice(0, 2)) lines.push(`  • ${h}`);
      }
    }
  }

  if (Array.isArray(resume.skills) && resume.skills.length) {
    lines.push(`Skills: ${resume.skills.join(', ')}`);
  } else if (resume.skills && typeof resume.skills === 'object') {
    const kv = Object.entries(resume.skills)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join(' | ');
    if (kv) lines.push(`Skills: ${kv}`);
  }

  return lines.join('\n');
}

/** Keyword shortcuts: experience? projects? skills? top 3 projects? */
function tryKeywordShortcuts(question, resume) {
  const q = String(question || '').trim().toLowerCase();

  const firstSentences = (text, n = 2) => {
    if (!text) return '';
    const parts = String(text).split(/(?<=[.!?])\s+/);
    return parts.slice(0, n).join(' ');
  };

  const summarizeExperience = () => {
    if (!Array.isArray(resume.experience) || resume.experience.length === 0) {
      return 'I do not have experience details available in my current resume data.';
    }
    const items = resume.experience.map(exp => {
      const role = exp.role || exp.title || 'Role';
      const company = exp.company ? ` at ${exp.company}` : '';
      const dates = [exp.start, exp.end].filter(Boolean).join(' - ');
      const main = Array.isArray(exp.highlights) && exp.highlights.length
        ? ` Key contributions include ${exp.highlights.slice(0, 2).join('; ')}.`
        : '';
      return `${role}${company}${dates ? ` (${dates})` : ''}.${main}`;
    });
    const head = resume.summary ? `${firstSentences(resume.summary, 1)} ` : '';
    return head + items.slice(0, 5).join(' ');
  };

  const summarizeProjects = () => {
    if (!Array.isArray(resume.projects) || resume.projects.length === 0) {
      return 'I do not have project details available in my current resume data.';
    }
    const items = resume.projects.map(p => {
      const name = p.name || 'A project';
      const tech = p.stack || p.tech ? ` using ${p.stack || p.tech}` : '';
      const desc = p.description ? ` ${firstSentences(p.description, 1)}` : '';
      return `${name}${tech}.${desc}`;
    });
    return items.slice(0, 5).join(' ');
  };

  if (['experience', 'experience?'].includes(q)) return summarizeExperience();
  if (['projects', 'projects?'].includes(q) || /top\s*3\s*projects\??/.test(q)) {
    const base = summarizeProjects();
    if (/top\s*3/.test(q)) {
      const parts = base.split(/(?<=[.!?])\s+/).filter(Boolean);
      return parts.slice(0, 3).join(' ');
    }
    return base;
  }
  if (['skills', 'skills?'].includes(q)) {
    if (Array.isArray(resume.skills)) {
      return `Here are the primary skills: ${resume.skills.join(', ')}.`;
    } else if (resume.skills && typeof resume.skills === 'object') {
      const flat = Object.entries(resume.skills)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('; ');
      return flat ? `Here are the skills by category: ${flat}.`
                  : 'I do not have skills listed in the current resume data.';
    }
    return 'I do not have skills listed in the current resume data.';
  }
  return null;
}

/** Main answer: resume-grounded but can handle general questions */
export async function getAnswer(question) {
  const resume = loadResumeJson();

  const shortcut = tryKeywordShortcuts(question, resume);
  if (shortcut) return shortcut;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const context = buildContext(resume);

  const system = [
    'You are Ridha-GPT, a helpful assistant focused on Ridha Mahmood.',
    'Answer primarily using the resume context provided.',
    'If a question goes beyond the resume, give a concise general answer AND tie it back to Ridha when possible.',
    'Always reply in clear, full sentences.',
    'If the resume does not contain the requested fact, briefly say it is not in the resume data.'
  ].join(' ');

  const messages = [
    { role: 'system', content: `${system}\n\n=== RESUME CONTEXT START ===\n${context}\n=== RESUME CONTEXT END ===` },
    { role: 'user', content: String(question || '').trim() || 'Introduce yourself.' }
  ];

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.5,
    messages
  });

  const text = resp.choices?.[0]?.message?.content?.trim();
  return text || 'I tried to answer but did not receive a response from the model.';
}
