import React from 'react';
import { 
  ShieldAlert, 
  Clock, 
  Ban, 
  Smartphone, 
  AlertTriangle, 
  FileX, 
  HelpCircle,
  ArrowLeft,
  Lock
} from 'lucide-react';

interface AccessErrorScreenProps {
  errorType: 'INVALID_TOKEN' | 'REVOKED' | 'EXPIRED' | 'PDF_DISABLED' | 'SESSION_TERMINATED' | 'DEVICE_LIMIT_EXCEEDED' | 'RATE_LIMITED' | string;
  customMessage?: string;
  onReturnToAdmin?: () => void;
}

export const AccessErrorScreen: React.FC<AccessErrorScreenProps> = ({
  errorType,
  customMessage,
  onReturnToAdmin,
}) => {
  const getErrorDetails = () => {
    switch (errorType) {
      case 'REVOKED':
        return {
          icon: <Ban className="h-12 w-12 text-rose-500" />,
          title: 'Access Revoked',
          subtitle: 'This access link is no longer active.',
          description: customMessage || 'This secure access assignment has been revoked by the Gradeup Study administrator. Please contact your faculty or mentor to receive an updated access link.',
          color: 'from-rose-950 to-slate-900',
          borderColor: 'border-rose-800/80',
          badgeText: 'SECURITY REVOCATION',
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'EXPIRED':
        return {
          icon: <Clock className="h-12 w-12 text-amber-500" />,
          title: 'Access Expired',
          subtitle: 'The validity period for this document has ended.',
          description: customMessage || 'The scheduled access window for this practice set or study material has concluded. For extensions, contact Gradeup Study support.',
          color: 'from-amber-950/80 to-slate-900',
          borderColor: 'border-amber-800/80',
          badgeText: 'TIME EXPIRED',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'DEVICE_LIMIT_EXCEEDED':
        return {
          icon: <Smartphone className="h-12 w-12 text-orange-500" />,
          title: 'Device Limit Exceeded',
          subtitle: 'Active session detected on another device.',
          description: customMessage || 'This secure link is configured with strict single/dual device access to prevent link sharing. Please close previous active tabs/devices or request a reset from your administrator.',
          color: 'from-orange-950/80 to-slate-900',
          borderColor: 'border-orange-800/80',
          badgeText: 'ANTI-SHARING POLICY',
          badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        };
      case 'PDF_DISABLED':
        return {
          icon: <FileX className="h-12 w-12 text-slate-400" />,
          title: 'Document Unavailable',
          subtitle: 'This study module is currently undergoing updates.',
          description: customMessage || 'The requested PDF file is temporarily offline or being updated with new questions. Please check back shortly.',
          color: 'from-slate-900 to-slate-950',
          borderColor: 'border-slate-800',
          badgeText: 'MODULE OFFLINE',
          badgeColor: 'bg-slate-700 text-slate-300 border-slate-600',
        };
      case 'SESSION_TERMINATED':
        return {
          icon: <AlertTriangle className="h-12 w-12 text-rose-400" />,
          title: 'Session Terminated',
          subtitle: 'Your viewing session has been safely closed.',
          description: customMessage || 'This session was terminated either by an administrator action or due to inactivity. Re-open your original link to begin a new session.',
          color: 'from-rose-950/80 to-slate-900',
          borderColor: 'border-rose-800/80',
          badgeText: 'SESSION CLOSED',
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'INVALID_TOKEN':
      default:
        return {
          icon: <ShieldAlert className="h-12 w-12 text-indigo-400" />,
          title: 'Invalid or Unavailable Link',
          subtitle: 'Unable to verify cryptographic access credentials.',
          description: customMessage || 'The access token provided does not match any active assignment in our records. Please verify the URL or request a new link from Gradeup Study.',
          color: 'from-indigo-950/80 to-slate-900',
          borderColor: 'border-indigo-800/80',
          badgeText: 'VERIFICATION FAILED',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        };
    }
  };

  const details = getErrorDetails();

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className={`max-w-lg w-full bg-gradient-to-b ${details.color} border ${details.borderColor} p-8 sm:p-10 rounded-2xl shadow-2xl text-center relative overflow-hidden`}>
        
        {/* Top Gradeup Badge */}
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-6 border bg-slate-900/80 text-slate-300 border-slate-700">
          <Lock className="h-3 w-3 text-amber-400" />
          <span>Gradeup Study Security Gateway</span>
        </div>

        <div className="mx-auto h-20 w-20 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center mb-5 shadow-lg">
          {details.icon}
        </div>

        <div className="inline-block mb-3">
          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-widest border ${details.badgeColor}`}>
            {details.badgeText}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
          {details.title}
        </h1>

        <p className="text-sm font-medium text-slate-300 mb-4">
          {details.subtitle}
        </p>

        <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto mb-8">
          {details.description}
        </p>

        {/* Support Card */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-left text-xs text-slate-400 mb-6">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold mb-1">
            <HelpCircle className="h-4 w-4 text-indigo-400" />
            <span>Need Assistance?</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Contact Gradeup Study Academic Support with your registered Mobile Number and Full Name.
          </p>
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-300">
            <span>Email: <strong className="text-slate-100 font-mono">support@gradeupstudy.com</strong></span>
            <span>Helpline: <strong className="text-slate-100 font-mono">+91 98160 12345</strong></span>
          </div>
        </div>

        {onReturnToAdmin && (
          <button
            id="btn-return-admin-from-error"
            onClick={onReturnToAdmin}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Admin Dashboard</span>
          </button>
        )}
      </div>
    </div>
  );
};
