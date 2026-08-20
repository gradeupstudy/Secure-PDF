import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  FileText, 
  Users, 
  Link as LinkIcon, 
  Printer, 
  ShieldAlert, 
  Laptop, 
  Settings, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Ban, 
  RotateCcw, 
  Trash2, 
  Eye, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles,
  Smartphone,
  Mail,
  ShieldCheck,
  Edit2,
  Database,
  Cloud,
  Server,
  Code,
  ArrowRight
} from 'lucide-react';
import { 
  OverviewStats, 
  PdfDocument, 
  Student, 
  Assignment, 
  PrintLog, 
  SecurityEvent, 
  SessionRecord 
} from '../types';
import { api } from '../services/api';
import { CreateAccessModal } from './CreateAccessModal';

interface AdminDashboardProps {
  onNavigateToStudentViewer: (token: string) => void;
}

type TabType = 'overview' | 'pdfs' | 'students' | 'links' | 'printLogs' | 'securityLogs' | 'sessions' | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateToStudentViewer,
}) => {
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Data States
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [pdfs, setPdfs] = useState<PdfDocument[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [printLogs, setPrintLogs] = useState<PrintLog[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityEvent[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  // Modals & UI States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadPdfModalOpen, setIsUploadPdfModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Edit Limits Modal
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [newPrintLimit, setNewPrintLimit] = useState<number>(3);
  const [newAllowPrint, setNewAllowPrint] = useState<boolean>(true);

  // PDF Upload Form
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // New Student Form
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentMobile, setNewStudentMobile] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentNotes, setNewStudentNotes] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);

  // Supabase State
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [loadingSupabase, setLoadingSupabase] = useState(false);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedVercelEnv, setCopiedVercelEnv] = useState(false);

  // Direct Credentials Form State
  const [inputSupabaseUrl, setInputSupabaseUrl] = useState('');
  const [inputSupabaseKey, setInputSupabaseKey] = useState('');
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSupabaseStatus = async () => {
    try {
      setLoadingSupabase(true);
      const st = await api.getSupabaseStatus();
      setSupabaseStatus(st);
      if (st.url && !inputSupabaseUrl) {
        setInputSupabaseUrl(st.url);
      }
    } catch (err) {
      console.warn('Failed to load Supabase status:', err);
    } finally {
      setLoadingSupabase(false);
    }
  };

  const handleSaveAndTestSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSupabaseUrl || !inputSupabaseKey) {
      setConfigFeedback({ success: false, message: 'Please enter both Supabase Project URL and Service Role Key.' });
      return;
    }

    try {
      setSavingCredentials(true);
      setConfigFeedback(null);
      const res = await api.configureSupabase(inputSupabaseUrl, inputSupabaseKey);
      if (res.connected) {
        setConfigFeedback({
          success: true,
          message: '🎉 Supabase connected successfully! Local data has been synchronized with the cloud.'
        });
      } else {
        setConfigFeedback({
          success: false,
          message: '⚠️ ' + (res.error || 'Connection failed. Please check your credentials.')
        });
      }
      await fetchSupabaseStatus();
    } catch (err: any) {
      setConfigFeedback({
        success: false,
        message: '❌ ' + (err.message || 'Failed to save and connect.')
      });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleSyncToSupabase = async () => {
    try {
      setSyncingSupabase(true);
      setSyncMessage(null);
      const res = await api.syncToSupabase();
      if (res.success) {
        setSyncMessage('✅ ' + res.message);
      } else {
        setSyncMessage('⚠️ ' + (res.message || 'Sync failed.'));
      }
      await fetchSupabaseStatus();
    } catch (err: any) {
      setSyncMessage('❌ ' + (err.message || 'Error executing sync'));
    } finally {
      setSyncingSupabase(false);
    }
  };

  const handleCopySqlSchema = async () => {
    try {
      const data = await api.getSupabaseSqlSchema();
      await navigator.clipboard.writeText(data.sql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  };

  const fetchAllData = async () => {
    try {
      setRefreshing(true);
      const [ovData, pdfData, stdData, asgData, prntData, secData, sessData] = await Promise.all([
        api.getOverview().catch(() => null),
        api.getPdfs().catch(() => []),
        api.getStudents().catch(() => []),
        api.getAssignments().catch(() => []),
        api.getPrintLogs().catch(() => []),
        api.getSecurityLogs().catch(() => []),
        api.getActiveSessions().catch(() => []),
      ]);

      if (ovData) setOverview(ovData);
      setPdfs(pdfData);
      setStudents(stdData);
      setAssignments(asgData);
      setPrintLogs(prntData);
      setSecurityLogs(secData);
      setSessions(sessData);
      fetchSupabaseStatus();
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Copy Link Handler
  const handleCopyLink = (token: string, assignmentId: string) => {
    const fullUrl = `${window.location.origin}/access/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkId(assignmentId);
    setTimeout(() => setCopiedLinkId(null), 2500);
  };

  // Revoke Assignment Handler
  const handleRevoke = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this access link immediately? The student will lose access right away.')) return;
    try {
      await api.revokeAssignment(id);
      await fetchAllData();
    } catch (err: any) {
      alert('Revoke failed: ' + err.message);
    }
  };

  // Reset Assignment Link Handler (Section 8 requirement)
  const handleResetLink = async (id: string) => {
    if (!window.confirm('Reset this link? The existing token and active sessions will be permanently invalidated, and a brand new random token will be generated.')) return;
    try {
      const res = await api.resetAssignment(id);
      await fetchAllData();
      alert(`New secure link generated!\n\n${window.location.origin}${res.tokenUrl}`);
    } catch (err: any) {
      alert('Reset failed: ' + err.message);
    }
  };

  // Terminate Session Handler
  const handleTerminateSession = async (sessionId: string) => {
    if (!window.confirm('Terminate this student session now?')) return;
    try {
      await api.terminateSession(sessionId);
      await fetchAllData();
    } catch (err: any) {
      alert('Terminate failed: ' + err.message);
    }
  };

  // Terminate All Sessions for Assignment
  const handleTerminateAllForAssignment = async (assignmentId: string) => {
    try {
      const res = await api.terminateAllSessionsForAssignment(assignmentId);
      await fetchAllData();
      alert(`Terminated ${res.terminatedCount} active session(s).`);
    } catch (err: any) {
      alert('Action failed: ' + err.message);
    }
  };

  // Handle PDF Upload Submit
  const handlePdfUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a PDF file');
      return;
    }
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('pdfFile', selectedFile);
      formData.append('title', uploadTitle || selectedFile.name.replace('.pdf', ''));
      formData.append('description', uploadDescription);

      await api.uploadPdf(formData);
      setIsUploadPdfModalOpen(false);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadDescription('');
      await fetchAllData();
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  // Handle Add Student Submit
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentMobile || !newStudentEmail) {
      alert('Mobile and Email are required');
      return;
    }
    setSavingStudent(true);
    try {
      await api.createStudent({
        name: newStudentName || 'Candidate',
        mobile: newStudentMobile,
        email: newStudentEmail,
        notes: newStudentNotes,
      });
      setIsAddStudentModalOpen(false);
      setNewStudentName('');
      setNewStudentMobile('');
      setNewStudentEmail('');
      setNewStudentNotes('');
      await fetchAllData();
    } catch (err: any) {
      alert('Failed to add student: ' + err.message);
    } finally {
      setSavingStudent(false);
    }
  };

  // Save Limits
  const handleSaveLimits = async () => {
    if (!editingAssignment) return;
    try {
      await api.updateLimits(editingAssignment.id, {
        printLimit: newPrintLimit,
        allowPrint: newAllowPrint,
      });
      setEditingAssignment(null);
      await fetchAllData();
    } catch (err: any) {
      alert('Failed to update limits: ' + err.message);
    }
  };

  // CSV Export Utility (Section 31)
  const exportToCsv = (filename: string, rows: any[]) => {
    if (!rows || !rows.length) {
      alert('No records available to export.');
      return;
    }
    const keys = Object.keys(rows[0]);
    const csvContent = [
      keys.join(','),
      ...rows.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const matchesSearch = 
        (a.student?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.student?.mobile || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.student?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.pdf?.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const now = new Date();
      const isExpired = a.expiresAt && new Date(a.expiresAt) <= now;

      if (statusFilter === 'ALL') return matchesSearch;
      if (statusFilter === 'ACTIVE') return matchesSearch && a.status === 'ACTIVE' && !isExpired;
      if (statusFilter === 'REVOKED') return matchesSearch && a.status === 'REVOKED';
      if (statusFilter === 'EXPIRED') return matchesSearch && (a.status === 'EXPIRED' || isExpired);
      return matchesSearch;
    });
  }, [assignments, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      
      {/* Top Banner / Header Actions */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Security Operations & Document Portal
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  ENTERPRISE RLS ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Manage PDF practice sets, manual candidate assignments, dynamic watermarking, and print logs.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                id="btn-refresh-data"
                onClick={fetchAllData}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                title="Sync and Refresh Database State"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                id="btn-open-create-assignment-modal"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-950/50 flex items-center gap-2 transition active:scale-95"
              >
                <Sparkles className="h-4 w-4" />
                <span>+ Create Secure Link</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs (Section 3 specifications) */}
          <div className="flex items-center space-x-1 mt-6 border-b border-slate-800 overflow-x-auto no-scrollbar">
            {[
              { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
              { id: 'links', label: 'Access Links', count: assignments.length, icon: <LinkIcon className="h-4 w-4" /> },
              { id: 'pdfs', label: 'PDFs', count: pdfs.length, icon: <FileText className="h-4 w-4" /> },
              { id: 'students', label: 'Students', count: students.length, icon: <Users className="h-4 w-4" /> },
              { id: 'printLogs', label: 'Print Logs', count: printLogs.length, icon: <Printer className="h-4 w-4" /> },
              { id: 'securityLogs', label: 'Security Radar', count: securityLogs.length, icon: <ShieldAlert className="h-4 w-4" /> },
              { id: 'sessions', label: 'Sessions & Devices', count: sessions.filter(s => s.status === 'ACTIVE').length, icon: <Laptop className="h-4 w-4" /> },
              { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
            ].map(tab => (
              <button
                key={tab.id}
                id={`tab-nav-${tab.id}`}
                onClick={() => setCurrentTab(tab.id as TabType)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                  currentTab === tab.id
                    ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    currentTab === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* =========================================================================
            TAB 1: OVERVIEW & KPI METRICS (Section 3)
           ========================================================================= */}
        {currentTab === 'overview' && (
          <div className="space-y-8">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total PDFs', value: overview?.totalPdfs ?? pdfs.length, icon: <FileText className="h-5 w-5 text-indigo-400" />, sub: 'Private storage files' },
                { label: 'Total Students', value: overview?.totalStudents ?? students.length, icon: <Users className="h-5 w-5 text-emerald-400" />, sub: 'Verified numbers' },
                { label: 'Active Access Links', value: overview?.activeLinks ?? assignments.filter(a => a.status === 'ACTIVE').length, icon: <LinkIcon className="h-5 w-5 text-sky-400" />, sub: '256-bit hashed tokens' },
                { label: 'Revoked Links', value: overview?.revokedLinks ?? assignments.filter(a => a.status === 'REVOKED').length, icon: <Ban className="h-5 w-5 text-rose-400" />, sub: 'Immediate access stop' },
                { label: 'Expired Links', value: overview?.expiredLinks ?? 0, icon: <Clock className="h-5 w-5 text-amber-400" />, sub: 'Past scheduled date' },
                { label: 'Authorized Prints', value: overview?.totalPrints ?? printLogs.filter(p => p.status === 'SUCCESS').length, icon: <Printer className="h-5 w-5 text-emerald-400" />, sub: 'Watermarked outputs' },
                { label: 'Suspicious Detections', value: overview?.suspiciousSessions ?? securityLogs.filter(s => s.severity === 'HIGH').length, icon: <ShieldAlert className="h-5 w-5 text-rose-400" />, sub: 'Screenshots / Focus' },
                { label: "Today's Activity Events", value: overview?.todayActivityCount ?? 8, icon: <Sparkles className="h-5 w-5 text-indigo-300" />, sub: 'Live audit timeline' },
              ].map((card, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">{card.label}</span>
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                      {card.icon}
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-white tracking-tight">{card.value}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">{card.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions & Security Radar Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Quick Assignment Launcher */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/40 space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Manual Assignment Workflow</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter candidate's mobile number, email, and select a private PDF to generate an encrypted tokenized link.
                </p>
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Generate New Secure Link</span>
                  </button>
                  <button
                    onClick={() => setIsUploadPdfModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center justify-center gap-2"
                  >
                    <Upload className="h-4 w-4 text-indigo-400" />
                    <span>Upload Practice PDF Material</span>
                  </button>
                </div>
              </div>

              {/* Recent Security Deterrence Events */}
              <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Recent Security Deterrence Radar</h3>
                  </div>
                  <button
                    onClick={() => setCurrentTab('securityLogs')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    View All →
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {securityLogs.slice(0, 5).map(event => (
                    <div
                      key={event.id}
                      className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-750 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className={`h-2 w-2 rounded-full ${
                          event.severity === 'HIGH' ? 'bg-rose-500 animate-pulse' : event.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        <div>
                          <span className="font-semibold text-slate-200 block">
                            {event.eventType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Candidate: {event.studentName || 'Student'} • IP: {event.ipAddress}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(event.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {securityLogs.length === 0 && (
                    <p className="text-xs text-slate-500 py-4 text-center">No security alerts recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Access to Active Links */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <LinkIcon className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Active Assignments Ready for Sharing</h3>
                </div>
                <button
                  onClick={() => setCurrentTab('links')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Manage All {assignments.length} Links →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {assignments.slice(0, 3).map(asg => (
                  <div key={asg.id} className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm text-slate-100">{asg.student?.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          asg.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {asg.status}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-300 font-medium truncate">{asg.pdf?.title}</p>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">{asg.student?.mobile}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400">
                        Prints: <strong className="text-amber-300">{asg.printCount}/{asg.printLimit > 0 ? asg.printLimit : '∞'}</strong>
                      </span>
                      {asg.currentAccessToken && (
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleCopyLink(asg.currentAccessToken!, asg.id)}
                            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                            title="Copy Link"
                          >
                            {copiedLinkId === asg.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => onNavigateToStudentViewer(asg.currentAccessToken!)}
                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
                            title="Open Viewer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: ACCESS LINKS & ASSIGNMENTS (Section 6, 8, 30, 35)
           ========================================================================= */}
        {currentTab === 'links' && (
          <div className="space-y-6">
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by student, mobile, email, PDF..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center space-x-1 bg-slate-800 border border-slate-700 p-1 rounded-xl text-xs">
                  {['ALL', 'ACTIVE', 'REVOKED', 'EXPIRED'].map(f => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        statusFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => exportToCsv('gradeup_access_assignments', filteredAssignments)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs flex items-center gap-1.5"
                  title="Export Access Report CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              </div>
            </div>

            {/* Assignments Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-700/80">
                    <tr>
                      <th className="py-3.5 px-4">Student & Contact</th>
                      <th className="py-3.5 px-4">Assigned PDF</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Print Limit</th>
                      <th className="py-3.5 px-4">Expires</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredAssignments.map(asg => (
                      <tr key={asg.id} className="hover:bg-slate-800/40 transition">
                        
                        {/* Student */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white">{asg.student?.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{asg.student?.mobile}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{asg.student?.email}</div>
                        </td>

                        {/* PDF */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200 max-w-xs truncate">{asg.pdf?.title}</div>
                          <div className="text-[11px] text-slate-400">
                            {asg.pdf?.pageCount} Pages • {asg.pdf?.fileName}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            asg.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : asg.status === 'REVOKED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {asg.status}
                          </span>
                        </td>

                        {/* Print Usage & Limit */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-200">
                            {asg.allowPrint ? (
                              <span className="text-amber-300">
                                {asg.printCount} / {asg.printLimit > 0 ? `${asg.printLimit} Prints` : 'Unlimited'}
                              </span>
                            ) : (
                              <span className="text-rose-400">Disabled</span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setEditingAssignment(asg);
                              setNewPrintLimit(asg.printLimit);
                              setNewAllowPrint(asg.allowPrint);
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline mt-0.5 block"
                          >
                            Edit limits
                          </button>
                        </td>

                        {/* Expiry */}
                        <td className="py-3.5 px-4 text-[11px] text-slate-400">
                          {asg.expiresAt 
                            ? new Date(asg.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : 'No Expiry'}
                        </td>

                        {/* Actions (Section 6 & 8) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {asg.currentAccessToken && (
                              <>
                                <button
                                  id={`btn-copy-${asg.id}`}
                                  onClick={() => handleCopyLink(asg.currentAccessToken!, asg.id)}
                                  className="px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-lg text-xs font-semibold transition"
                                  title="Copy Student Link"
                                >
                                  {copiedLinkId === asg.id ? 'Copied!' : 'Copy Link'}
                                </button>
                                <button
                                  id={`btn-open-${asg.id}`}
                                  onClick={() => onNavigateToStudentViewer(asg.currentAccessToken!)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                                  title="Open Viewer as Student"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
                                </button>
                              </>
                            )}

                            {asg.status === 'ACTIVE' && (
                              <button
                                id={`btn-revoke-${asg.id}`}
                                onClick={() => handleRevoke(asg.id)}
                                className="p-1.5 bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-lg transition"
                                title="Revoke Link Immediately"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}

                            <button
                              id={`btn-reset-${asg.id}`}
                              onClick={() => handleResetLink(asg.id)}
                              className="p-1.5 bg-amber-950/40 hover:bg-amber-900 text-amber-300 border border-amber-800/80 rounded-lg transition"
                              title="Reset Link (Generates new token, terminates active sessions)"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAssignments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                          No matching student access links found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: PDF MANAGEMENT (Section 4)
           ========================================================================= */}
        {currentTab === 'pdfs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Private PDF Document Vault</h2>
                <p className="text-xs text-slate-400">Stored in private, non-public storage with encrypted stream distribution.</p>
              </div>
              <button
                id="btn-upload-pdf-modal"
                onClick={() => setIsUploadPdfModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Upload className="h-4 w-4" />
                <span>Upload New PDF</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pdfs.map(pdf => (
                <div key={pdf.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-9 w-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        pdf.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {pdf.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-white">{pdf.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{pdf.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2 text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>Pages:</span>
                      <strong className="text-slate-200">{pdf.pageCount} Pages</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>File Size:</span>
                      <strong className="text-slate-200">{(pdf.fileSize / 1024).toFixed(0)} KB</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Storage Path:</span>
                      <code className="text-slate-400 font-mono truncate max-w-[140px]">{pdf.storagePath}</code>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        onClick={() => {
                          // Quick assign modal for this PDF
                          setIsCreateModalOpen(true);
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-bold"
                      >
                        + Assign to Student
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm('Delete this PDF from private storage?')) {
                            await api.deletePdf(pdf.id);
                            await fetchAllData();
                          }
                        }}
                        className="text-rose-400 hover:text-rose-300"
                        title="Delete PDF"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: STUDENT DIRECTORY (Section 5)
           ========================================================================= */}
        {currentTab === 'students' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Student Database Directory</h2>
                <p className="text-xs text-slate-400">Normalized mobile numbers & emails for indelible watermark stamping.</p>
              </div>
              <button
                id="btn-add-student-modal"
                onClick={() => setIsAddStudentModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span>Register Student</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-700/80">
                  <tr>
                    <th className="py-3.5 px-4">Student Name</th>
                    <th className="py-3.5 px-4">Mobile Number</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Batch / Notes</th>
                    <th className="py-3.5 px-4">Active Assignments</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {students.map(std => {
                    const stdAssignments = assignments.filter(a => a.studentId === std.id && a.status === 'ACTIVE');
                    return (
                      <tr key={std.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 font-bold">
                            {std.name.charAt(0)}
                          </div>
                          <span>{std.name}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">{std.mobile}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">{std.email}</td>
                        <td className="py-3.5 px-4 text-slate-400">{std.notes || '—'}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[11px]">
                            {stdAssignments.length} Material(s)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                          >
                            + Assign Link
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: PRINT LOGS (Section 18)
           ========================================================================= */}
        {currentTab === 'printLogs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Controlled Print Audit Logs</h2>
                <p className="text-xs text-slate-400">Full audit trail of every student print attempt with timestamp, IP, and status.</p>
              </div>
              <button
                onClick={() => exportToCsv('gradeup_print_audit_logs', printLogs)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-700/80">
                  <tr>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">PDF Document</th>
                    <th className="py-3.5 px-4">Attempt #</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">IP Address / Client</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {printLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white block">{log.studentName || 'Candidate'}</span>
                        <span className="text-[11px] font-mono text-slate-400">{log.studentMobile}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-medium">{log.pdfTitle || 'Exam Mock Set'}</td>
                      <td className="py-3.5 px-4 font-bold text-amber-300">#{log.attemptNumber}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          log.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{log.ipAddress}</td>
                    </tr>
                  ))}
                  {printLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        No print attempts logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 6: SECURITY RADAR & SCREENSHOT LOGS (Section 14 & 19)
           ========================================================================= */}
        {currentTab === 'securityLogs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Security & Deterrence Radar Logs</h2>
                <p className="text-xs text-slate-400">Detections for PrintScreen, keyboard shortcuts, visibility focus losses, and anti-copy attempts.</p>
              </div>
              <button
                onClick={() => exportToCsv('gradeup_security_events', securityLogs)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-700/80">
                  <tr>
                    <th className="py-3.5 px-4">Event Type</th>
                    <th className="py-3.5 px-4">Severity</th>
                    <th className="py-3.5 px-4">Candidate</th>
                    <th className="py-3.5 px-4">Metadata</th>
                    <th className="py-3.5 px-4">IP Address</th>
                    <th className="py-3.5 px-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {securityLogs.map(sec => (
                    <tr key={sec.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                        <ShieldAlert className={`h-4 w-4 ${
                          sec.severity === 'HIGH' ? 'text-rose-400' : sec.severity === 'MEDIUM' ? 'text-amber-400' : 'text-indigo-400'
                        }`} />
                        <span>{sec.eventType.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          sec.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300' : sec.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {sec.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">{sec.studentName || 'Student'}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {JSON.stringify(sec.metadata || {})}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{sec.ipAddress}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(sec.createdAt).toLocaleTimeString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 7: ACTIVE SESSIONS & DEVICE CONTROL (Section 20 & 21)
           ========================================================================= */}
        {currentTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Active Student Sessions & Connected Devices</h2>
                <p className="text-xs text-slate-400">Real-time session tracker. Terminate unauthorized or concurrent devices instantly.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map(sess => (
                <div key={sess.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Laptop className="h-4 w-4 text-indigo-400" />
                        <span className="font-bold text-sm text-white">{sess.studentName || 'Active Candidate'}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        sess.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {sess.status}
                      </span>
                    </div>

                    <p className="text-xs text-indigo-300 font-medium truncate">{sess.pdfTitle}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">Device ID: {sess.deviceIdentifier}</p>
                    <p className="text-[11px] text-slate-500 font-mono">IP: {sess.ipAddress}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      Last Active: {new Date(sess.lastActivityAt).toLocaleTimeString('en-IN')}
                    </span>
                    {sess.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleTerminateSession(sess.id)}
                        className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg text-xs font-bold transition"
                      >
                        Terminate
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-xs text-slate-500 py-8 col-span-3 text-center">No active student sessions currently open.</p>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 8: SYSTEM SETTINGS & POLICY NOTICE (Section 41 & 45)
           ========================================================================= */}
        {currentTab === 'settings' && (
          <div className="max-w-3xl space-y-6">
            {/* SUPABASE PERMANENT CLOUD DATABASE PANEL */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      Supabase Cloud Database (Permanent Storage)
                      {supabaseStatus?.connected ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Live & Connected
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Needs Supabase Keys
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Store student profiles, assigned PDFs, access tokens, watermarks, and print logs permanently in Supabase.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchSupabaseStatus}
                    disabled={loadingSupabase}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingSupabase ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </button>
                </div>
              </div>

              {/* Status Overview Card */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Connection Status:</span>
                    <span className="font-bold text-sm text-white flex items-center gap-2 mt-0.5">
                      {supabaseStatus?.connected ? (
                        <span className="text-emerald-400 flex items-center gap-1.5">🟢 Connected to Supabase Cloud</span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1.5">🟡 Running on Temporary Local Memory</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Connected Supabase URL:</span>
                    <span className="font-mono text-slate-300 text-xs block mt-0.5 truncate">
                      {supabaseStatus?.url || '(Not connected yet)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Synced Cloud Data:</span>
                    <span className="text-slate-200 font-semibold block mt-0.5">
                      {supabaseStatus?.localRecordCounts?.students || students.length} Students • {supabaseStatus?.localRecordCounts?.assignments || assignments.length} Active Links • {supabaseStatus?.localRecordCounts?.pdfs || pdfs.length} Documents
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Print & Security Logs:</span>
                    <span className="text-slate-200 font-semibold block mt-0.5">
                      {supabaseStatus?.localRecordCounts?.printLogs || printLogs.length} Prints • {supabaseStatus?.localRecordCounts?.securityEvents || securityLogs.length} Security Audits
                    </span>
                  </div>
                </div>

                {supabaseStatus?.error && (
                  <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Notice:</p>
                      <p className="text-amber-300/90 text-[11px] mt-0.5">{supabaseStatus.error}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* OPTION A: DIRECT CREDENTIALS INPUT IN ADMIN PANEL */}
              <div className="p-5 rounded-xl bg-slate-950 border border-indigo-900/40 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
                    <Code className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Option 1: Connect Directly from Admin Panel</h3>
                    <p className="text-[11px] text-slate-400">Paste your Supabase credentials here to instantly connect without restarting.</p>
                  </div>
                </div>

                <form onSubmit={handleSaveAndTestSupabase} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://xyzcompany.supabase.co"
                      value={inputSupabaseUrl}
                      onChange={(e) => setInputSupabaseUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Supabase Service Role Key (or Secret API Key)
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={inputSupabaseKey}
                      onChange={(e) => setInputSupabaseKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Where to find: Supabase Dashboard ➔ <strong>Project Settings</strong> ➔ <strong>API</strong> ➔ <strong>Project API keys</strong> (use <code>service_role</code> secret).
                    </p>
                  </div>

                  {configFeedback && (
                    <div className={`p-3 rounded-xl text-xs ${configFeedback.success ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200' : 'bg-rose-950/60 border border-rose-800 text-rose-200'}`}>
                      {configFeedback.message}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={savingCredentials}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-900/30"
                    >
                      <ShieldCheck className={`h-4 w-4 ${savingCredentials ? 'animate-spin' : ''}`} />
                      {savingCredentials ? 'Connecting & Verifying...' : 'Save & Connect Supabase'}
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncToSupabase}
                      disabled={syncingSupabase || !supabaseStatus?.connected}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 transition disabled:opacity-40"
                    >
                      <Cloud className={`h-4 w-4 ${syncingSupabase ? 'animate-pulse' : ''}`} />
                      {syncingSupabase ? 'Syncing Records...' : 'Push Local Data to Cloud'}
                    </button>
                  </div>
                </form>
              </div>

              {/* OPTION B: VERCEL DEPLOYMENT ENVIRONMENT VARIABLES GUIDE */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-600/20 text-sky-400">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Option 2: Vercel me Deploy Kiya Hai? (Vercel Environment Setup)</h3>
                    <p className="text-[11px] text-slate-400">Agar aapne project Vercel par host kiya hai, to Vercel Dashboard me yeh keys add karein:</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-300 text-xs">Vercel Environment Variables:</span>
                      <button
                        onClick={() => {
                          const envText = `SUPABASE_URL=https://your-project.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here`;
                          navigator.clipboard.writeText(envText);
                          setCopiedVercelEnv(true);
                          setTimeout(() => setCopiedVercelEnv(false), 3000);
                        }}
                        className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                      >
                        {copiedVercelEnv ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copiedVercelEnv ? 'Copied Example!' : 'Copy Variable Names'}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-400 space-y-1 border border-slate-800">
                      <div><strong className="text-slate-400">Variable 1:</strong> Key: <span className="text-white">SUPABASE_URL</span></div>
                      <div><strong className="text-slate-400">Variable 2:</strong> Key: <span className="text-white">SUPABASE_SERVICE_ROLE_KEY</span></div>
                    </div>

                    <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-1 pt-1 leading-relaxed">
                      <li>Vercel Dashboard par jayein ➔ Apne Project par click karein.</li>
                      <li><strong>Settings</strong> tab ➔ Left menu me <strong>Environment Variables</strong> par click karein.</li>
                      <li>Dono variables add karein (Production, Preview, Development teeno tick rakhein).</li>
                      <li>Add karne ke baad <strong>Deployments</strong> tab me jakar <strong>Redeploy</strong> par click karein.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* STEP 3: SUPABASE SQL SCHEMA CREATION */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400">
                      <Code className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Database Tables Create Karein (SQL Schema)</h3>
                      <p className="text-[11px] text-slate-400">Supabase me tables (`students`, `assignments`, `pdfs`, etc.) automatically banane ke liye SQL run karein.</p>
                    </div>
                  </div>

                  <button
                    onClick={handleCopySqlSchema}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-md"
                  >
                    {copiedSql ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                    {copiedSql ? 'SQL Script Copied!' : 'Copy Supabase SQL Schema'}
                  </button>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                  <strong>Instructions:</strong> Supabase Dashboard ➔ <strong>SQL Editor</strong> ➔ <strong>New Query</strong> ➔ Copy kiya hua SQL paste karein aur <strong>Run</strong> button dabayein.
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-400" />
                Portal Security & Architecture Policy
              </h2>
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <h4 className="font-bold text-slate-100 mb-1">Security Reality & Technical Boundaries</h4>
                  <p className="text-slate-400 text-[11px]">
                    As documented in Gradeup Study security guidelines, client browser technologies cannot mathematically guarantee 100% prevention of external hardware cameras, virtual machine screen mirrors, or OS-level display capturing. Therefore, our boundary relies on server-side token authorization, dynamic indelible watermarks containing registered candidate mobile & email, and strictly audited print counts.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                    <span className="font-bold text-slate-200 block">Brand Identification</span>
                    <span className="text-[11px] text-slate-400">Gradeup Study Educational Portal</span>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                    <span className="font-bold text-slate-200 block">Default Print Limit</span>
                    <span className="text-[11px] text-amber-300">3 Authorized Copies</span>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                    <span className="font-bold text-slate-200 block">Support Email</span>
                    <span className="text-[11px] font-mono text-slate-300">support@gradeupstudy.com</span>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                    <span className="font-bold text-slate-200 block">Support Helpline</span>
                    <span className="text-[11px] font-mono text-slate-300">+91 98160 12345</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE SECURE LINK MODAL (Section 6 & 35) */}
      <CreateAccessModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        pdfs={pdfs}
        students={students}
        onAssignmentCreated={fetchAllData}
        onNavigateToStudentViewer={onNavigateToStudentViewer}
      />

      {/* UPLOAD PDF MODAL */}
      {isUploadPdfModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="h-4 w-4 text-indigo-400" />
              Upload Private PDF Material
            </h3>
            <form onSubmit={handlePdfUploadSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select PDF File</label>
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white file:text-xs file:font-semibold hover:file:bg-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Display Title</label>
                <input
                  type="text"
                  placeholder="HP Police Constable Practice Set..."
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description / Notes</label>
                <textarea
                  placeholder="Examination module details..."
                  rows={2}
                  value={uploadDescription}
                  onChange={e => setUploadDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsUploadPdfModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingPdf}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {uploadingPdf ? 'Processing & Storing...' : 'Upload PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER STUDENT MODAL */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-400" />
              Register New Student
            </h3>
            <form onSubmit={handleAddStudentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Rahul Kumar"
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="+91 98160 12345"
                  value={newStudentMobile}
                  onChange={e => setNewStudentMobile(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="rahul@example.com"
                  value={newStudentEmail}
                  onChange={e => setNewStudentEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Batch / Center Notes</label>
                <input
                  type="text"
                  placeholder="HP Police Batch 2026"
                  value={newStudentNotes}
                  onChange={e => setNewStudentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                >
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LIMITS MODAL */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Update Print Limits for {editingAssignment.student?.name}</h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Allow Printing:</span>
                <input
                  type="checkbox"
                  checked={newAllowPrint}
                  onChange={e => setNewAllowPrint(e.target.checked)}
                />
              </div>

              {newAllowPrint && (
                <div>
                  <label className="block text-slate-300 mb-1">Print Copies Allowed (0 = Unlimited):</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={newPrintLimit}
                    onChange={e => setNewPrintLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setEditingAssignment(null)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLimits}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
