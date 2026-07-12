import React, { useState, useRef, useEffect } from 'react';

// Make sure to install react-markdown or replace this with a standard div if you don't need markdown parsing
import ReactMarkdown from 'react-markdown'; 

export interface Agency {
  id: string;
  score: number;
  budget: number;
  team_size: number;
  domain: string[];
  tech_stack: string[];
  description: string;
  name?: string;
  avatar?: string | null;
}

export interface Message {
  role: 'user' | 'ai';
  content: string;
  agencies?: Agency[] | null;
}

interface ChatProps {
  token?: string; // Add your authorization token here
}

export default function Chat({ token = "YOUR_TOKEN_HERE" }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    
    // Append user message and an empty placeholder for the AI message
    setMessages((prev) => [
      ...prev,
      userMessage,
      { role: 'ai', content: '', agencies: null }
    ]);
    
    const query = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/ai-search/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: query, limit: 5 })
      });

      if (!response.body) {
        throw new Error('ReadableStream not yet supported in this browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          
          // Split by double newline to process distinct SSE blocks
          const chunks = buffer.split('\n\n');
          
          // Keep the last chunk in the buffer as it might be incomplete
          buffer = chunks.pop() || '';

          for (const chunk of chunks) {
            const lines = chunk.split('\n');
            let isSearchResultsEvent = false;
            let dataContent = '';

            for (const line of lines) {
              if (line.startsWith('event: search_results')) {
                isSearchResultsEvent = true;
              } else if (line.startsWith('data: ')) {
                // There could be multiple 'data: ' lines if the text itself has newlines,
                // but usually the SSE standard is one data per event block or multiple joined
                dataContent += line.substring(6); 
              }
            }

            if (isSearchResultsEvent) {
              try {
                const parsedAgencies = JSON.parse(dataContent);
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessageIndex = newMessages.length - 1;
                  newMessages[lastMessageIndex] = {
                    ...newMessages[lastMessageIndex],
                    agencies: parsedAgencies
                  };
                  return newMessages;
                });
              } catch (e) {
                console.error("Failed to parse search_results JSON", e);
              }
            } else if (dataContent) {
              // Standard AI text streaming chunk
              // Replace explicitly escaped newlines if the server sends them like "\\n"
              const parsedText = dataContent.replace(/\\n/g, '\n');
              
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessageIndex = newMessages.length - 1;
                newMessages[lastMessageIndex] = {
                  ...newMessages[lastMessageIndex],
                  content: newMessages[lastMessageIndex].content + parsedText
                };
                return newMessages;
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in chat stream:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[600px] max-h-screen bg-gray-50 text-gray-800 font-sans shadow-xl rounded-xl overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">AI Agency Matchmaker</h2>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-sm font-medium text-gray-500">Online</span>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#f8fafc]">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-center text-lg">Hello! Describe the AI agency you are looking for.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[85%] md:max-w-[75%] px-5 py-3 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-2xl rounded-br-none' 
                  : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-none'
              }`}
            >
              {msg.role === 'user' ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  
                  {/* Loading indicator if message is empty but still streaming */}
                  {!msg.content && isLoading && idx === messages.length - 1 && (
                    <div className="flex space-x-1 items-center h-5 mt-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Agency Profile Cards */}
            {msg.agencies && msg.agencies.length > 0 && (
              <div className="w-full mt-4 flex overflow-x-auto pb-4 pt-1 gap-4 hide-scrollbar snap-x snap-mandatory">
                {msg.agencies.map((agency) => (
                  <div
                    key={agency.id}
                    className="snap-start min-w-[300px] max-w-[320px] flex-shrink-0 bg-white rounded-2xl shadow-md hover:shadow-xl border border-gray-100 hover:border-blue-300 transition-all duration-300 cursor-pointer overflow-hidden group"
                  >
                    {/* Gradient accent bar */}
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

                    {/* Card body */}
                    <div className="p-5 flex flex-col">
                      {/* Avatar + Name + Score row */}
                      <div className="flex items-center gap-3.5 mb-4">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {agency.avatar ? (
                            <img
                              src={agency.avatar}
                              alt={agency.name || 'Agency'}
                              className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-md"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          {/* Fallback avatar (shown if no URL or on error) */}
                          <div
                            className={`w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md ring-2 ring-white ${
                              agency.avatar ? 'hidden' : ''
                            }`}
                          >
                            {(agency.name || 'A').charAt(0).toUpperCase()}
                          </div>
                          {/* Online indicator */}
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                        </div>

                        {/* Name & Score */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate text-base leading-tight group-hover:text-blue-700 transition-colors">
                            {agency.name || `Agency #${agency.id.slice(0, 6)}`}
                          </h3>
                          {agency.score !== undefined && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
                                  style={{ width: `${Math.round(agency.score * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-emerald-600 shrink-0">
                                {Math.round(agency.score * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Domain tags */}
                      {agency.domain && agency.domain.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {agency.domain.map((d, i) => (
                            <span
                              key={i}
                              className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Description */}
                      <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 mb-4">
                        {agency.description}
                      </p>

                      {/* Budget & Team Size */}
                      <div className="flex items-center gap-3 mb-4">
                        {agency.budget != null && (
                          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            <span className="text-xs font-bold">${agency.budget.toLocaleString()}</span>
                          </div>
                        )}
                        {agency.team_size != null && (
                          <div className="flex items-center gap-1.5 bg-violet-50 text-violet-700 border border-violet-100 px-3 py-1.5 rounded-lg">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-xs font-bold">{agency.team_size} members</span>
                          </div>
                        )}
                      </div>

                      {/* Tech Stack badges */}
                      <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-100">
                        {agency.tech_stack?.slice(0, 4).map((tech, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            {tech}
                          </span>
                        ))}
                        {agency.tech_stack && agency.tech_stack.length > 4 && (
                          <span className="text-[11px] font-semibold bg-gray-100 text-gray-400 px-2.5 py-1 rounded-md">
                            +{agency.tech_stack.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 md:p-5">
        <div className="max-w-4xl mx-auto flex items-end space-x-3 bg-gray-50 p-2 rounded-3xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <textarea
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] px-4 py-3 outline-none text-gray-700"
            placeholder="Type your requirements here..."
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-full p-2 h-11 w-11 flex items-center justify-center transition-colors mb-0.5 mr-0.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        <div className="text-center mt-2">
          <span className="text-[10px] text-gray-400">Press Enter to send, Shift + Enter for new line</span>
        </div>
      </div>
      
      {/* Required hide-scrollbar CSS added inline for convenience */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
