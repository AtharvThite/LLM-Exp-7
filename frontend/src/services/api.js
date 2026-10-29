/**
 * API service for communicating with the FastAPI RAG backend with rich error handling.
 */

export class ApiError extends Error {
  constructor({ message, status = 0, type = 'UNKNOWN', details = null, suggestion = '' }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.type = type;
    this.details = details;
    this.suggestion = suggestion;
  }
}

const BACKEND_URL = import.meta.env.VITE_API_URL || '';

export async function checkHealth(customBaseUrl = '') {
  const base = customBaseUrl || BACKEND_URL;
  const endpoint = base ? `${base}/health` : '/api/health';

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new ApiError({
        message: `Health check returned HTTP ${res.status}`,
        status: res.status,
        type: 'HEALTH_CHECK_FAILED',
        suggestion: 'Check if the backend server is running and healthy.',
      });
    }

    const data = await res.json();
    return data;
  } catch (err) {
    // If proxy failed, try direct connection fallback
    if (!customBaseUrl && endpoint === '/api/health') {
      try {
        const directRes = await fetch('http://127.0.0.1:8000/health');
        if (directRes.ok) return await directRes.json();
      } catch {
        // Fallback also failed
      }
    }

    if (err instanceof ApiError) throw err;

    throw new ApiError({
      message: 'Cannot connect to backend server',
      status: 0,
      type: 'NETWORK_ERROR',
      details: 'The backend service is not responding at http://127.0.0.1:8000/health.',
      suggestion: 'Start the FastAPI server: cd backend && uvicorn app:app --reload --port 8000',
    });
  }
}

export async function askQuestion(question, customBaseUrl = '') {
  const base = customBaseUrl || BACKEND_URL;
  const endpoint = base ? `${base}/ask` : '/api/ask';

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ question }),
    });
  } catch (networkErr) {
    // Attempt direct URL fallback if proxy failed
    if (!customBaseUrl && endpoint === '/api/ask') {
      try {
        response = await fetch('http://127.0.0.1:8000/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ question }),
        });
      } catch {
        throw new ApiError({
          message: 'Backend server connection refused',
          status: 0,
          type: 'NETWORK_ERROR',
          details: 'Failed to establish HTTP connection to http://127.0.0.1:8000/ask.',
          suggestion: 'Ensure the FastAPI backend is running: cd backend && uvicorn app:app --reload',
        });
      }
    } else {
      throw new ApiError({
        message: 'Backend server connection refused',
        status: 0,
        type: 'NETWORK_ERROR',
        details: 'Failed to establish HTTP connection to backend endpoint.',
        suggestion: 'Verify the Backend URL in settings and make sure the server is online.',
      });
    }
  }

  // Parse JSON response safely
  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    const rawText = await response.text().catch(() => '');
    throw new ApiError({
      message: `Invalid server response (${response.status})`,
      status: response.status,
      type: 'PARSE_ERROR',
      details: rawText || 'Server did not return valid JSON.',
      suggestion: 'Check backend console logs for unexpected exceptions.',
    });
  }

  // Handle HTTP error statuses
  if (!response.ok) {
    if (response.status === 422) {
      const details = Array.isArray(data.details)
        ? data.details.join('; ')
        : data.error || 'Input validation failed';
      throw new ApiError({
        message: 'Validation Error (HTTP 422)',
        status: 422,
        type: 'VALIDATION_ERROR',
        details: details,
        suggestion: 'Make sure your question is between 1 and 1000 characters and not empty.',
      });
    }

    if (response.status === 503) {
      throw new ApiError({
        message: 'LLM Backend Unavailable (HTTP 503)',
        status: 503,
        type: 'SERVICE_UNAVAILABLE',
        details: data.error || 'The answer service is temporarily unavailable.',
        suggestion:
          'Check that GROQ_API_KEY in backend/.env is valid and your Groq account has available quota.',
      });
    }

    if (response.status === 500) {
      throw new ApiError({
        message: 'Internal Server Error (HTTP 500)',
        status: 500,
        type: 'SERVER_ERROR',
        details: data.error || 'Internal server error encountered while processing your question.',
        suggestion: 'Inspect backend/app.log to identify the unhandled exception.',
      });
    }

    throw new ApiError({
      message: `HTTP Error ${response.status}`,
      status: response.status,
      type: 'HTTP_ERROR',
      details: data.error || JSON.stringify(data),
      suggestion: 'Review backend server status.',
    });
  }

  return data;
}
