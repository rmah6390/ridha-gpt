import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

/* Third-person, she/her; plain sentences; ≤4 by default; contact ready */
export const SYSTEM_PROMPT =
  "You are a professional assistant representing the candidate Ridha Mahmood. " +
  "Use she/her pronouns and write in third person (e.g., 'Ridha's skills include …'). " +
  "Do not mention or hint at any sources. Write naturally in plain sentences, no markdown and no asterisks. " +
  "Keep answers concise—no more than 4 sentences unless the user explicitly asks for more. " +
  "If the user asks how to contact Ridha or similar, provide her email and LinkedIn exactly as found in the Profile Context. " +
  "If a specific fact about Ridha is not in the context, respond briefly without speculating. " +
  "For general (non-Ridha) questions, ignore the context and answer normally in a friendly tone.";

const RESUME_PATHS = [
  path.join(process.cwd(), "frontend", "src", "data", "resume.json"),
  path.join(process.cwd(), "src", "data", "resume.json")
];

let _resumeCache = null;
let _embeddedChunksPromise = null;

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function resolveResumePath() {
  for (const p of RESUME_PATHS) { try { await fs.access(p); return p; } catch {} }
  return RESUME_PATHS[0];
}

async function loadResume() {
  if (_resumeCache) return _resumeCache;
  const p = await resolveResumePath();
  const raw = await fs.readFile(p, "utf-8");
  _resumeCache = JSON.parse(raw);
  return _resumeCache;
}

function asArray(x) { return Array.isArray(x) ? x : x == null ? [] : [x]; }

function chunkResume(data) {
  const chunks = [];

  // Summary
  if (data.summary) chunks.push({ id: "summary", text: `Summary: ${data.summary}` });

  // Target roles
  if (Array.isArray(data.target_roles) && data.target_roles.length) {
    chunks.push({ id: "targets", text: `Target roles: ${data.target_roles.join(", ")}` });
  }

  // Contact — include explicit lines the model can quote
  if (data.contact && (data.contact.email || data.contact.linkedin)) {
    const lines = [];
    if (data.contact.email)   lines.push(`Email: ${data.contact.email}`);
    if (data.contact.linkedin) lines.push(`LinkedIn: ${data.contact.linkedin}`);
    chunks.push({ id: "contact", text: lines.join(" | ") });
  }

  // Skills
  const skills =
    (data.technical_skills && data.technical_skills.programming_languages) ||
    data.skills || [];
  if (Array.isArray(skills) && skills.length) {
    chunks.push({ id: "skills", text: `Skills: ${skills.join(", ")}` });
  }

  // Experience
  for (const [i, job] of asArray(data.experience).entries()) {
    const header = [
      `Experience: ${job.role ?? ""} at ${job.company ?? ""}`.trim(),
      [job.start, job.end].filter(Boolean).join(" – "),
      job.location
    ].filter(Boolean).join("\n");
    const bullets = asArray(job.bullets);
    if (bullets.length) {
      for (const [j, b] of bullets.entries()) {
        chunks.push({ id: `exp-${i}-${j}`, text: `${header}\n• ${b}`.trim() });
      }
    } else if (header) {
      chunks.push({ id: `exp-${i}`, text: header });
    }
  }

  // Projects
  for (const [i, proj] of asArray(data.projects).entries()) {
    const base = [`Project: ${proj.name ?? ""}`.trim()];
    if (proj.desc) base.push(proj.desc);
    const details = asArray(proj.details).length ? asArray(proj.details) : asArray(proj.highlights);
    if (details.length) {
      for (const [j, d] of details.entries()) {
        chunks.push({ id: `proj-${i}-${j}`, text: `${base.join("\n")}\n• ${d}`.trim() });
      }
    } else {
      chunks.push({ id: `proj-${i}`, text: base.join("\n") });
    }
  }

  // Education
  for (const [i, edu] of asArray(data.education).entries()) {
    const line = [
      `Education: ${edu.degree ?? ""}`.trim(),
      edu.school,
      edu.expected_graduation ?? edu.year
    ].filter(Boolean).join(" — ");
    if (line) chunks.push({ id: `edu-${i}`, text: line });
  }

  return chunks;
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

async function ensureEmbeddings() {
  if (_embeddedChunksPromise) return _embeddedChunksPromise;
  if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  _embeddedChunksPromise = (async () => {
    const chunks = chunkResume(await loadResume());
    if (!chunks.length) return [];
    const { data } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks.map(c => c.text)
    });
    return chunks.map((c, i) => ({ ...c, embedding: data[i].embedding }));
  })();

  return _embeddedChunksPromise;
}

export async function buildContext(question, topK = 6) {
  const embedded = await ensureEmbeddings();
  if (!embedded.length) return { context: "", scoredChunks: [] };

  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question
  });
  const q = data[0].embedding;

  const scored = embedded
    .map(c => ({ ...c, score: cosineSimilarity(q, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { context: scored.map(c => `- ${c.text}`).join("\n"), scoredChunks: scored };
}
