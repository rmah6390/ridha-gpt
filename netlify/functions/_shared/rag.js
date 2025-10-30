// netlify/functions/_shared/rag.js
import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

/* --- NEW SYSTEM PROMPT (third-person, no resume mentions, auto-route) --- */
export const SYSTEM_PROMPT =
  "You are a professional assistant for the candidate Ridha Mahmood. " +
  "When the user is asking about Ridha (including when they speak in first person), " +
  "answer in third person, recruiter-friendly prose (e.g., “Ridha’s skills include …”). " +
  "Use the Profile Context as the source of truth when the question is about Ridha. " +
  "Do not mention or hint at where the information came from. " +
  "Write clear, complete sentences. " +
  "If the question is NOT about Ridha (general knowledge), ignore the context and answer normally. " +
  "If specific information about Ridha is not in the context, answer concisely without speculating, " +
  "but do not mention any lack of data source.";

const RESUME_PATHS = [
  path.join(process.cwd(), "frontend", "src", "data", "resume.json"),
  path.join(process.cwd(), "src", "data", "resume.json"),
];

let _resumeCache = null;
let _embeddedChunksPromise = null;

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function resolveResumePath() {
  for (const p of RESUME_PATHS) {
    try { await fs.access(p); return p; } catch {}
  }
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
  if (data.summary) chunks.push({ id: "summary", text: `Summary: ${data.summary}` });

  const skills = data.technical_skills?.programming_languages ?? data.skills ?? [];
  if (Array.isArray(skills) && skills.length) {
    chunks.push({ id: "skills", text: `Skills: ${skills.join(", ")}` });
  }

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
