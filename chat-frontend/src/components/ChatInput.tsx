import React, { useState, type FormEvent, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (prompt: string) => void;
  isStreaming: boolean;
  onStop: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isStreaming, onStop }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (isStreaming) { onStop(); return; }
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-end gap-2 bg-white/[0.05] border border-white/[0.1] hover:border-white/[0.15] focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/10 rounded-2xl px-4 py-3 transition-all duration-200"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        className="flex-1 bg-transparent outline-none resize-none text-sm text-white placeholder-gray-600 leading-relaxed max-h-40"
        placeholder="Message AI Connect… (Shift+Enter for new line)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Character count */}
      {input.length > 0 && (
        <span className="absolute bottom-3.5 right-16 text-[10px] text-gray-600">
          {input.length}
        </span>
      )}

      {/* Send / Stop button */}
      <button
        type="submit"
        disabled={!isStreaming && !input.trim()}
        className={[
          'flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl font-medium transition-all duration-200',
          isStreaming
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
            : input.trim()
            ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/40 active:scale-95'
            : 'bg-white/[0.05] text-gray-600 cursor-not-allowed',
        ].join(' ')}
      >
        {isStreaming ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
      </button>
    </form>
  );
};
