import React, { useEffect, useRef } from 'react';
import { useChat } from '../../hooks/useChat';
import { Message } from '../Message';
import { ChatInput } from '../ChatInput';
import { useAuth } from '../../contexts/AuthContext';

const SUGGESTIONS = [
  { icon: '🔍', text: 'Tìm agency chuyên về React Native, ngân sách 10.000 USD' },
  { icon: '🏢', text: 'Agency fintech có đội ngũ trên 20 người' },
  { icon: '🤖', text: 'Công ty AI/ML ở Việt Nam, giá dưới 5000 USD' },
  { icon: '🛠️', text: 'Agency full-stack chuyên Node.js và React' },
];

export const ChatView: React.FC = () => {
  const { logout } = useAuth();
  const { 
    messages, 
    sendMessage, 
    isStreaming, 
    stopStreaming,
    isLoadingHistory,
    conversations,
    activeThreadId,
    selectConversation,
    createNewChat
  } = useChat();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-screen w-full bg-[#0a0c10] text-white overflow-hidden">
      
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 bg-white/[0.03] border-r border-white/[0.07] flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="font-bold text-sm text-white tracking-tight">AI Connect</span>
          </div>
        </div>

        {/* New chat button */}
        <div className="p-3 border-b border-white/[0.07]">
          <button
            onClick={createNewChat}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-200 group"
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New conversation
          </button>
        </div>
        
        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto w-full p-2 space-y-0.5" style={{ scrollbarWidth: 'none' }}>
          {conversations.map((conv) => (
            <button
              key={conv.thread_id}
              onClick={() => selectConversation(conv.thread_id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors duration-200 ${
                activeThreadId === conv.thread_id
                  ? 'bg-white/[0.08] text-white font-medium'
                  : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-300'
              }`}
              title={conv.title}
            >
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="truncate">{conv.title}</span>
              </div>
            </button>
          ))}
        </div>

        {/* User section */}
        <div className="p-3 border-t border-white/[0.07]">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-xs text-gray-400 flex-1 truncate">My Account</span>
            <button
              onClick={logout}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
              title="Logout"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <main className="flex flex-col flex-1 min-w-0 relative">

        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] bg-white/[0.02] backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="font-bold text-sm">AI Connect</span>
            </div>
            <div className="hidden lg:block">
              <h1 className="text-sm font-semibold text-gray-200">AI Chat</h1>
              <p className="text-xs text-gray-500">Powered by FastAPI + OpenAI</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isStreaming ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[11px] text-gray-400 font-medium">{isStreaming ? 'Generating' : 'Ready'}</span>
            </div>
            {/* Logout (mobile) */}
            <button
              onClick={logout}
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-400/10 border border-white/[0.07] transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scroll-smooth" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {isLoadingHistory ? (
            /* Loading State */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-10 h-10 border-4 border-white/[0.05] border-t-indigo-500 rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-gray-500">Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            /* Welcome screen */
            <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">How can I help you?</h2>
              <p className="text-sm text-gray-500 max-w-xs mb-8">Ask me anything — I can search, summarize, and answer in real-time.</p>
              {/* Suggestion chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => sendMessage(s.text)}
                    className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-indigo-500/30 text-left transition-all duration-200 group"
                  >
                    <span className="text-lg mt-0.5 flex-shrink-0">{s.icon}</span>
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors leading-snug">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-1">
              {messages.map((msg) => (
                <Message key={msg.id} message={msg} />
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 pb-5 pt-3">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSend={sendMessage} isStreaming={isStreaming} onStop={stopStreaming} />
            <p className="text-center text-[11px] text-gray-600 mt-2">AI Connect may produce inaccurate information.</p>
          </div>
        </div>
      </main>
    </div>
  );
};
