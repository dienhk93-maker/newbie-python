import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const AgencyHome: React.FC = () => {
  const navigate = useNavigate();
  const { logout, userId, token } = useAuth();

  const [userName, setUserName] = useState<string>('Agency User');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Default avatar fallback
  const defaultAvatar = "https://ui-avatars.com/api/?name=" + encodeURIComponent(userName) + "&background=4f46e5&color=fff";

  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();

    if (userId && token) {
      // Fetch user profile to get username
      fetch(`http://localhost:8000/api/v1/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      })
      .then(res => res.json())
      .then(data => {
        if (data.user_name) setUserName(data.user_name);
        if (data.full_name && !data.user_name) setUserName(data.full_name);
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error(err);
      });

      // Check if agency already created a profile
      fetch(`http://localhost:8000/api/v1/profiles/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      })
      .then(res => {
        if (res.ok) return res.json();
        setIsCheckingProfile(false);
        return null;
      })
      .then(profileData => {
        if (profileData) {
          // Pass the already-fetched profile data via navigate state
          // so AgencyProfileView doesn't need to fetch it again
          navigate('/agency/profile', { state: { profileData } });
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
          setIsCheckingProfile(false);
        }
      });
    } else {
      setIsCheckingProfile(false);
    }

    return () => {
      abortController.abort();
    };
  }, [userId, token, navigate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#0a0c10] text-white flex flex-col relative overflow-hidden">
      
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full filter blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[450px] h-[450px] bg-purple-700/20 rounded-full filter blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/25 border border-indigo-400/35 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="font-bold text-base tracking-tight text-white">AI Connect</span>
        </div>

        {/* User Menu - Combined Avatar and Username */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 hover:bg-white/[0.05] p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-white/10"
          >
            <img 
              src={avatarUrl || defaultAvatar} 
              alt="Avatar" 
              className="w-8 h-8 rounded-full border border-white/20 object-cover"
            />
            <span className="text-sm font-medium text-white shadow-sm">{userName}</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown popup */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-[#13151a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors flex items-center gap-2 rounded-xl"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative z-10 text-center pb-20">
        
        {isCheckingProfile ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <svg className="animate-spin h-10 w-10 text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <p className="text-gray-400 font-medium">Checking agency profile...</p>
          </div>
        ) : (
          <>
            {/* Badge */}
            <span className="inline-flex flex-col sm:flex-row items-center justify-center px-5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm font-medium mb-8 backdrop-blur-sm">
              <span className="text-indigo-300">For Agencies & Studios</span>
              <span className="hidden sm:inline-block mx-2.5 w-1 h-1 rounded-full bg-gray-600" />
              <span className="text-gray-400 mt-1 sm:mt-0">Join the waitlist today.</span>
            </span>
            
            {/* Title */}
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 pb-2">
              Power Your Agency<br/>
              Growth with AI Connect
            </h1>
            
            {/* Subtitle */}
            <p className="text-base md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
              Get hand-picked project briefs, transparent pricing, and rapid payouts—so you can focus on what you do best.
            </p>
            
            {/* CTA Button */}
            <button
              onClick={() => navigate('/agency/apply')}
              className="relative px-8 py-4 rounded-xl font-bold text-lg text-white overflow-hidden group transition-all duration-200 hover:shadow-[0_0_40px_rgba(79,70,229,0.4)] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-200 group-hover:opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-all duration-200" />
              <span className="relative flex items-center justify-center gap-2">
                Apply as Partner Agency
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </button>
          </>
        )}

      </main>
    </div>
  );
};
