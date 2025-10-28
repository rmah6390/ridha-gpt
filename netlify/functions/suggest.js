const suggestions = [
  'What are your strongest technical skills?',
  'Can you summarize your recent work experience?',
  'Tell me about a project you are proud of.',
  'How have you used AI or machine learning in your work?',
  'What impact did you have at Aurora Analytics?',
  'Describe your experience with serverless architecture.',
  'How do you collaborate with cross-functional teams?',
  'Where did you study and what did you focus on?'
];

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(suggestions),
  };
};
