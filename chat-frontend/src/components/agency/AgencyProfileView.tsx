import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const AgencyProfileView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { logout, userId, token } = useAuth();
  const location = useLocation();
  
  const isViewOnly = Boolean(id && id !== userId);
  const targetUserId = id || userId;

  // Use profile data passed via navigation state (from AgencyHome) if available
  const initialProfileData = (location.state as any)?.profileData || null;

  const [userName, setUserName] = useState<string>('Agency User');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileData, setProfileData] = useState<any>(initialProfileData);
  const [isLoading, setIsLoading] = useState(!initialProfileData);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mock Upload state
  const [isUploading, setIsUploading] = useState(false);

  const defaultAvatar = "https://ui-avatars.com/api/?name=" + encodeURIComponent(userName) + "&background=4f46e5&color=fff";

  useEffect(() => {
    // If we already have profile data from navigation state, just fetch the username
    if (initialProfileData) {
      if (initialProfileData.avatar) setAvatarUrl(initialProfileData.avatar);
      const actualUserId = initialProfileData.user?.id || initialProfileData.user?.$id || targetUserId;
      if (actualUserId && token) {
        const abortController = new AbortController();
        fetch(`http://localhost:8000/api/v1/users/${actualUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal
        })
        .then(res => res.ok ? res.json() : null)
        .then(userData => {
          if (userData?.user_name) setUserName(userData.user_name);
          else if (userData?.full_name) setUserName(userData.full_name);
        })
        .catch(err => { if (err.name !== 'AbortError') console.error(err); });
        return () => abortController.abort();
      }
      return;
    }

    // No navigation state — user navigated directly to this URL, fetch from API
    const abortController = new AbortController();

    if (targetUserId && token) {
      fetch(`http://localhost:8000/api/v1/profiles/${targetUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      })
      .then(res => {
        if (!res.ok) {
          navigate('/agency/home');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setProfileData(data);
          if (data.avatar) setAvatarUrl(data.avatar);
          setIsLoading(false);
          
          const actualUserId = data.user?.id || data.user?.$id || targetUserId;
          fetch(`http://localhost:8000/api/v1/users/${actualUserId}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: abortController.signal
          })
          .then(res => {
            if (res.ok) return res.json();
            return null;
          })
          .then(userData => {
            if (userData?.user_name) setUserName(userData.user_name);
            else if (userData?.full_name) setUserName(userData.full_name);
          })
          .catch(err => {
            if (err.name !== 'AbortError') console.error(err);
          });
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error(err);
      });
    }

    return () => {
      abortController.abort();
    };
  }, [targetUserId, token, navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleAvatarUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !profileData?.id || isViewOnly) return;
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`http://localhost:8000/api/v1/profiles/avatar/${profileData.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();
      if (data.avatar) {
        setAvatarUrl(data.avatar);
      }
      setIsModalOpen(false);
      setSelectedFile(null);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0c10] text-white flex flex-col relative overflow-hidden">
      
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full filter blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[450px] h-[450px] bg-purple-700/20 rounded-full filter blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/agency/home')}>
          <div className="w-8 h-8 rounded-xl bg-indigo-500/25 border border-indigo-400/35 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="font-bold text-base tracking-tight text-white">AI Connect</span>
        </div>

        {/* User Menu - Only show if not view-only */}
        {!isViewOnly && (
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

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-[#13151a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center py-12 px-4 overflow-y-auto w-full max-w-4xl mx-auto">
        
        {/* Profile Card */}
        <div className="w-full bg-white/[0.02] border border-white/[0.08] rounded-3xl p-8 backdrop-blur-md shadow-xl flex flex-col md:flex-row gap-8 items-start">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4 border-r border-white/5 pr-8 md:w-1/3">
             <button
               onClick={() => {
                 if (isViewOnly) return;
                 setSelectedFile(null); // Reset selection when opening modal
                 setIsModalOpen(true);
               }}
               className={`group relative w-32 h-32 rounded-full overflow-hidden border-2 border-indigo-500/50 hover:border-indigo-400 transition-colors drop-shadow-[0_0_15px_rgba(79,70,229,0.3)] ${isViewOnly ? 'cursor-default' : 'cursor-pointer'}`}
               title={isViewOnly ? "Agency Avatar" : "Update Profile Avatar"}
             >
                {isLoading ? (
                  <div className="w-full h-full bg-indigo-900/30 animate-pulse flex items-center justify-center">
                    <svg className="w-8 h-8 text-indigo-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                ) : (
                  <img 
                    src={avatarUrl || defaultAvatar} 
                    alt="Agency Avatar" 
                    className="w-full h-full object-cover"
                  />
                )}
                {!isLoading && !isViewOnly && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <svg className="w-6 h-6 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <span className="text-xs font-bold text-white">Upload</span>
                  </div>
                )}
             </button>
             <h2 className="text-xl font-bold text-white tracking-wide text-center">{userName} Agency</h2>
             <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
               Active
             </span>
          </div>

          {/* Details Section */}
          <div className="flex-1 w-full space-y-6 pt-2">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Agency Overview</p>
              <p className="text-gray-300 leading-relaxed text-sm">
                {isLoading ? "Loading profile overview..." : (profileData?.bio || "No overview provided for this agency.")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl">
                <p className="text-xs text-gray-500 font-medium mb-1">Domain</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {isLoading ? <span className="text-sm text-gray-400">Loading...</span> : 
                   profileData?.domain?.map((d: string, i: number) => (
                     <span key={i} className="px-2 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-300">{d}</span>
                   )) || <span className="text-sm text-gray-400">N/A</span>}
                </div>
              </div>
              <div className="p-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl">
                <p className="text-xs text-gray-500 font-medium mb-1">Tech Stack</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {isLoading ? <span className="text-sm text-gray-400">Loading...</span> : 
                   profileData?.tech_stack?.map((t: string, i: number) => (
                     <span key={i} className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300">{t}</span>
                   )) || <span className="text-sm text-gray-400">N/A</span>}
                </div>
              </div>
            </div>

            {!isViewOnly && (
              <button
                 className="w-full py-3 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 hover:text-indigo-200 rounded-xl text-sm font-semibold transition-colors"
                 onClick={() => console.log('Edit Profile Clicked')}
              >
                Edit Profile (TODO)
              </button>
            )}

          </div>
        </div>
      </main>

      {/* Avatar Upload Modal */}
      {isModalOpen && !isViewOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => !isUploading && setIsModalOpen(false)} 
          />
          <div className="bg-[#13151a] border border-white/10 rounded-3xl w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-white">Update Avatar</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isUploading}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAvatarUpload} className="space-y-6 text-center">
                
                {/* Preview / Upload Area */}
                <div className="relative group w-32 h-32 mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <div className="relative w-full h-full rounded-full border-2 border-dashed border-white/20 group-hover:border-indigo-400/50 bg-[#0a0c10] flex items-center justify-center overflow-hidden transition-colors cursor-pointer">
                    <img 
                      src={avatarUrl || defaultAvatar} 
                      alt="Preview" 
                      className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-30 transition-opacity"
                    />
                    <div className="z-10 flex flex-col items-center pointer-events-none">
                      <svg className="w-8 h-8 text-white mb-1 shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                      </svg>
                      <span className="text-xs font-bold text-white shadow-sm">Select File</span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setAvatarUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-400">JPEG or PNG, max 10MB.</p>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="w-full py-3.5 bg-white/[0.05] border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Uploading...
                    </>
                  ) : 'Save Avatar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
