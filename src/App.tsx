import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLogin } from './components/AdminLogin';
import { SecurePdfViewer } from './components/SecurePdfViewer';
import { AccessErrorScreen } from './components/AccessErrorScreen';
import { StudentAccessVerification } from './types';
import { api, getAdminToken, clearAdminToken, setAdminToken } from './services/api';
import { Loader2 } from 'lucide-react';

export default function App() {
  // Navigation & Routing State
  const [currentRoute, setCurrentRoute] = useState<'ADMIN' | 'STUDENT'>('ADMIN');
  const [activeToken, setActiveToken] = useState<string | null>(null);

  // Admin Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(true);
  const [adminProfile, setAdminProfile] = useState<any>({
    email: 'admin@gradeupstudy.com',
    name: 'Gradeup Study Administrator',
  });

  // Student Access State
  const [studentVerification, setStudentVerification] = useState<StudentAccessVerification | null>(null);
  const [verifyingStudent, setVerifyingStudent] = useState<boolean>(false);
  const [accessError, setAccessError] = useState<{ type: string; message?: string } | null>(null);

  // Available Demo Token for Quick Header Switch
  const [quickSwitchToken, setQuickSwitchToken] = useState<string | undefined>(undefined);

  // Parse Path and Token from URL
  const parseUrl = useCallback(() => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    // 1. Check for /access/:token path
    const accessMatch = pathname.match(/\/access\/([a-zA-Z0-9_-]+)/);
    if (accessMatch && accessMatch[1]) {
      const token = accessMatch[1];
      setActiveToken(token);
      setCurrentRoute('STUDENT');
      verifyToken(token);
      return;
    }

    // 2. Check for ?token=... query parameter
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setActiveToken(queryToken);
      setCurrentRoute('STUDENT');
      verifyToken(queryToken);
      return;
    }

    // Default to Admin route
    setCurrentRoute('ADMIN');
  }, []);

  const verifyToken = async (token: string) => {
    setVerifyingStudent(true);
    setAccessError(null);

    try {
      const result = await api.verifyStudentAccess(token);
      if (result.valid) {
        setStudentVerification(result);
        setAccessError(null);
      } else {
        setAccessError({
          type: result.error || 'INVALID_TOKEN',
          message: result.message,
        });
      }
    } catch (err: any) {
      setAccessError({
        type: 'INVALID_TOKEN',
        message: err.message || 'Unable to establish secure connection with Gradeup Study verification server.',
      });
    } finally {
      setVerifyingStudent(false);
    }
  };

  useEffect(() => {
    // Initial admin token check
    const token = getAdminToken();
    if (token) {
      setIsAdminAuthenticated(true);
    }

    parseUrl();

    // Fetch an active assignment token for the quick-switch button
    api.getAssignments()
      .then(asgs => {
        const active = asgs.find(a => a.status === 'ACTIVE' && a.currentAccessToken);
        if (active?.currentAccessToken) {
          setQuickSwitchToken(active.currentAccessToken);
        }
      })
      .catch(() => {});

    // Listen to popstate (browser back/forward)
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, [parseUrl]);

  // Navigate to Student Viewer directly
  const handleNavigateToStudentViewer = (token: string) => {
    window.history.pushState({}, '', `/access/${token}`);
    setActiveToken(token);
    setCurrentRoute('STUDENT');
    verifyToken(token);
  };

  // Navigate to Admin Panel
  const handleNavigateToAdmin = () => {
    window.history.pushState({}, '', '/');
    setCurrentRoute('ADMIN');
    setStudentVerification(null);
    setAccessError(null);
  };

  // Admin Logout
  const handleAdminLogout = () => {
    clearAdminToken();
    setIsAdminAuthenticated(false);
  };

  // Admin Login Success
  const handleAdminLoginSuccess = (token: string, admin: any) => {
    setAdminToken(token);
    setIsAdminAuthenticated(true);
    if (admin) setAdminProfile(admin);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* Global Navigation Header */}
      <Navbar
        currentView={currentRoute}
        onNavigateToAdmin={handleNavigateToAdmin}
        onNavigateToStudent={handleNavigateToStudentViewer}
        onLogout={handleAdminLogout}
        activeTokenForQuickSwitch={quickSwitchToken}
        adminEmail={adminProfile?.email}
      />

      {/* Main Routed Content */}
      <main className="flex-1 flex flex-col">
        {currentRoute === 'STUDENT' ? (
          /* STUDENT ACCESS VIEW */
          verifyingStudent ? (
            <div className="flex-1 flex flex-col items-center justify-center py-32 space-y-4 text-center">
              <div className="h-14 w-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shadow-lg">
                <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Verifying Cryptographic Access Credentials...</h3>
                <p className="text-xs text-slate-400 mt-1">Checking token signature, active sessions, and student license</p>
              </div>
            </div>
          ) : accessError ? (
            <AccessErrorScreen
              errorType={accessError.type}
              customMessage={accessError.message}
              onReturnToAdmin={handleNavigateToAdmin}
            />
          ) : studentVerification && activeToken ? (
            <SecurePdfViewer
              token={activeToken}
              verificationData={studentVerification}
              onReturnToAdmin={handleNavigateToAdmin}
              onSessionTerminatedOrRevoked={(reason) => {
                setAccessError({ type: 'SESSION_TERMINATED', message: reason });
              }}
            />
          ) : (
            <AccessErrorScreen
              errorType="INVALID_TOKEN"
              onReturnToAdmin={handleNavigateToAdmin}
            />
          )
        ) : (
          /* ADMIN PORTAL VIEW */
          isAdminAuthenticated ? (
            <AdminDashboard
              onNavigateToStudentViewer={handleNavigateToStudentViewer}
            />
          ) : (
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
            />
          )
        )}
      </main>
    </div>
  );
}
