import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, KeyRound, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface AdminLoginProps {
  onLoginSuccess: (token: string, admin: any) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@gradeupstudy.com');
  const [password, setPassword] = useState('gradeup2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.loginAdmin(email, password);
      onLoginSuccess(res.token, res.admin);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDemo = () => {
    setEmail('admin@gradeupstudy.com');
    setPassword('gradeup2026');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-8 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-950/60 mb-4">
            <ShieldCheck className="h-9 w-9 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Gradeup Study Admin
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Secure PDF Distribution & Access Control Center
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs flex items-start space-x-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Access Denied</p>
              <p className="mt-0.5 text-rose-300">{error}</p>
            </div>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Administrator Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="admin-login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="admin@gradeupstudy.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Password / Security Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="h-4 w-4" />
              </div>
              <input
                id="admin-login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-admin-submit-login"
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center space-x-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-900/40 transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <span>Verifying Credentials...</span>
              ) : (
                <>
                  <span>Authenticate Session</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Demo Helper Banner */}
        <div className="mt-6 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/60 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Pre-configured Admin Access
              </span>
              <button
                type="button"
                onClick={handleUseDemo}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline"
              >
                Auto Fill Demo
              </button>
            </div>
            <p className="text-slate-400 text-[11px]">
              Email: <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">admin@gradeupstudy.com</code>
            </p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Password: <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">gradeup2026</code>
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <Lock className="h-3 w-3 text-slate-400" />
            Protected by 256-bit SHA Hashing & Server-side RLS Policies
          </p>
        </div>
      </div>
    </div>
  );
};
