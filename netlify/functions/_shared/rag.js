// netlify/functions/_shared/rag.js  (ESM version)
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

export const SYSTEM_PROMPT =
  `You are Ridha-GPT, a personal assistant that answers only using the provided resume context. ` +
  `Always respond in complete sentences. If the resume does not contain the answer, say: ` +
  `"I cannot confirm this from my resume."`;

// --- locate resume.json reliably in ESM ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resumePath = path.resolve(__dirname, "../../../frontend/src/data/resume.json");

// lazy-load + cache
let _resumeData;
async function getResume() {
  if (_resumeData) return _resumeData;
  const raw = await fs.readFile(resumePath, "utf-8");
  _resumeData = JSON.parse(raw);
  return _resumeData;
}

// tolerant chunker: handles both your current schema and earlier variants
function chunkResume(data) {
  const chunks = [];

  if (data.summary) chunks.push({ id: "summary", text: `Summary: ${data.summary}` });

  // skills (supports either "technical_skills.programming_languages" or flat "skills")
  const skills =
    data.technical_skills?.programming_languages ??
    data.skills ??
    [];
  if (Array.isArray(skills) && skills.length) {
    chunks.push({ id: "skills", text: `Skills: ${skills.join(", ")}` });
  }

  // experience
  if (Array.isArray(data.experience)) {
    data.experience.forEach((job, i) => {
      const header = [
        `Experience: ${job.role ?? ""} at ${job.company ?? ""}`.trim(),
        [job.start, job.end].filter(Boolean).join(" – "),
        job.location
      ].filter(Boolean).join("\n");

      if (Array.isArray(job.bullets) && job.bullets.length) {
        job.bullets.forEach((b, j) =>
          chunks.push({ id: `exp-${i}-${j}`, text: `${header}\n• ${b}`.trim() })
        );
      } else if (header) {
        chunks.push({ id: `exp-${i}`, text: header });
      }
    });
  }

  // projects (supports {name, details[]} or {name, desc})
  if (Array.isArray(data.projects)) {
    data.projects.forEach((p, i) => {
      const base = [`Project: ${p.name ?? ""}`.trim()];
      if (p.desc) base.push(p.desc);
      if (Array.isArray(p.details) && p.details.length) {
        p.details.forEach((d, j) =>
          chunks.push({ id: `proj-${i}-${j}`, text: `${base.join("\n")}\n• ${d}`.trim() })
        );
      } else if (Array.isArray(p.highlights) && p.highlights.length) {
        p.highlights.forEach((d, j) =>
          chunks.push({ id: `proj-${i}-${j}`, text: `${base.join("\n")}\n• ${d}`.trim() })
        );
      } else {
        chunks.push({ id: `proj-${i}`, text: base.join("\n") });
      }
    });
  }

  // education (supports {degree, school, year|expected_graduation})
  if (Array.isArray(data.education)) {
    data.education.forEach((e, i) => {
      const line = [
        `Education: ${e.degree ?? ""}`.trim(),
        e.school,
        e.expected_graduation ?? e.year
      ].filter(Boolean).join(" — ");
      if (line) chunks.push({ id: `edu-${i}`, text: line });
    });
  }

  return chunks;
}

// cosine similarity
function cosineSimilarity(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let _embeddedChunksPromise;
async function ensureEmbeddings() {
  if (_embeddedChunksPromise) return _embeddedChunksPromise;
  if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  _embeddedChunksPromise = (async () => {
    const resume = await getResume();
    const chunks = chunkResume(resume);
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
