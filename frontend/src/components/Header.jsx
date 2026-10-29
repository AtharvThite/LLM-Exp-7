import React, { useState } from 'react';
import { Bot, RefreshCw, Settings, Trash2, CheckCircle, AlertTriangle, X } from 'lucide-react';

export default function Header({
  healthStatus,
  isCheckingHealth,
  onRefreshHealth,
  onResetChat,
  backendUrl,
  onUpdateBackendUrl,
  hasMessages,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState(backendUrl || 'http://127.0.0.1:8000');

  const handleSaveSettings = (e) => {
    e.preventDefault();
    onUpdateBackendUrl(urlInput.trim());
    setShowSettings(false);
  };

  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-zinc-200/80 transition-all">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-5 h-5 text-zinc-100" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold text-zinc-900 tracking-tight">
                Support Assistant
              </h1>
              <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                RAG Pipeline
              </span>
            </div>
            <p className="text-xs text-zinc-500 hidden sm:block">
              Fast accurate answers from knowledge base &amp; Groq LLM
            </p>
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center space-x-2">
          {/* Health indicator badge */}
          <button
            onClick={onRefreshHealth}
            title="Click to check backend status"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white hover:bg-zinc-50 transition border-zinc-200 shadow-2xs"
          >
            {isCheckingHealth ? (
              <RefreshCw className="w-3 h-3 text-zinc-400 animate-spin" />
            ) : healthStatus.ready ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            )}
            <span className={healthStatus.ready ? 'text-zinc-700' : 'text-amber-700'}>
              {healthStatus.ready ? 'Online' : 'Offline'}
            </span>
          </button>

          {/* New Chat */}
          {hasMessages && (
            <button
              onClick={onResetChat}
              title="Clear current conversation"
              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Settings Trigger */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Configure Backend URL"
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal / Dropdown */}
      {showSettings && (
        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 transition">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-zinc-600">
              <span className="font-semibold text-zinc-800">Backend Endpoint:</span> By default requests go to{' '}
              <code className="bg-zinc-200/70 px-1 py-0.5 rounded text-zinc-800">http://127.0.0.1:8000</code>.
            </div>
            <form onSubmit={handleSaveSettings} className="flex items-center gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://127.0.0.1:8000"
                className="text-xs px-2.5 py-1.5 border border-zinc-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 w-56"
              />
              <button
                type="submit"
                className="text-xs font-medium px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
