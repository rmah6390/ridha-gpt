const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const SYSTEM_PROMPT = `You are Ridha-GPT, a personal assistant that answers only using the provided resume context. Always respond in complete sentences. If the resume does not contain the answer, say: "I cannot confirm this from my resume."`;

const resumePath = path.resolve(__dirname, '../../../frontend/src/data/resume.json');
const resumeData = JSON.parse(fs.readFileSync(resumePath, 'utf-8'));

function chunkResume(data) {
  const chunks = [];
  if (data.summary) {
    chunks.push({ id: 'summary', text: `Summary: ${data.summary}` });
  }

  if (Array.isArray(data.skills)) {
    data.skills.forEach((skill, index) => {
      if (skill.category || skill.details) {
        chunks.push({
          id: `skill-${index}`,
          text: `${skill.category ? `${skill.category}: ` : ''}${skill.details ?? ''}`.trim(),
        });
      }
    });
  }

  if (Array.isArray(data.experience)) {
    data.experience.forEach((job, jobIndex) => {
      const base = [`Experience: ${job.role ?? ''} at ${job.company ?? ''}`.trim()];
      if (job.period || job.location) {
        base.push([job.period, job.location].filter(Boolean).join(' — '));
      }
      const header = base.filter(Boolean).join('\n');
      if (Array.isArray(job.bullets)) {
        job.bullets.forEach((bullet, bulletIndex) => {
          chunks.push({
            id: `experience-${jobIndex}-${bulletIndex}`,
            text: `${header}\n• ${bullet}`.trim(),
          });
        });
      } else if (header) {
        chunks.push({
          id: `experience-${jobIndex}`,
          text: header,
        });
      }
    });
  }

  if (Array.isArray(data.projects)) {
    data.projects.forEach((project, projectIndex) => {
      const base = [`Project: ${project.name ?? ''}`.trim()];
      if (project.description) {
        base.push(project.description);
      }
      if (Array.isArray(project.highlights) && project.highlights.length > 0) {
        project.highlights.forEach((highlight, highlightIndex) => {
          chunks.push({
            id: `project-${projectIndex}-${highlightIndex}`,
            text: `${base.join('\n')}\n• ${highlight}`.trim(),
          });
        });
      } else {
        chunks.push({
          id: `project-${projectIndex}`,
          text: base.join('\n'),
        });
      }
    });
  }

  if (Array.isArray(data.education)) {
    data.education.forEach((edu, eduIndex) => {
      const parts = [
        `Education: ${edu.institution ?? ''}`.trim(),
        edu.degree,
        edu.period,
        edu.details,
      ].filter(Boolean);
      if (parts.length) {
        chunks.push({
          id: `education-${eduIndex}`,
          text: parts.join('\n'),
        });
      }
    });
  }

  return chunks;
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (!magnitudeA || !magnitudeB) return 0;
  return dot / (magnitudeA * magnitudeB);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chunks = chunkResume(resumeData);
let preparedEmbeddingsPromise = null;

async function ensureEmbeddings() {
  if (preparedEmbeddingsPromise) {
    return preparedEmbeddingsPromise;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable.');
  }

  preparedEmbeddingsPromise = (async () => {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunks.map((chunk) => chunk.text),
    });

    return chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddingResponse.data[index].embedding,
    }));
  })();

  return preparedEmbeddingsPromise;
}

async function buildContext(question, topK = 6) {
  const embeddedChunks = await ensureEmbeddings();
  const queryEmbeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  });

  const queryVector = queryEmbeddingResponse.data[0].embedding;
  const scoredChunks = embeddedChunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryVector, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const context = scoredChunks.map((chunk) => `- ${chunk.text}`).join('\n');
  return { context, scoredChunks };
}

module.exports = {
  SYSTEM_PROMPT,
  openai,
  buildContext,
};
