# Experiment 7 — Preparing an LLM Application for Production-Ready Deployment

## 1. Aim
To prepare the Customer Support RAG application from Experiment 5/6 for API-based use by adding input validation, error handling, basic logging, response-time measurement, and endpoint testing.

## 2. Theory

**Prototype vs production-oriented application.** A notebook-based RAG prototype is good for experimenting, but only the person running the notebook can use it. A production-oriented application can be used by other programs, checks its inputs, handles failures safely, records what happens (logs), and is measured for speed.

**RAG (Retrieval-Augmented Generation).** The app first searches a knowledge base (our customer-support FAQ) for the most relevant passages, then gives those passages and the question to an LLM. The LLM answers using only that information. This reduces made-up answers.

**API and FastAPI.** An API lets one program send a request to another over HTTP. FastAPI is a Python framework for creating such endpoints. In this experiment:
- `POST /ask` receives a question and returns the answer.
- `GET /health` tells us the API is running.
- `/docs` is an automatic web page for testing the endpoints.

**Separating the RAG pipeline from the LLM backend.** The retriever finds documents and builds the prompt. The backend only generates the answer. Because they are separate, the model (here Mistral) can be changed without rebuilding the rest of the app.

**Cloud-hosted LLM API vs local LLM.** In a cloud API (Mistral), the model runs on the provider's server and our app calls it over the internet with an API key. In a local LLM (Ollama), the model runs on our own computer. This experiment uses the Mistral cloud API (free "Experiment" plan), which has rate limits and quotas.

**Input validation.** The app checks a request before using it. An empty question is rejected, and a question longer than 1,000 characters is rejected. This avoids useless or abusive requests and controls cost and speed.

**Error handling.** Invalid input gives a client error (HTTP 422). A model or provider failure gives a generic server error (HTTP 503), and any other problem gives HTTP 500. Stack traces, API keys, and private settings are never shown to the user.

**Logging and response time.** The app logs success or failure and latency (in milliseconds) in the console and in `app.log`. It does not log API keys or the question text. Latency is measured with `time.perf_counter()` and returned as `latency_ms`.

**Load heavy components once.** The embedding model and FAISS vector index are slow to build, so they are created once when the app starts and reused for every request.

**Secret management.** The API key is stored in a `.env` file, which is not uploaded to GitHub (listed in `.gitignore`), and not in the Python code.

**Fallback for unsupported questions.** If the FAQ does not contain the answer, the model outputs `INSUFFICIENT_CONTEXT`. The app retries the search once with a rewritten query and then returns a fallback message instead of inventing a policy.

## 3. Selected backend
☑ Cloud-hosted API (Mistral, free "Experiment" plan, model `mistral-small-latest`)  ☐ Ollama local LLM

## 4. Project structure
```
experiment7/
  app.py            # FastAPI endpoints (/ask, /health), validation, logging, latency
  support_rag.py    # Exp-6 RAG pipeline (LangChain + FAISS + LangGraph) + Mistral backend
  requirements.txt  # dependencies
  .env              # MISTRAL_API_KEY etc. (never uploaded; listed in .gitignore)
```

## 5. Procedure followed
1. Moved the Experiment 6 RAG logic (dataset loading, chunking 450/60, MiniLM embeddings, FAISS retriever k=3, LangGraph nodes) into `support_rag.py`; replaced the local Qwen model with a Mistral API call.
2. Created `app.py` with `POST /ask` and `GET /health`.
3. Embedding model, FAISS index and compiled graph are built **once** at startup (FastAPI lifespan).
4. Validation: empty / whitespace-only question rejected; max 1,000 characters.
5. Errors: invalid input → HTTP 422; Mistral failure (bad key, quota, timeout, network, wrong model) → generic HTTP 503; unexpected errors → generic HTTP 500. No stack traces or keys exposed.
6. Logging to console and `app.log` (outcome, intent, retries, latency, question *length* only — no key, no question text).
7. Latency measured with `time.perf_counter()` and returned as `latency_ms`.
8. Tested through `http://127.0.0.1:8000/docs`.

## 6. Observation table
*(Fill from your own run — `python test_api.py` prints this table. Add Swagger screenshots with the API key hidden.)*

| Test case | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Health endpoint | API reports running | | |
| Supported question | Grounded answer is returned | | |
| Unsupported question | Insufficient information/fallback | | |
| Empty question | Validation error | | |
| Backend unavailable | Controlled error; no secret details | | |
| Response-time measurement | Latency is recorded | | |

## 7. Testing checklist
- [ ] GET /health returns a successful status
- [ ] A valid question receives an answer
- [ ] An empty question is rejected
- [ ] A very long question is rejected
- [ ] An unsupported question triggers the fallback response
- [ ] A backend/network failure produces a controlled error
- [ ] Response time is recorded
- [ ] No API key or secret appears in source control, logs, or screenshots

## 8. Result
The existing RAG application was exposed through a FastAPI endpoint and tested with input validation, error handling, basic logging, and response-time measurement.

Selected backend: ☑ Cloud-hosted API ☐ Ollama local LLM

## 9. How to Run the Experiment

**Step 1 – Get a free Mistral API key**
1. Go to https://console.mistral.ai and create an account.
2. Verify your phone number and activate the free "Experiment" plan.
3. Create an API key and copy it. Keep it private.

**Step 2 – Set up the project folder**
1. Unzip `experiment7.zip` so you have the `experiment7/` folder.
2. Copy your Experiment 6 file `Customer Support Data Set.csv` into this folder. (`support_faq.txt` is created from it automatically.)
3. Open `.env` and replace `paste_your_mistral_key_here` with your key. If `mistral-small-latest` is not available, change `MISTRAL_MODEL` to another available Mistral model.

**Step 3 – Install requirements** (Python 3.10 or later)
```
cd experiment7
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate        # Mac/Linux
pip install -r requirements.txt
```

**Step 4 – Start the server**
```
uvicorn app:app
```
Wait until the console shows "Startup complete". The first start is slower because the embedding model is downloaded and the index is built.

**Step 5 – Test in the browser**
1. Open http://127.0.0.1:8000/docs.
2. Try `GET /health`.
3. Try `POST /ask` with `{"question": "How do I return a shirt that doesn't fit?"}`.
4. Try an unsupported question such as `{"question": "Do you sell home insurance?"}`.
5. Try an empty question `{"question": ""}` and a question longer than 1,000 characters.
6. Take screenshots. Do not show the API key.

**Step 6 – Run the automatic tests (optional)**
In a second terminal (same folder, venv active):
```
python test_api.py
```
It prints the observation-table rows. Wait a few seconds and rerun if you see rate-limit errors.

**Step 7 – Test backend failure**
1. Stop the server (Ctrl+C) and put a wrong key in `.env`.
2. Start the server again with `uvicorn app:app`.
3. Send any question from `/docs` or run `python test_api.py --backend-down`. You should get a generic "temporarily unavailable" error (HTTP 503) with no secret details.
4. Put the correct key back in `.env` and restart.

**Step 8 – Record results**
Fill the observation table with the actual results, check the testing checklist, and keep `app.log` to show the logged latency.

**Troubleshooting**
- `Knowledge base not found`: the CSV is not in the project folder.
- 503 on every question: check the API key, quota, internet, and model name in `.env`.
- 503 only on some questions: the free plan is rate limited, so wait a few seconds and retry.

## 10. Discussion Questions

**1. What is the purpose of FastAPI in this experiment?**
FastAPI turns the RAG notebook into a web API. Other applications can send a question to `/ask` and get an answer back. It also checks the input and gives a test page at `/docs`.

**2. What is the difference between a local LLM and a cloud-hosted LLM API?**
A local LLM (like Ollama) runs on our own computer and uses our own RAM and CPU/GPU. A cloud-hosted LLM API (like Mistral) runs on the provider's servers. Our app calls it over the internet using an API key, and it has quota and rate limits.

**3. Does hosting FastAPI in the cloud automatically host the LLM there?**
No. FastAPI only hosts our API code. The LLM stays where it runs, either on the provider's servers (Mistral) or on a separate model server (Ollama).

**4. Why should an API key not be hard-coded in Python source?**
Source code gets shared and uploaded to GitHub, so anyone could see and misuse the key. Keeping it in a `.env` file (not uploaded) keeps it private and easy to change.

**5. What is input validation, and why is a maximum question length useful?**
Input validation means checking the user's input before using it, for example rejecting an empty question. A maximum length stops very large inputs, which would slow the app and use up the API quota.

**6. What is the purpose and limitation of a health endpoint?**
Purpose: it quickly tells us that the API is running. Limitation: it does not check whether the Mistral API, the key, or the answer quality is working. The app can show "ok" and still fail on real questions.

**7. Why should the model and vector index not be loaded for every request?**
Loading the embedding model and building the FAISS index is slow and uses a lot of memory. Doing it on every request would make each answer very slow. So we load them once at startup and reuse them.

**8. What should RAG do when the answer is absent from its knowledge base?**
It should say it does not have enough information (a fallback message) instead of making up an answer. In this app the model returns `INSUFFICIENT_CONTEXT`, the search is retried once, and then the fallback message is returned.

**9. Name two reasons a cloud inference request might fail.**
1. Wrong or expired API key, or a wrong model name.
2. Free quota or rate limit exceeded (or a network problem or timeout).

**10. Is this lab application fully production-ready? Name two additional requirements for a real public service.**
No. A real public service also needs: (1) authentication, so only allowed users can call the API, and (2) rate limiting, to stop misuse. HTTPS, monitoring, and load testing are also needed.
