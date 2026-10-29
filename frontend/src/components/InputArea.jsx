import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Loader2, AlertCircle, WifiOff } from 'lucide-react';

const MAX_QUESTION_LENGTH = 1000;

export default function InputArea({
  input,
  setInput,
  onSubmit,
  isLoading,
  disabled,
  isBackendOffline,
}) {
  const textareaRef = useRef(null);
  const [validationWarning, setValidationWarning] = useState('');

  // Auto-resize textarea height as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const charCount = input.length;
  const isOverLimit = charCount > MAX_QUESTION_LENGTH;
  const isNearLimit = charCount >= 900;
  const trimmedLength = input.trim().length;

  const handleValidateAndSubmit = () => {
    if (isLoading || disabled) return;

    if (trimmedLength === 0) {
      setValidationWarning('Please enter a question before sending.');
      setTimeout(() => setValidationWarning(''), 3000);
      return;
    }

    if (isOverLimit) {
      setValidationWarning(
        `Question exceeds limit by ${charCount - MAX_QUESTION_LENGTH} characters. Max is ${MAX_QUESTION_LENGTH}.`
      );
      setTimeout(() => setValidationWarning(''), 4000);
      return;
    }

    setValidationWarning('');
    onSubmit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleValidateAndSubmit();
    }
  };

  const canSubmit = !isLoading && trimmedLength > 0 && !isOverLimit && !disabled;

  return (
    <div className="sticky bottom-0 bg-gradient-to-t from-zinc-50 via-zinc-50/95 to-transparent pt-3 pb-6 px-4">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Real-time Validation / Offline Warning Banner */}
        {validationWarning ? (
          <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2 animate-fade-in shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="font-medium">{validationWarning}</span>
          </div>
        ) : isOverLimit ? (
          <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2 animate-fade-in shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>
              Question is too long: {charCount}/{MAX_QUESTION_LENGTH} characters. Please remove{' '}
              {charCount - MAX_QUESTION_LENGTH} characters.
            </span>
          </div>
        ) : isBackendOffline ? (
          <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2">
              <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Backend server is currently offline. Responses may fail until restarted.</span>
            </div>
            <span className="text-[11px] font-mono text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
              uvicorn app:app
            </span>
          </div>
        ) : null}

        {/* Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleValidateAndSubmit();
          }}
          className={`relative rounded-2xl bg-white border shadow-sm transition-all ${
            isOverLimit
              ? 'border-rose-300 focus-within:ring-2 focus-within:ring-rose-200'
              : 'border-zinc-200/90 focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-900/5'
          }`}
        >
          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (validationWarning) setValidationWarning('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about shipping, returns, order status..."
            disabled={isLoading || disabled}
            className="w-full pl-4 pr-14 py-3.5 bg-transparent resize-none text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none max-h-44 disabled:opacity-50"
          />

          {/* Action Row */}
          <div className="flex items-center justify-between px-4 pb-2.5 pt-1">
            {/* Character counter & Shortcut hint */}
            <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
              <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
              {charCount > 0 && (
                <span
                  className={`font-mono transition-colors ${
                    isOverLimit
                      ? 'text-rose-600 font-semibold'
                      : isNearLimit
                      ? 'text-amber-600 font-medium'
                      : 'text-zinc-400'
                  }`}
                >
                  {charCount}/{MAX_QUESTION_LENGTH}
                </span>
              )}
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                canSubmit
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-2xs cursor-pointer'
                  : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
              }`}
              title={
                isOverLimit
                  ? 'Question exceeds 1000 characters'
                  : trimmedLength === 0
                  ? 'Enter a question to send'
                  : 'Send question'
              }
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] text-zinc-400">
          Answers are generated by RAG over the support FAQ dataset using Groq.
        </p>
      </div>
    </div>
  );
}
