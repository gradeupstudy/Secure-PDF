import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  FileText, 
  UserCheck, 
  ExternalLink, 
  LogOut, 
  Printer, 
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface NavbarProps {
  currentView: 'ADMIN' | 'STUDENT';
  onNavigateToAdmin?: () => void;
  onNavigateToStudent?: (token?: string) => void;
  onOpenCreateModal?: () => void;
  onLogout?: () => void;
  activeTokenForQuickSwitch?: string;
  adminEmail?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigateToAdmin,
  onNavigateToStudent,
  onOpenCreateModal,
  onLogout,
  activeTokenForQuickSwitch,
  adminEmail = 'admin@gradeupstudy.com',
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onNavigateToAdmin}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950/50">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent">
                  GRADEUP STUDY
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-600/30 text-rose-300 border border-rose-500/40">
                  SECURE PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Protected Examination & Study Materials</p>
            </div>
          </div>

          {/* Quick Info & Security Badges */}
          <div className="hidden md:flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium">Encrypted View Only</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-amber-300">
              <Printer className="h-3.5 w-3.5" />
              <span>Controlled Watermarked Print</span>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-3">
            {currentView === 'ADMIN' ? (
              <>
                {onOpenCreateModal && (
                  <button
                    id="btn-create-secure-link-nav"
                    onClick={onOpenCreateModal}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-900/30 transition active:scale-95"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>+ Generate Secure Link</span>
                  </button>
                )}

                {activeTokenForQuickSwitch && onNavigateToStudent && (
                  <button
                    id="btn-switch-to-demo-student"
                    onClick={() => onNavigateToStudent(activeTokenForQuickSwitch)}
                    className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium transition"
                    title="Preview assigned secure link in Student Viewer mode"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Student View Preview</span>
                  </button>
                )}

                <div className="hidden lg:flex items-center pl-3 border-l border-slate-800 text-xs text-slate-400">
                  <div className="text-right mr-2">
                    <span className="block font-medium text-slate-200">Admin</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[140px] block">{adminEmail}</span>
                  </div>
                </div>

                {onLogout && (
                  <button
                    id="btn-admin-logout"
                    onClick={onLogout}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                    title="Sign Out Admin"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                id="btn-back-to-admin"
                onClick={onNavigateToAdmin}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>Return to Admin Panel</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
