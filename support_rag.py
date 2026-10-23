"""
support_rag.py - Customer Support RAG pipeline (from Experiment 6)
with a Groq cloud-hosted LLM backend (Experiment 7, Option A).

Contents
  1. Configuration (read from environment / .env, never hard-coded)
  2. Dataset loading + chunking
  3. Embeddings + FAISS retriever          -> built ONCE by initialize()
  4. LLM backend (Groq API)                -> generate_with_groq()
  5. LangGraph workflow (same nodes as Experiment 6)
  6. answer_question()                     -> the single function app.py calls
"""
import logging
import os
import time
from typing import List, TypedDict

import requests
from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph import END, START, StateGraph

load_dotenv()  # reads .env (which is excluded from version control)
logger = logging.getLogger("support_rag")

# ---------------------------------------------------------------- 1. Config
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_API_URL = os.getenv(
    "GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions"
).strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()
FAQ_PATH = os.getenv("FAQ_PATH", "support_faq.txt")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT_SECONDS", "30"))
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

FALLBACK_TEXT = (
    "I couldn't find a reliable answer in the available FAQ. Please contact "
    "the appropriate support team for further assistance. Do not share "
    "passwords, verification codes, or full payment-card details."
)


class LLMBackendError(Exception):
    """Raised when the Groq API fails. Message is safe to log (no secrets)."""


# Reusable components - created once in initialize(), not per request
retriever = None
dataset_categories: List[str] = []
support_graph = None


# ------------------------------------------------- 2. Dataset load + chunking
def load_faq_text():
    """Return (faq_text, categories) loaded from support_faq.txt."""
    if not os.path.exists(FAQ_PATH):
        raise FileNotFoundError(
            f"Knowledge base not found. Place '{FAQ_PATH}' in the project folder."
        )

    with open(FAQ_PATH, "r", encoding="utf-8") as f:
        text = f.read()
    cats = sorted({b.split("\n")[0].strip() for b in text.split("\n\n") if b.strip()})
    return text, cats


# ----------------------------------------- 3. Embeddings + FAISS (build once)
def initialize():
    """Load data, build the vector index and compile the graph ONE time."""
    global retriever, dataset_categories, support_graph

    faq_text, dataset_categories = load_faq_text()
    faq_doc = Document(page_content=faq_text, metadata={"source": "support_faq.txt"})
    splitter = RecursiveCharacterTextSplitter(chunk_size=450, chunk_overlap=60)
    chunks = splitter.split_documents([faq_doc])

    embedding_model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    vector_store = FAISS.from_documents(chunks, embedding_model)
    retriever = vector_store.as_retriever(
        search_type="similarity", search_kwargs={"k": 3}
    )
    support_graph = build_graph()
    logger.info("RAG ready: %d chunks, %d categories", len(chunks), len(dataset_categories))


def is_ready() -> bool:
    return support_graph is not None


# ------------------------------------------------ 4. LLM backend (Groq API)
def generate_with_groq(prompt: str) -> str:
    """Call the Groq chat-completions API. Raises LLMBackendError on any
    failure; error text never contains the API key or response bodies."""
    if not GROQ_API_KEY or GROQ_API_KEY.startswith("paste_your"):
        raise LLMBackendError("GROQ_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 200,
    }

    for attempt in (1, 2):
        try:
            resp = requests.post(
                GROQ_API_URL, headers=headers, json=payload, timeout=LLM_TIMEOUT
            )
        except requests.exceptions.Timeout:
            raise LLMBackendError("Groq request timed out")
        except requests.exceptions.RequestException:
            raise LLMBackendError("Network error while contacting Groq")

        if resp.status_code == 429 and attempt == 1:
            # Free tier is rate limited: wait briefly, retry once
            wait = min(float(resp.headers.get("Retry-After", 2) or 2), 10)
            logger.warning("Groq rate limit hit; retrying in %.1fs", wait)
            time.sleep(wait)
            continue
        def _error_detail() -> str:
            try:
                msg = resp.json().get("error", {}).get("message")
                return f" - {msg}" if msg else ""
            except Exception:
                return f" - {resp.text[:150]}" if resp.text else ""

        if resp.status_code == 401:
            raise LLMBackendError(f"Groq rejected the API key (401){_error_detail()}")
        if resp.status_code == 404:
            raise LLMBackendError(f"Groq model name/endpoint not found (404){_error_detail()}")
        if resp.status_code == 429:
            raise LLMBackendError(f"Groq quota/rate limit exceeded (429){_error_detail()}")
        if resp.status_code != 200:
            raise LLMBackendError(f"Groq returned HTTP {resp.status_code}{_error_detail()}")

        try:
            return resp.json()["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, ValueError):
            raise LLMBackendError("Unexpected response format from Groq")


# ------------------------------------------- 5. LangGraph workflow (Exp 6)
class SupportState(TypedDict, total=False):
    question: str
    intent: str
    search_query: str
    context: str
    sources: List[str]
    draft: str
    retry_count: int
    final_answer: str


def classify_intent(state: SupportState):
    q = state["question"].lower()
    keyword_rules = [
        ("Returns", ["return", "refund", "exchange"]),
        ("Shipping", ["shipping", "shipment", "delivery", "tracking",
                      "package", "arrived", "shipping address"]),
        ("Orders", ["order", "track my order", "order status"]),
        ("Payment", ["payment", "paid", "charge", "charged", "billing",
                     "card", "declined", "invoice"]),
        ("Sizing", ["size", "fit", "measurements"]),
        ("Product Info", ["product", "material", "color", "available", "features"]),
        ("Account", ["account", "password", "login", "sign in"]),
        ("Support", ["support", "help", "contact"]),
    ]
    intent = None
    for category, keywords in keyword_rules:
        if any(k in q for k in keywords) and category in dataset_categories:
            intent = category
            break
    if intent is None:
        intent = "Support" if "Support" in dataset_categories else "General"
    return {
        "intent": intent,
        "search_query": state["question"],
        "retry_count": state.get("retry_count", 0),
    }


def retrieve_context(state: SupportState):
    docs = retriever.invoke(state["search_query"])
    return {
        "context": "\n\n".join(d.page_content for d in docs),
        "sources": [d.metadata.get("source", "unknown") for d in docs],
    }


def draft_answer(state: SupportState):
    prompt = f"""You are a polite customer-support assistant.

Answer the customer question using ONLY the FAQ CONTEXT.
Do not invent policies, delivery statuses, refund approvals,
prices, or timelines.

If the context does not contain enough information to answer,
output exactly:
INSUFFICIENT_CONTEXT

Never request passwords, one-time verification codes,
or full payment-card details.

Keep the answer concise and helpful.

FAQ CONTEXT:
{state.get("context", "")}

CUSTOMER QUESTION:
{state["question"]}

ANSWER:"""
    return {"draft": generate_with_groq(prompt)}


def review_answer(state: SupportState):
    draft = state.get("draft", "").strip()
    if not draft or "INSUFFICIENT_CONTEXT" in draft.upper():
        return {"final_answer": ""}
    return {"final_answer": draft}


def route_after_review(state: SupportState):
    if state.get("final_answer"):
        return "finish"
    if state.get("retry_count", 0) < 1:
        return "retry"
    return "fallback"


def rewrite_query(state: SupportState):
    category_terms = {
        "Shipping": "shipping delivery tracking package",
        "Orders": "order details order status order tracking",
        "Order Management": "manage order change cancel order",
        "Returns": "return eligibility exchange refund process",
        "Payment": "payment declined billing charges",
        "Product Info": "product details features availability",
        "Sizing": "size fit measurements size guide",
        "Account": "account access login password",
        "Support": "customer support help contact",
        "IT Support": "technical support troubleshooting",
        "Web Support": "website support troubleshooting",
        "IT Access": "IT access login credentials",
        "IT Security": "IT security account safety",
    }
    extra = category_terms.get(state.get("intent", "Support"), "customer support help")
    return {
        "search_query": state["question"] + " " + extra,
        "retry_count": state.get("retry_count", 0) + 1,
    }


def fallback_answer(state: SupportState):
    return {"final_answer": FALLBACK_TEXT}


def build_graph():
    g = StateGraph(SupportState)
    g.add_node("classify_intent", classify_intent)
    g.add_node("retrieve", retrieve_context)
    g.add_node("draft_answer", draft_answer)
    g.add_node("review_answer", review_answer)
    g.add_node("rewrite_query", rewrite_query)
    g.add_node("fallback", fallback_answer)

    g.add_edge(START, "classify_intent")
    g.add_edge("classify_intent", "retrieve")
    g.add_edge("retrieve", "draft_answer")
    g.add_edge("draft_answer", "review_answer")
    g.add_conditional_edges(
        "review_answer",
        route_after_review,
        {"finish": END, "retry": "rewrite_query", "fallback": "fallback"},
    )
    g.add_edge("rewrite_query", "retrieve")
    g.add_edge("fallback", END)
    return g.compile()


# --------------------------------------------------- 6. Public entry point
def answer_question(question: str) -> dict:
    """Run the RAG workflow. Raises LLMBackendError if Groq fails."""
    if not is_ready():
        raise RuntimeError("RAG pipeline is not initialized")
    result = support_graph.invoke({"question": question, "retry_count": 0})
    answer = result.get("final_answer", "")
    return {
        "answer": answer,
        "intent": result.get("intent", "Unknown"),
        "sources": sorted(set(result.get("sources", []))),
        "retries": result.get("retry_count", 0),
        "fallback": answer == FALLBACK_TEXT,
    }
