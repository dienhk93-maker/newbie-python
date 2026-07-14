import React, { useState, useRef, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = 'http://localhost:8000/api/v1';

// ── Tag Input Component ──────────────────────────────────────────────────────
interface TagInputProps {
  label: string;
  placeholder: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  color?: 'indigo' | 'purple';
}

const TagInput: React.FC<TagInputProps> = ({ label, placeholder, tags, onAdd, onRemove, color = 'indigo' }) => {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
      setInputVal('');
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && inputVal === '' && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    }
  };

  const ringColor = color === 'purple' ? 'focus-within:border-purple-500/60 focus-within:ring-purple-500/10' : 'focus-within:border-indigo-500/60 focus-within:ring-indigo-500/10';
  const tagBg = color === 'purple' ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' : 'bg-indigo-500/15 border-indigo-400/30 text-indigo-300';
  const tagX = color === 'purple' ? 'hover:text-purple-100' : 'hover:text-indigo-100';

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      <div
        className={`min-h-[48px] flex flex-wrap gap-1.5 px-3 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl transition-all duration-200 cursor-text ring-1 ring-transparent ${ringColor}`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map(tag => (
          <span key={tag} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium ${tagBg}`}>
            {tag}
            <button type="button" onClick={() => onRemove(tag)} className={`ml-0.5 opacity-60 ${tagX} transition-colors`}>
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKey}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : 'Add more...'}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-white placeholder-gray-600"
        />
      </div>
      <p className="text-xs text-gray-600">Press Enter or comma to add</p>
    </div>
  );
};

// ── Input Field Component ─────────────────────────────────────────────────────
interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  multiline?: boolean;
  icon?: React.ReactNode;
}

const InputField: React.FC<InputFieldProps> = ({ label, name, type = 'text', placeholder, value, onChange, required, multiline, icon }) => {
  const baseClass = "w-full bg-white/[0.05] border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm outline-none transition-all duration-200 hover:bg-white/[0.08] hover:border-white/20 focus:bg-white/[0.08] focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/10";

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-500">
            {icon}
          </div>
        )}
        {multiline ? (
          <textarea
            name={name}
            required={required}
            value={value}
            onChange={onChange}
            rows={3}
            placeholder={placeholder}
            className={`${baseClass} px-4 py-3 resize-none ${icon ? 'pl-10' : ''}`}
          />
        ) : (
          <input
            type={type}
            name={name}
            required={required}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`${baseClass} px-4 py-3 ${icon ? 'pl-10' : ''}`}
          />
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const AgencyProfileForm: React.FC = () => {
  const navigate = useNavigate();
  const { logout, token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    bio: '',
    website: '',
    phone: '',
    address: '',
    budget: '',
    team_size: '',
  });

  const [domains, setDomains] = useState<string[]>([]);
  const [techStack, setTechStack] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address.trim()) { setError('Address is required.'); return; }
    setError('');
    setIsSubmitting(true);

    try {
      const payload = {
        bio: formData.bio || undefined,
        website: formData.website || undefined,
        phone: formData.phone || undefined,
        address: formData.address,
        domain: domains,
        tech_stack: techStack,
        team_size: formData.team_size ? parseInt(formData.team_size) : 1,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
      };

      const res = await fetch(`${API_BASE}/profiles/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || errData?.detail || 'Failed to create profile.');
      }

      setSuccess(true);
      setTimeout(() => navigate('/agency/profile'), 3000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0c10] text-white flex flex-col relative overflow-hidden">
      {/* Ambient blobs — same palette as login */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full filter blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[450px] h-[450px] bg-purple-700/20 rounded-full filter blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
        <button
          onClick={() => navigate('/agency/home')}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-500/25 border border-indigo-400/35 flex items-center justify-center group-hover:bg-indigo-500/35 transition-colors">
            <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="font-bold text-base text-white tracking-tight">AI Connect</span>
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex justify-center py-10 px-4 overflow-y-auto">
        <div className="w-full max-w-2xl">

          {/* Page heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 mb-5 backdrop-blur-sm">
              <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1.5">Create Agency Profile</h1>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">Fill in your agency's details so we can match you with the right projects.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-400/30 rounded-2xl">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Success */}
          {success ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-emerald-500/10 border border-emerald-400/25 rounded-3xl p-10 text-center backdrop-blur-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Profile Created!</h2>
              <p className="text-sm text-emerald-300/80">Your agency profile has been submitted. Redirecting you back...</p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.4)] space-y-5"
            >
              {/* Section: About */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">About Your Agency</p>
                <div className="space-y-4">
                  <InputField
                    label="Bio / Description"
                    name="bio"
                    placeholder="Experienced fullstack agency specializing in Node.js and React..."
                    value={formData.bio}
                    onChange={handleChange}
                    multiline
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    }
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      label="Website"
                      name="website"
                      type="url"
                      placeholder="https://acme.agency"
                      value={formData.website}
                      onChange={handleChange}
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                        </svg>
                      }
                    />
                    <InputField
                      label="Phone"
                      name="phone"
                      type="tel"
                      placeholder="+1-555-0123"
                      value={formData.phone}
                      onChange={handleChange}
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      }
                    />
                  </div>
                  <InputField
                    label="Address *"
                    name="address"
                    placeholder="123 Tech Lane, San Francisco, CA"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                  />
                </div>
              </div>

              <div className="border-t border-white/[0.06]" />

              {/* Section: Capabilities */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Capabilities</p>
                <div className="space-y-4">
                  <TagInput
                    label="Tech Stack"
                    placeholder="e.g. Node.js, React, MongoDB..."
                    tags={techStack}
                    onAdd={(t) => setTechStack(prev => [...prev, t])}
                    onRemove={(t) => setTechStack(prev => prev.filter(x => x !== t))}
                    color="indigo"
                  />
                  <TagInput
                    label="Domain / Expertise"
                    placeholder="e.g. Software Engineering, FinTech..."
                    tags={domains}
                    onAdd={(t) => setDomains(prev => [...prev, t])}
                    onRemove={(t) => setDomains(prev => prev.filter(x => x !== t))}
                    color="purple"
                  />
                </div>
              </div>

              <div className="border-t border-white/[0.06]" />

              {/* Section: Capacity */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Capacity & Pricing</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Team Size"
                    name="team_size"
                    type="number"
                    placeholder="e.g. 5"
                    value={formData.team_size}
                    onChange={handleChange}
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                  />
                  <InputField
                    label="Budget (USD)"
                    name="budget"
                    type="number"
                    placeholder="e.g. 15000"
                    value={formData.budget}
                    onChange={handleChange}
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !!success}
                  className="relative w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white overflow-hidden group transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-200 group-hover:opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-all duration-200" />
                  <span className="relative flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Creating Profile...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Submit Application
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
