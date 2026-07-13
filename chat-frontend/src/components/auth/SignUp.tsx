import React, { useState } from 'react';
import { authService } from '../../services/authService';

interface Field {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  icon: React.ReactNode;
}

export const SignUp: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
  const [formData, setFormData] = useState({
    email: '',
    user_name: '',
    full_name: '',
    password: '',
    role: 'PROJECT_OWNER',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await authService.register(formData);
      setSuccess('Account created! Redirecting to sign in...');
      setTimeout(() => onSwitch(), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-400/30 mb-5 backdrop-blur-sm">
          <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Create account</h2>
        <p className="mt-1 text-sm text-gray-400">Join us and start using AI Connect</p>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="mb-5 flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-400/30 rounded-2xl">
          <svg className="w-4 h-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-emerald-300">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Full Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <input
              type="text"
              name="full_name"
              required
              autoComplete="name"
              className="w-full pl-11 pr-4 py-3.5 bg-white/[0.07] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/20 rounded-xl focus:bg-white/[0.1] focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none text-white text-sm placeholder-gray-600"
              placeholder="John Doe"
              value={formData.full_name}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Role Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">I am a</label>
          <div className="flex gap-3">
            {[
              { id: 'PROJECT_OWNER', label: 'Project Owner', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
              { id: 'AGENCY', label: 'Agency', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /> }
            ].map((r) => (
              <label
                key={r.id}
                className={`flex-1 relative flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium cursor-pointer transition-all duration-200 ${
                  formData.role === r.id
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-md shadow-purple-500/10'
                    : 'bg-white/[0.04] border-white/10 text-gray-400 hover:bg-white/[0.08] hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={formData.role === r.id}
                  onChange={handleChange}
                  className="hidden"
                />
                <svg className="w-5 h-5 mb-1.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {r.icon}
                </svg>
                {r.label}
              </label>
            ))}
          </div>
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Username</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <input
              type="text"
              name="user_name"
              required
              autoComplete="username"
              className="w-full pl-11 pr-4 py-3.5 bg-white/[0.07] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/20 rounded-xl focus:bg-white/[0.1] focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none text-white text-sm placeholder-gray-600"
              placeholder="johndoe"
              value={formData.user_name}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full pl-11 pr-4 py-3.5 bg-white/[0.07] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/20 rounded-xl focus:bg-white/[0.1] focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none text-white text-sm placeholder-gray-600"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              autoComplete="new-password"
              className="w-full pl-11 pr-11 py-3.5 bg-white/[0.07] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/20 rounded-xl focus:bg-white/[0.1] focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none text-white text-sm placeholder-gray-600"
              placeholder="Min. 8 characters"
              value={formData.password}
              onChange={handleChange}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading || !!success}
            className="relative w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white overflow-hidden group transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-linear-to-r from-purple-500 to-indigo-600" />
            <div className="absolute inset-0 bg-linear-to-r from-purple-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-all duration-200" />
            <span className="relative flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating account...
                </>
              ) : 'Create Account'}
            </span>
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <button onClick={onSwitch} className="font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer bg-transparent border-none">
          Sign in
        </button>
      </p>
    </div>
  );
};
