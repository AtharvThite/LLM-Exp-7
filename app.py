"""
app.py - FastAPI endpoints, validation, logging and latency measurement.

Run:   uvicorn app:app --reload
Docs:  http://127.0.0.1:8000/docs
"""
import logging
import time
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

import support_rag

MAX_QUESTION_LENGTH = 1000

# ------------------------------------------------------------------ Logging
# Logs go to console + app.log. We log outcome, latency and question LENGTH
# only - never the API key and never the raw question text (may be personal).
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("app.log")],
)
logger = logging.getLogger("api")


# ------------------------------------------------- Startup: load heavy parts once
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up: building embeddings + vector index (once)...")
    support_rag.initialize()
    logger.info("Startup complete")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Customer Support RAG API",
    description="Experiment 7 - RAG app (LangChain + LangGraph) with Groq API backend.",
    version="1.0.0",
    lifespan=lifespan,
)


# ------------------------------------------------------------------ Schemas
class AskRequest(BaseModel):
    question: str = Field(..., description="Customer question (1-1000 characters)")

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Question must not be empty.")
        if len(v) > MAX_QUESTION_LENGTH:
            raise ValueError(
                f"Question is too long (maximum {MAX_QUESTION_LENGTH} characters)."
            )
        return v


class AskResponse(BaseModel):
    answer: str
    intent: str
    sources: List[str]
    fallback: bool
    latency_ms: float


# ----------------------------------------------------------- Error handlers
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Invalid input -> 422 client error with a short, safe message."""
    messages = [
        e.get("msg", "Invalid input").replace("Value error, ", "")
        for e in exc.errors()
    ]
    logger.warning("Rejected invalid request to %s", request.url.path)
    return JSONResponse(status_code=422, content={"error": "Invalid input", "details": messages})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    """Anything unexpected -> generic 500. No stack trace / config is exposed."""
    logger.error("Unhandled error on %s: %s", request.url.path, type(exc).__name__)
    return JSONResponse(status_code=500, content={"error": "Internal server error."})


# ---------------------------------------------------------------- Endpoints
@app.get("/")
def root():
    return {
        "message": "Customer Support RAG API is running",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    """Reports that the API process is running and the RAG index is loaded.
    Limitation: it does NOT verify that the Groq API is reachable."""
    return {"status": "ok", "rag_ready": support_rag.is_ready()}


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    start = time.perf_counter()
    try:
        result = support_rag.answer_question(req.question)
    except support_rag.LLMBackendError as exc:
        latency = (time.perf_counter() - start) * 1000
        # Detail (e.g. "401", "timeout") goes to the log only, not the client
        logger.error("ask FAILED | backend_error=%s | latency_ms=%.1f | q_len=%d",
                     exc, latency, len(req.question))
        return JSONResponse(
            status_code=503,
            content={"error": "The answer service is temporarily unavailable. Please try again later."},
        )

    latency = (time.perf_counter() - start) * 1000
    logger.info("ask OK | intent=%s | fallback=%s | retries=%d | latency_ms=%.1f | q_len=%d",
                result["intent"], result["fallback"], result["retries"],
                latency, len(req.question))
    return AskResponse(
        answer=result["answer"],
        intent=result["intent"],
        sources=result["sources"],
        fallback=result["fallback"],
        latency_ms=round(latency, 1),
    )
