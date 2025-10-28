const { SYSTEM_PROMPT, openai, buildContext } = require('./_shared/rag');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') {
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

  const question = (event.queryStringParameters?.q || '').trim();
  if (!question) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Query parameter "q" is required' }),
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
    const words = answer.split(' ');
    const chunks = [];
    let buffer = '';

    words.forEach((word) => {
      buffer = buffer ? `${buffer} ${word}` : word;
      if (buffer.length >= 24) {
        chunks.push(`data: ${JSON.stringify(buffer)}\n\n`);
        buffer = '';
      }
    });

    if (buffer) {
      chunks.push(`data: ${JSON.stringify(buffer)}\n\n`);
    }

    chunks.push('data: [DONE]\n\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
      body: chunks.join(''),
    };
  } catch (error) {
    console.error('ask-stream error', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate answer' }),
    };
  }
};
