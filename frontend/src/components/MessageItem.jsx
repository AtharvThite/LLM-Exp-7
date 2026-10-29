import React, { useState } from 'react';
import {
  Bot,
  User,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Tag,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';

export default function MessageItem({ message, onRetry }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // User message bubble
  if (isUser) {
    return (
      <div className="flex justify-end items-end space-x-2 py-2">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-xs bg-zinc-900 text-white px-4 py-3 text-sm shadow-xs leading-relaxed">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center shrink-0 mb-1">
          <User className="w-4 h-4" />
        </div>
      </div>
    );
  }

  // Error message card
  if (isError) {
    const errorData = message.errorData || {};
    return (
      <div className="flex justify-start items-start space-x-2 py-3">
        <div className="w-7 h-7 rounded-full bg-rose-100 border border-rose-300 text-rose-600 flex items-center justify-center shrink-0 mt-1">
          <AlertCircle className="w-4 h-4" />
        </div>

        <div className="max-w-[90%] sm:max-w-[85%] bg-rose-50/60 border border-rose-200/90 rounded-2xl rounded-tl-xs p-4 shadow-xs">
          {/* Error Header */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-rose-200/60">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-rose-900">
                {errorData.message || 'Request Failed'}
              </span>
              {errorData.status > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-200/80 text-rose-800">
                  HTTP {errorData.status}
                </span>
              )}
            </div>
          </div>

          {/* Error Details */}
          {errorData.details && (
            <p className="text-xs text-rose-800 leading-relaxed mb-2 font-medium">
              {errorData.details}
            </p>
          )}

          {/* Suggestion / Troubleshooting Tip */}
          {errorData.suggestion && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-white/80 border border-rose-200/70 text-xs text-zinc-700 flex items-start space-x-2">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-800 block text-[11px] mb-0.5">
                  Suggested Action:
                </span>
                <span className="text-zinc-600 leading-normal">{errorData.suggestion}</span>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="mt-3 pt-2.5 border-t border-rose-200/60 flex items-center justify-between text-xs">
            {message.originalQuestion && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.originalQuestion)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-900 text-white font-medium hover:bg-rose-800 transition shadow-2xs cursor-pointer text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Question</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleCopy(`${errorData.message}\n${errorData.details || ''}`)}
              className="inline-flex items-center space-x-1 text-rose-600 hover:text-rose-800 transition text-[11px]"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy error</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard Assistant message
  return (
    <div className="flex justify-start items-start space-x-2 py-3">
      {/* Bot Avatar */}
      <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs">
        <Bot className="w-4 h-4" />
      </div>

      <div className="max-w-[90%] sm:max-w-[85%] bg-white border border-zinc-200/90 rounded-2xl rounded-tl-xs p-4 shadow-xs">
        {/* Main Answer */}
        <div className="text-sm text-zinc-800 leading-relaxed space-y-2 break-words">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Fallback Notice */}
        {message.fallback && (
          <div className="mt-3 flex items-center space-x-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Fallback response: No specific FAQ matched this request closely.</span>
          </div>
        )}

        {/* Metadata Footer */}
        <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
          <div className="flex flex-wrap items-center gap-2">
            {/* Intent Badge */}
            {message.intent && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-medium border border-zinc-200/60">
                <Tag className="w-3 h-3 text-zinc-400" />
                <span>{message.intent}</span>
              </span>
            )}

            {/* Latency */}
            {typeof message.latency_ms === 'number' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-50 text-zinc-500 border border-zinc-200/60">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span>{message.latency_ms} ms</span>
              </span>
            )}

            {/* Source Count Toggle */}
            {message.sources && message.sources.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSources(!showSources)}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200/60 transition cursor-pointer"
              >
                <FileText className="w-3 h-3 text-zinc-400" />
                <span>
                  {message.sources.length} {message.sources.length === 1 ? 'source' : 'sources'}
                </span>
                {showSources ? (
                  <ChevronUp className="w-3 h-3 text-zinc-400 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-zinc-400 ml-0.5" />
                )}
              </button>
            )}
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={() => handleCopy(message.content)}
            className="inline-flex items-center space-x-1 text-zinc-400 hover:text-zinc-700 transition px-1.5 py-0.5 rounded hover:bg-zinc-100"
            title="Copy answer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Expandable Sources View */}
        {showSources && message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Retrieved Context Documents
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {message.sources.map((src, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-zinc-50/80 border border-zinc-200/70 text-xs text-zinc-600 leading-relaxed font-mono"
                >
                  <div className="text-[10px] text-zinc-400 font-sans mb-1 font-medium">
                    Snippet #{idx + 1}
                  </div>
                  <p className="whitespace-pre-wrap">{src}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
