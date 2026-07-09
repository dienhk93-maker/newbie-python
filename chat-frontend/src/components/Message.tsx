import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { MessageType } from '../types/chat';

interface MessageProps {
  message: MessageType;
}

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

      {/* Bubble */}
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-[11px] font-semibold text-gray-500 px-1">
          {isUser ? 'You' : 'AI Connect'}
        </span>
        <div
          className={[
            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm shadow-lg shadow-indigo-900/30'
              : `bg-white/[0.06] border border-white/[0.08] text-gray-100 rounded-tl-sm ${message.isError ? 'border-red-500/30 bg-red-500/5' : ''}`,
          ].join(' ')}
        >
          {isUser ? (
            /* User messages: plain text, preserve line breaks */
            message.content.split('\n').map((line, i, arr) => (
              <React.Fragment key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </React.Fragment>
            ))
          ) : (
            /* AI messages: full Markdown rendering */
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
      </div>
    </div>
  );
};
