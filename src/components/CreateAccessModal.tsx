import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  RotateCcw, 
  Ban, 
  ShieldCheck, 
  Printer, 
  Clock, 
  Smartphone, 
  FileText, 
  User, 
  Mail, 
  Phone,
  AlertCircle
} from 'lucide-react';
import { PdfDocument, Student, Assignment } from '../types';
import { api } from '../services/api';

interface CreateAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfs: PdfDocument[];
  students: Student[];
  onAssignmentCreated: () => void;
  onNavigateToStudentViewer?: (token: string) => void;
}

export const CreateAccessModal: React.FC<CreateAccessModalProps> = ({
  isOpen,
  onClose,
  pdfs,
  students,
  onAssignmentCreated,
  onNavigateToStudentViewer,
}) => {
  // Form State
  const [studentName, setStudentName] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [selectedPdfId, setSelectedPdfId] = useState('');
  const [allowPrint, setAllowPrint] = useState(true);
  const [printLimit, setPrintLimit] = useState<number>(3);
  const [deviceLimit, setDeviceLimit] = useState<number>(1);
  const [expiryOption, setExpiryOption] = useState<'30days' | '7days' | '24hours' | 'unlimited' | 'custom'>('30days');
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  // Result State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    assignment: Assignment;
    rawToken: string;
    tokenUrl: string;
  } | null>(null);

  useEffect(() => {
    if (pdfs.length > 0 && !selectedPdfId) {
      setSelectedPdfId(pdfs[0].id);
    }
  }, [pdfs, selectedPdfId]);

  if (!isOpen) return null;

  const handleSelectExistingStudent = (std: Student) => {
    setStudentName(std.name);
    setStudentMobile(std.mobile);
    setStudentEmail(std.email);
    if (std.notes) setNotes(std.notes);
  };

  const calculateExpiryDate = (): string | null => {
    const now = new Date();
    if (expiryOption === 'unlimited') return null;
    if (expiryOption === '24hours') {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
    if (expiryOption === '7days') {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (expiryOption === '30days') {
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (expiryOption === 'custom' && customExpiryDate) {
      return new Date(customExpiryDate).toISOString();
    }
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!studentMobile.trim() || !studentEmail.trim()) {
      setError('Student mobile number and email address are required.');
      return;
    }

    if (!selectedPdfId) {
      setError('Please select a PDF document to assign.');
      return;
    }

    setLoading(true);

    try {
      const expiresAt = calculateExpiryDate();
      const res = await api.createAssignment({
        studentName: studentName.trim() || 'Candidate',
        studentMobile: studentMobile.trim(),
        studentEmail: studentEmail.trim(),
        pdfId: selectedPdfId,
        allowPrint,
        printLimit: allowPrint ? printLimit : 0,
        deviceLimit,
        expiresAt,
        notes: notes.trim(),
      });

      setCreatedResult({
        assignment: res.assignment,
        rawToken: res.rawToken,
        tokenUrl: window.location.origin + res.tokenUrl,
      });

      onAssignmentCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to generate secure link.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!createdResult) return;
    navigator.clipboard.writeText(createdResult.tokenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetModal = () => {
    setCreatedResult(null);
    setError(null);
    setCopied(false);
  };

  const handleRevokeDirect = async () => {
    if (!createdResult) return;
    try {
      await api.revokeAssignment(createdResult.assignment.id);
      setCreatedResult(prev => prev ? {
        ...prev,
        assignment: { ...prev.assignment, status: 'REVOKED' }
      } : null);
      onAssignmentCreated();
    } catch (err: any) {
      alert('Revocation failed: ' + err.message);
    }
  };

  const handleResetTokenDirect = async () => {
    if (!createdResult) return;
    try {
      const res = await api.resetAssignment(createdResult.assignment.id);
      setCreatedResult({
        assignment: res.assignment,
        rawToken: res.rawToken,
        tokenUrl: window.location.origin + res.tokenUrl,
      });
      onAssignmentCreated();
    } catch (err: any) {
      alert('Link reset failed: ' + err.message);
    }
  };

  const selectedPdf = pdfs.find(p => p.id === selectedPdfId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {createdResult ? 'Secure Access Link Created' : 'Create Secure PDF Access Assignment'}
              </h3>
              <p className="text-xs text-slate-400">
                {createdResult ? 'Unique cryptographically hashed student access credentials' : 'Gradeup Study Manual Student Assignment & Controlled Distribution'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!createdResult ? (
            /* ASSIGNMENT CREATION FORM */
            <form onSubmit={handleGenerate} className="space-y-4">
              
              {/* Quick Pick from Existing Students if any */}
              {students.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Quick Pick Registered Student (Optional)
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {students.slice(0, 6).map(std => (
                      <button
                        key={std.id}
                        type="button"
                        onClick={() => handleSelectExistingStudent(std)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
                      >
                        {std.name} ({std.mobile})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Student Mobile Number <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      id="input-student-mobile"
                      type="text"
                      required
                      placeholder="+91 98160 12345"
                      value={studentMobile}
                      onChange={e => setStudentMobile(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Student Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      id="input-student-email"
                      type="email"
                      required
                      placeholder="student@example.com"
                      value={studentEmail}
                      onChange={e => setStudentEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Student Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Student Full Name (Appears on Watermark)
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="input-student-name"
                    type="text"
                    placeholder="Rahul Kumar"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Select PDF */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select PDF Document <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <select
                    id="select-pdf-document"
                    value={selectedPdfId}
                    onChange={e => setSelectedPdfId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {pdfs.map(pdf => (
                      <option key={pdf.id} value={pdf.id}>
                        {pdf.title} ({pdf.pageCount} Pages • {(pdf.fileSize / 1024).toFixed(0)} KB)
                      </option>
                    ))}
                  </select>
                </div>
                {selectedPdf && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    File: <code className="text-slate-300">{selectedPdf.fileName}</code> • Private Storage Bucket
                  </p>
                )}
              </div>

              {/* Expiration Settings */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Access Expiration
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { id: '24hours', label: '24 Hours' },
                    { id: '7days', label: '7 Days' },
                    { id: '30days', label: '30 Days' },
                    { id: 'unlimited', label: 'No Expiry' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setExpiryOption(opt.id as any)}
                      className={`py-1.5 px-3 rounded-lg border text-center font-medium transition ${
                        expiryOption === opt.id
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Print & Device Security Options */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Printer className="h-4 w-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Allow Controlled Printing</span>
                      <span className="text-[11px] text-slate-400">Generates dynamic watermarked print stream</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowPrint}
                      onChange={e => setAllowPrint(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {allowPrint && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700/60">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Print Limit (Copies Allowed)
                      </label>
                      <select
                        id="select-print-limit"
                        value={printLimit}
                        onChange={e => setPrintLimit(Number(e.target.value))}
                        className="w-full py-1.5 px-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                      >
                        <option value={1}>1 Print Copy Only</option>
                        <option value={2}>2 Prints</option>
                        <option value={3}>3 Prints (Standard)</option>
                        <option value={5}>5 Prints</option>
                        <option value={10}>10 Prints</option>
                        <option value={0}>Unlimited</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Device Restriction Policy
                      </label>
                      <select
                        id="select-device-limit"
                        value={deviceLimit}
                        onChange={e => setDeviceLimit(Number(e.target.value))}
                        className="w-full py-1.5 px-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                      >
                        <option value={1}>1 Active Device (Strict Anti-Share)</option>
                        <option value={2}>2 Active Devices</option>
                        <option value={0}>Unlimited Devices</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Administrative Notes / Batch Info (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Police Constable Batch #4 - Shimla"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  id="btn-submit-generate-link"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-900/40 transition active:scale-[0.99] disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{loading ? 'Generating 256-Bit Token...' : 'GENERATE SECURE LINK'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* AFTER GENERATION - DISPLAY RESULT SPECIFICATION SECTION 6 & 35 */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-600/30 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 block">
                      ASSIGNMENT ACTIVE & READY TO SHARE
                    </span>
                    <span className="text-xs text-slate-300">
                      256-Bit Cryptographic Tokenized Access Endpoint Created
                    </span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                  createdResult.assignment.status === 'ACTIVE' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {createdResult.assignment.status}
                </span>
              </div>

              {/* Summary Metadata Card */}
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Student:</span>
                  <span className="font-bold text-slate-100">{createdResult.assignment.student?.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Mobile:</span>
                  <span className="font-mono text-slate-200">{createdResult.assignment.student?.mobile}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-mono text-slate-200">{createdResult.assignment.student?.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">PDF:</span>
                  <span className="font-semibold text-slate-200">{createdResult.assignment.pdf?.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Expires:</span>
                  <span className="text-slate-200">
                    {createdResult.assignment.expiresAt 
                      ? new Date(createdResult.assignment.expiresAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })
                      : 'Never (No Expiration)'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Print Limit:</span>
                  <span className="font-bold text-amber-300">
                    {createdResult.assignment.allowPrint
                      ? (createdResult.assignment.printLimit > 0 ? `${createdResult.assignment.printLimit} Prints` : 'Unlimited')
                      : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* The Link Box */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Secure Access Link (Share Manually with Student):
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 p-2.5 bg-slate-950 border border-indigo-500/50 rounded-xl font-mono text-xs text-indigo-300 truncate select-all">
                    {createdResult.tokenUrl}
                  </div>
                  <button
                    id="btn-copy-generated-link"
                    type="button"
                    onClick={handleCopy}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs flex items-center space-x-1.5 transition active:scale-95 shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                    <span>{copied ? 'COPIED!' : 'COPY LINK'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons as per Section 6 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <button
                  id="btn-modal-open-viewer"
                  type="button"
                  onClick={() => onNavigateToStudentViewer && onNavigateToStudentViewer(createdResult.rawToken)}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
                  <span>OPEN</span>
                </button>

                <button
                  id="btn-modal-revoke-link"
                  type="button"
                  onClick={handleRevokeDirect}
                  className="py-2.5 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                >
                  <Ban className="h-3.5 w-3.5 text-rose-400" />
                  <span>REVOKE</span>
                </button>

                <button
                  id="btn-modal-reset-link"
                  type="button"
                  onClick={handleResetTokenDirect}
                  className="py-2.5 px-3 rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-200 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                  <span>RESET LINK</span>
                </button>

                <button
                  id="btn-modal-create-another"
                  type="button"
                  onClick={handleResetModal}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center transition"
                >
                  + New Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
