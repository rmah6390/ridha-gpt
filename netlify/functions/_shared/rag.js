// netlify/functions/_shared/rag.js
// ESM-only RAG helper for Netlify Functions.
// - Stable resume.json path via process.cwd()
// - Caches embeddings across invocations
// - Tolerant to your resume.json shape (skills/experience/projects/education variants)

import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

/* ---------- System instruction used for personal answers ---------- */
export const SYSTEM_PROMPT =
  `You are Ridha-GPT, a personal assistant that answers only using the provided resume context. ` +
  `Always respond in complete sentences. If the resume does not contain the answer, say: ` +
  `"I cannot confirm this from my resume."`;

/* ---------- Resolve resume.json (packaged via included_files) ---------- */
const RESUME_PATH = path.join(process.cwd(), "frontend", "src", "data", "resume.json");

// Lazy cache for the parsed resume and embeddings
let _resumeCache = null;
let _embeddedChunksPromise = null;

// Single OpenAI client (uses env var OPENAI_API_KEY)
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- Load & normalize resume ---------- */
async function loadResume() {
  if (_resumeCache) return _resumeCache;
  const raw = await fs.readFile(RESUME_PATH, "utf-8");
  const json = JSON.parse(raw);
  _resumeCache = json;
  return json;
}

function asArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

/* ---------- Chunking: produce small, searchable text units ---------- */
function chunkResume(data) {
  const chunks = [];

  // Summary
  if (data.summary) {
    chunks.push({ id: "summary", text: `Summary: ${data.summary}` });
  }

  // Skills: support either flat "skills" or nested "technical_skills.programming_languages"
  const skills =
    data.technical_skills?.programming_languages ??
    data.skills ??
    [];
  if (Array.isArray(skills) && skills.length) {
    chunks.push({ id: "skills", text: `Skills: ${skills.join(", ")}` });
  }

  // Experience
  for (const [i, job] of asArray(data.experience).entries()) {
    const headerLines = [
      `Experience: ${job.role ?? ""} at ${job.company ?? ""}`.trim(),
      [job.start, job.end].filter(Boolean).join(" – "),
      job.location
    ].filter(Boolean);
    const header = headerLines.join("\n");

    const bullets = asArray(job.bullets);
    if (bullets.length) {
      for (const [j, b] of bullets.entries()) {
        chunks.push({ id: `exp-${i}-${j}`, text: `${header}\n• ${b}`.trim() });
      }
    } else if (header) {
      chunks.push({ id: `exp-${i}`, text: header });
    }
  }

  // Projects: support {name, details[]} or {name, desc} or {name, highlights[]}
  for (const [i, proj] of asArray(data.projects).entries()) {
    const base = [`Project: ${proj.name ?? ""}`.trim()];
    if (proj.desc) base.push(proj.desc);

    const details = asArray(proj.details).length
      ? asArray(proj.details)
      : asArray(proj.highlights);

    if (details.length) {
      for (const [j, d] of details.entries()) {
        chunks.push({ id: `proj-${i}-${j}`, text: `${base.join("\n")}\n• ${d}`.trim() });
      }
    } else {
      chunks.push({ id: `proj-${i}`, text: base.join("\n") });
    }
  }

  // Education: support degree, school, year/expected_graduation
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

/* ---------- Cosine similarity ---------- */
function cosineSimilarity(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

/* ---------- Prepare & cache embeddings for all chunks ---------- */
async function ensureEmbeddings() {
  if (_embeddedChunksPromise) return _embeddedChunksPromise;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  _embeddedChunksPromise = (async () => {
    const resume = await loadResume();
    const chunks = chunkResume(resume);
    if (chunks.length === 0) return [];

    const { data } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks.map(c => c.text)
    });

    return chunks.map((c, i) => ({ ...c, embedding: data[i].embedding }));
  })();

  return _embeddedChunksPromise;
}

/* ---------- Public: buildContext(question) → { context, scoredChunks } ---------- */
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

  return {
    context: scored.map(c => `- ${c.text}`).join("\n"),
    scoredChunks: scored
  };
}

