// netlify/functions/ask.js
import { getAnswer } from './_shared/rag.js';

export async function handler(event) {
  const t0 = Date.now();
  try {
    const { question } = event.queryStringParameters || {};
    const body = event.body && !question ? JSON.parse(event.body) : null;
    const q = question ?? body?.question ?? body?.q ?? '';

    const answer = await getAnswer(q);

    const ms = Date.now() - t0;
    console.log(`ASK duration=${ms}ms question="${String(q).slice(0,80)}"`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer, _metrics: { server_ms: ms } })
    };
  } catch (err) {
    const ms = Date.now() - t0;
    console.error('ASK FUNCTION ERROR:', err, `duration=${ms}ms`);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
}
