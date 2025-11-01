# Ridha-GPT

A small website that answers questions about Ridha Mahmood. It looks and feels like a chat app. It answers all questions about Ridha (skills, projects, experience, contact) and general questions.

Live demo: [https://ridha-gpts.netlify.app/)]

## Why I built this

I wanted a quick way for recruiters and hiring managers to learn about me without digging through documents. This site gives short professional asnswers about me. No buzzwords. No long paragraphs.

## What it does

* Chat UI with a lightweight, clean purple theme
* Answers about Ridha
* Gives short answers by default 
* Never mentions where info came from
* Can also answer general questions (not only about Ridha)
* Includes a contact answer: email and LinkedIn

## How it works

* **Frontend:** React + Vite + Tailwind (in frontend/)
* **API:** Netlify Functions (in netlify/functions/)
* **Profile data:** frontend/src/data/resume.json
* **RAG:** The functions embed small chunks of the profile JSON and pull the most relevant lines for a question. The model then writes a short answer in third person.


## Project structure

```
.
├── netlify/
│   └── functions/
│       ├── _shared/
│       │   └── rag.mjs        # prompt + retrieval logic (she/her, short answers)
│       ├── ask.mjs            # main chat endpoint
│       ├── ask-stream.mjs     # optional SSE endpoint
│       └── suggest.js         # starter question chips
└── frontend/
    ├── index.html
    └── src/
        ├── App.jsx            # chat UI
        ├── main.jsx
        └── data/
            └── resume.json    # profile data (edit me)
```



## Contact

If you want to connect:                                                                                                                            
**Email:** [rmah6390@gmail.com](mailto:rmah6390@gmail.com)                                                                                
**LinkedIn:** [https://www.linkedin.com/in/ridha-mahmood](https://www.linkedin.com/in/ridha-mahmood)

---

## License

MIT. Use any parts you find helpful.
