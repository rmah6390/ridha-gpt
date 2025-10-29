import fs from "fs/promises";
import path from "path";

export const handler = async () => {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "frontend", "src", "data", "resume.json"),
    path.join(cwd, "src", "data", "resume.json")
  ];

  const checks = [];
  for (const p of candidates) {
    try { await fs.access(p); checks.push({ path: p, exists: true }); }
    catch { checks.push({ path: p, exists: false }); }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cwd,
      hasKey: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith("sk")),
      resumeCandidates: checks
    })
  };
};
