import React from 'react';
import { Sparkles, Package, RotateCcw, CreditCard, Clock } from 'lucide-react';

const SUGGESTIONS = [
  {
    icon: Package,
    title: 'Order Status',
    question: 'Where is my order and how do I track my shipment?',
  },
  {
    icon: RotateCcw,
    title: 'Returns & Exchange',
    question: 'How do I return an item that does not fit?',
  },
  {
    icon: CreditCard,
    title: 'Payment Issues',
    question: 'My payment was declined. What should I do?',
  },
  {
    icon: Clock,
    title: 'Order Cancellation',
    question: 'Can I cancel my order after it has been placed?',
  },
];

export default function EmptyState({ onSelectSuggestion }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center max-w-2xl mx-auto">
      {/* Icon */}
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center mb-4 shadow-xs">
        <Sparkles className="w-6 h-6 text-zinc-700" />
      </div>

      <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight mb-2">
        How can I help you today?
      </h2>
      <p className="text-sm text-zinc-500 max-w-md mb-8">
        Ask any question about shipping policies, return procedures, order tracking, or payment support.
      </p>

      {/* Suggestion Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {SUGGESTIONS.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={() => onSelectSuggestion(item.question)}
              className="group p-4 bg-white hover:bg-zinc-50/80 border border-zinc-200/80 hover:border-zinc-300 rounded-xl transition text-left shadow-2xs hover:shadow-xs flex items-start space-x-3"
            >
              <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200/60 text-zinc-600 group-hover:text-zinc-900 group-hover:bg-zinc-100 transition shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-zinc-900 block mb-0.5">
                  {item.title}
                </span>
                <span className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                  {item.question}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
