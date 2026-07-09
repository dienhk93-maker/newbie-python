import React, { useState } from 'react';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';

export const AuthScreen: React.FC = () => {
  const [isSignIn, setIsSignIn] = useState(true);

  return (
    <div className="min-h-screen w-full flex bg-[#0a0c10]">
      
      {/* LEFT – Branding Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 relative p-12 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute inset-0">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/25 rounded-full filter blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-700/25 rounded-full filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-violet-600/15 rounded-full filter blur-[80px]" />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" 
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center backdrop-blur-sm">
            <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">AI Connect</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4 tracking-tight">
            The next-gen<br />
            <span className="text-transparent bg-clip-text bg-linear-to-br from-indigo-300 to-purple-400">
              AI conversation
            </span><br />
            experience.
          </h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-xs">
            Real-time AI streaming, advanced semantic search, and a seamless modern interface — built for how you think.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-8">
            {['Real-time Streaming', 'Semantic Search', 'Secure Auth'].map(f => (
              <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <p className="text-sm text-gray-400 italic">"The future of search is a conversation."</p>
          <p className="text-xs text-gray-600 mt-1">— AI Connect Team</p>
        </div>
      </div>

      {/* RIGHT – Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Subtle right-side ambient glow */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full filter blur-[80px] pointer-events-none" />

        {/* Mobile logo */}
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-white font-bold text-sm">AI Connect</span>
        </div>

        {/* Form card */}
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
            <div
              key={isSignIn ? 'signin' : 'signup'}
              className="animate-in fade-in slide-in-from-right-4 duration-300"
            >
              {isSignIn
                ? <SignIn onSwitch={() => setIsSignIn(false)} />
                : <SignUp onSwitch={() => setIsSignIn(true)} />
              }
            </div>
          </div>

          {/* Tab switcher below card */}
          <div className="flex mt-4 rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.03]">
            <button
              onClick={() => setIsSignIn(true)}
              className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${isSignIn ? 'bg-indigo-500/20 text-indigo-300 border-r border-white/[0.07]' : 'text-gray-500 hover:text-gray-400 border-r border-white/[0.07]'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignIn(false)}
              className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${!isSignIn ? 'bg-purple-500/20 text-purple-300' : 'text-gray-500 hover:text-gray-400'}`}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
