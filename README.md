# Ridha-GPT

Ridha-GPT is a purple, ChatGPT-style résumé assistant. It runs a React + Vite frontend backed by Netlify Functions that call OpenAI with Retrieval-Augmented Generation (RAG) over a local `resume.json` file.

## Project structure

```
/frontend             # React single-page app styled with Tailwind CSS
  src/
    App.jsx           # Chat interface
    lib/api.js        # Fetch helpers for Netlify functions
    data/resume.json  # Résumé content that powers the assistant
/netlify/functions    # Serverless functions for Q&A and suggestions
  ask.js              # RAG-powered question answering
  ask-stream.js       # Bonus SSE endpoint for typing effects
  suggest.js          # Returns starter question chips
netlify.toml          # Build settings and API redirects
```

## Requirements

Set the following environment variable before running locally or deploying:

- `OPENAI_API_KEY` – API key with access to `text-embedding-3-small` and `gpt-4o-mini` models.

## Local development

1. Install the Netlify CLI (only required once):
   ```bash
   npm i -g netlify-cli
   ```
2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```
3. Start the local dev server (this runs the Vite app and Netlify Functions together):
   ```bash
   netlify dev
   ```
4. Open the app at the URL printed by the CLI (defaults to `http://localhost:8888`).

## Deployment

1. Push the repository to GitHub.
2. In Netlify, select **Import from Git** and choose this repository.
3. In the Netlify site settings, add the environment variable `OPENAI_API_KEY`.
4. Deploy the site. Netlify will build the frontend with `npm ci && npm run build` and wire the `/api/*` routes to the functions.

## Updating résumé content

Edit `frontend/src/data/resume.json` with new experience, skills, or projects. Commit the changes and redeploy to update the assistant's knowledge.

## Acceptance testing

After deployment you can validate the key behaviours:

- Ask “What are your strongest technical skills?” and confirm the reply is a complete sentence backed by the résumé data.
- Ask for information that isn’t in `resume.json`; the answer must be exactly “I cannot confirm this from my resume.”
- Click a suggestion chip to populate the input, send the question, and receive an answer.
- (Optional) Query `/api/ask-stream?q=...` to receive Server-Sent Events that simulate typing.
