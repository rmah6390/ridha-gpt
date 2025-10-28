const headers = {
  'Content-Type': 'application/json',
};

export async function ask(question) {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers,
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.answer ?? 'I cannot confirm this from my resume.';
}

export async function getSuggestions() {
  const response = await fetch('/api/suggest');
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}
