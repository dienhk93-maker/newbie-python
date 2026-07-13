import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { AgencyHome } from './components/agency/AgencyHome';
import { AgencyProfileForm } from './components/agency/AgencyProfileForm';
import { AgencyProfileView } from './components/agency/AgencyProfileView';
import { ChatView } from './components/chat/ChatView';

const App: React.FC = () => {
  const { isAuthenticated, userRole } = useAuth();
  const location = useLocation();

  // Route Guard: Redirect unauthenticated users to login
  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  // Redirect logic for root / login paths based on role
  if (isAuthenticated && (location.pathname === '/' || location.pathname === '/login')) {
     if (userRole === 'AGENCY') {
       return <Navigate to="/agency/home" replace />;
     } else {
       return <Navigate to="/chat" replace />;
     }
  }

  return (
    <Routes>
      <Route path="/login" element={<AuthScreen />} />
      <Route path="/chat" element={isAuthenticated ? <ChatView /> : <Navigate to="/login" />} />
      <Route path="/agency/home" element={isAuthenticated && userRole === 'AGENCY' ? <AgencyHome /> : <Navigate to="/" />} />
      <Route path="/agency/apply" element={isAuthenticated && userRole === 'AGENCY' ? <AgencyProfileForm /> : <Navigate to="/" />} />
      <Route path="/agency/profile" element={isAuthenticated && userRole === 'AGENCY' ? <AgencyProfileView /> : <Navigate to="/" />} />
      <Route path="/agency/profile/:id" element={isAuthenticated ? <AgencyProfileView /> : <Navigate to="/" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
