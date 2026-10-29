import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import EmptyState from './components/EmptyState';
import MessageItem from './components/MessageItem';
import InputArea from './components/InputArea';
import { checkHealth, askQuestion, ApiError } from './services/api';
import { AlertCircle, WifiOff, X, RefreshCw, Bot } from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('support_rag_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [backendUrl, setBackendUrl] = useState(() => {
    return localStorage.getItem('support_rag_backend_url') || '';
  });

  const [healthStatus, setHealthStatus] = useState({ ready: false, status: 'checking' });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const messagesEndRef = useRef(null);

  // Sync messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('support_rag_chat_history', JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Sync custom backend URL
  const handleUpdateBackendUrl = (url) => {
    setBackendUrl(url);
    localStorage.setItem('support_rag_backend_url', url);
    verifyBackendHealth(url);
  };

  // Check health on mount and when backendUrl changes
  const verifyBackendHealth = async (url = backendUrl) => {
    setIsCheckingHealth(true);
    try {
      const res = await checkHealth(url);
      setHealthStatus({ ready: Boolean(res.rag_ready), status: res.status || 'ok' });
      // Clear global connection error if connection restored
      if (globalError && globalError.type === 'NETWORK_ERROR') {
        setGlobalError(null);
      }
    } catch (err) {
      setHealthStatus({ ready: false, status: 'offline' });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    verifyBackendHealth();
    // Periodically re-check health every 30 seconds
    const interval = setInterval(() => verifyBackendHealth(), 30000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmitQuestion = async (customQuestion) => {
    const questionText = (customQuestion || input).trim();
    if (!questionText || isLoading) return;

    setGlobalError(null);
    setInput('');

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: questionText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const result = await askQuestion(questionText, backendUrl);

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        intent: result.intent,
        sources: result.sources || [],
        fallback: result.fallback || false,
        latency_ms: result.latency_ms,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error submitting question:', err);

      const errorPayload = {
        message: err.message || 'Failed to get answer',
        status: err.status || 0,
        type: err.type || 'UNKNOWN',
        details: err.details || null,
        suggestion: err.suggestion || 'Please check backend logs or retry in a moment.',
      };

      // Add rich error message to chat flow
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'error',
        content: errorPayload.message,
        originalQuestion: questionText,
        errorData: errorPayload,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      // Set global alert banner for high-visibility notice
      setGlobalError(errorPayload);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = (questionToRetry) => {
    if (!questionToRetry || isLoading) return;
    // Remove the last error card if present
    setMessages((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].role === 'error') {
        return prev.slice(0, -1);
      }
      return prev;
    });
    // Remove the user question clone that will be re-added by submit
    setMessages((prev) => {
      if (
        prev.length > 0 &&
        prev[prev.length - 1].role === 'user' &&
        prev[prev.length - 1].content === questionToRetry
      ) {
        return prev.slice(0, -1);
      }
      return prev;
    });

    handleSubmitQuestion(questionToRetry);
  };

  const handleResetChat = () => {
    if (window.confirm('Are you sure you want to clear this conversation?')) {
      setMessages([]);
      setGlobalError(null);
      localStorage.removeItem('support_rag_chat_history');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900">
      {/* Header */}
      <Header
        healthStatus={healthStatus}
        isCheckingHealth={isCheckingHealth}
        onRefreshHealth={() => verifyBackendHealth()}
        onResetChat={handleResetChat}
        backendUrl={backendUrl}
        onUpdateBackendUrl={handleUpdateBackendUrl}
        hasMessages={messages.length > 0}
      />

      {/* Global Connectivity / Diagnostic Warning Banner */}
      {globalError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 transition">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-xs text-rose-900">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong className="font-semibold">{globalError.message}:</strong>{' '}
                {globalError.details || globalError.suggestion}
              </span>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={() => verifyBackendHealth()}
                className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Check Backend</span>
              </button>
              <button
                onClick={() => setGlobalError(null)}
                className="text-rose-400 hover:text-rose-700 p-0.5 rounded"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 flex flex-col pt-6 pb-2">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState onSelectSuggestion={(q) => handleSubmitQuestion(q)} />
          </div>
        ) : (
          <div className="flex-1 space-y-2 pb-6">
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} onRetry={handleRetry} />
            ))}

            {/* Assistant Loading Placeholder */}
            {isLoading && (
              <div className="flex justify-start items-start space-x-2 py-3 animate-fade-in">
                <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-zinc-200 rounded-2xl rounded-tl-xs p-4 shadow-2xs text-xs text-zinc-500 flex items-center space-x-2.5">
                  <div className="flex space-x-1">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                  </div>
                  <span>Searching FAQ and generating answer...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Floating Bottom Input */}
      <InputArea
        input={input}
        setInput={setInput}
        onSubmit={() => handleSubmitQuestion()}
        isLoading={isLoading}
        disabled={false}
        isBackendOffline={!healthStatus.ready && healthStatus.status === 'offline'}
      />
    </div>
  );
}
