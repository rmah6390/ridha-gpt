const { SYSTEM_PROMPT, openai, buildContext } = require('./_shared/rag');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  let question = '';
  try {
    const body = JSON.parse(event.body || '{}');
    question = typeof body.question === 'string' ? body.question.trim() : '';
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  if (!question) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Question is required' }),
    };
  }

  try {
    const { context } = await buildContext(question);
    const userContent = `Resume context:\n${context || '- No relevant resume snippets found.'}\n\nQuestion: ${question}\n\nRemember to respond in complete sentences.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || 'I cannot confirm this from my resume.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    };
  } catch (error) {
    console.error('ask function error', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate answer' }),
    };
  }
};
