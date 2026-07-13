import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { MessageType, Agency } from '../types/chat';

interface MessageProps {
  message: MessageType;
}

// ── Agency Card ────────────────────────────────────────────────────────────
const AgencyCard: React.FC<{ agency: Agency }> = ({ agency }) => {
  const matchPct = Math.round((agency.score ?? 0) * 100);
  const initials = (agency.name || 'A').charAt(0).toUpperCase();

  return (
    <div 
      onClick={() => window.open(`/agency/profile/${agency.user_id || agency.id}`, '_blank')}
      className="snap-start min-w-[280px] max-w-[300px] flex-shrink-0 rounded-2xl overflow-hidden border border-white/[0.10] bg-white/[0.04] hover:bg-white/[0.07] hover:border-indigo-500/40 transition-all duration-300 cursor-pointer group shadow-lg"
    >
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      <div className="p-4 flex flex-col gap-3">
        {/* Avatar + Name + Score */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {agency.avatar ? (
              <img
                src={agency.avatar}
                alt={agency.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10 shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow ring-2 ring-white/10 ${agency.avatar ? 'hidden' : ''}`}
            >
              {initials}
            </div>
            {/* Online dot */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#0a0c10] rounded-full" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm truncate group-hover:text-indigo-300 transition-colors">
              {agency.name || `Agency #${agency.id.slice(0, 6)}`}
            </h3>
            {/* Match score bar */}
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-400 transition-all duration-700"
                  style={{ width: `${matchPct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-emerald-400 shrink-0">{matchPct}%</span>
            </div>
          </div>
        </div>

        {/* Domain tags */}
        {agency.domain?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agency.domain.slice(0, 3).map((d, i) => (
              <span key={i} className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
          {agency.description || 'No description available.'}
        </p>

        {/* Budget & Team size */}
        <div className="flex items-center gap-2">
          {agency.budget != null && (
            <div className="flex items-center gap-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-lg">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span className="text-[11px] font-bold">${agency.budget.toLocaleString()}</span>
            </div>
          )}
          {agency.team_size != null && (
            <div className="flex items-center gap-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-lg">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[11px] font-bold">{agency.team_size} members</span>
            </div>
          )}
        </div>

        {/* Tech stack badges */}
        {agency.tech_stack?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2.5 border-t border-white/[0.06]">
            {agency.tech_stack.slice(0, 4).map((t, i) => (
              <span key={i} className="text-[10px] font-semibold bg-white/[0.06] text-gray-400 px-2 py-0.5 rounded-md hover:bg-white/[0.10] hover:text-gray-200 transition-colors">
                {t}
              </span>
            ))}
            {agency.tech_stack.length > 4 && (
              <span className="text-[10px] font-semibold bg-white/[0.04] text-gray-600 px-2 py-0.5 rounded-md">
                +{agency.tech_stack.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Message ────────────────────────────────────────────────────────────────
export const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 py-3 px-2 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content column */}
      <div className={`flex flex-col gap-2 ${isUser ? 'items-end max-w-[80%]' : 'items-start w-full min-w-0'}`}>
        <span className="text-[11px] font-semibold text-gray-500 px-1">
          {isUser ? 'You' : 'AI Connect'}
        </span>

        {/* Bubble (only for non-empty content) */}
        {(message.content || message.isStreaming) && (
          <div
            className={[
              'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
              isUser
                ? 'bg-indigo-600 text-white rounded-tr-sm shadow-lg shadow-indigo-900/30'
                : `bg-white/[0.06] border border-white/[0.08] text-gray-100 rounded-tl-sm ${message.isError ? 'border-red-500/30 bg-red-500/5' : ''}`,
            ].join(' ')}
          >
            {isUser ? (
              message.content.split('\n').map((line, i, arr) => (
                <React.Fragment key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </React.Fragment>
              ))
            ) : (
              <>
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-base font-bold text-white mt-3 mb-1 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold text-indigo-300 mt-3 mb-1 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-purple-300 mt-2 mb-0.5 first:mt-0">{children}</h3>,
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-none space-y-1 mb-2 pl-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 pl-1">{children}</ol>,
                    li: ({ children }) => (
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 mt-1 flex-shrink-0">•</span>
                        <span>{children}</span>
                      </li>
                    ),
                    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                    em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
                    code: ({ children, className }) => {
                      const isBlock = className?.includes('language-');
                      return isBlock ? (
                        <code className="block bg-black/40 border border-white/10 rounded-lg px-3 py-2 my-2 text-xs font-mono text-green-300 overflow-x-auto">
                          {children}
                        </code>
                      ) : (
                        <code className="bg-white/10 text-purple-300 rounded px-1 py-0.5 text-xs font-mono">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => <pre className="overflow-x-auto">{children}</pre>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-indigo-500/50 pl-3 italic text-gray-400 my-2">
                        {children}
                      </blockquote>
                    ),
                    hr: () => <hr className="border-white/10 my-3" />,
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-purple-400 rounded-sm ml-1 align-middle animate-pulse" />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Agency Cards ── */}
        {!isUser && message.agencies && message.agencies.length > 0 && (
          <div className="w-full">
            <p className="text-[11px] text-gray-500 mb-2 px-1">
              {message.agencies.length} matching {message.agencies.length === 1 ? 'agency' : 'agencies'} found
            </p>
            <div
              className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
            >
              {message.agencies.map((agency) => (
                <AgencyCard key={agency.id} agency={agency} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
