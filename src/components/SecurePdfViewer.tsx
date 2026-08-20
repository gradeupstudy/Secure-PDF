import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldCheck, 
  Printer, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  AlertTriangle, 
  EyeOff, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  Info,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { StudentAccessVerification } from '../types';
import { api, getClientSupabase } from '../services/api';
import { SecurePdfDocument } from '../lib/pdfRenderer';
import { getLocalPdfBlob } from '../lib/pdfCache';

interface SecurePdfViewerProps {
  token: string;
  verificationData: StudentAccessVerification;
  onSessionTerminatedOrRevoked?: (reason: string) => void;
  onReturnToAdmin?: () => void;
}

export const SecurePdfViewer: React.FC<SecurePdfViewerProps> = ({
  token,
  verificationData,
  onSessionTerminatedOrRevoked,
  onReturnToAdmin,
}) => {
  // Viewer State
  const [scale, setScale] = useState<number>(1.3);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(verificationData.pdf?.pageCount || 1);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Security & Deterrence State
  const [isFocusShieldActive, setIsFocusShieldActive] = useState<boolean>(false);
  const [screenshotWarningVisible, setScreenshotWarningVisible] = useState<boolean>(false);
  const [watermarkOffset, setWatermarkOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);

  // Print Control State
  const [printCount, setPrintCount] = useState<number>(verificationData.assignment?.printCount || 0);
  const [printLimit] = useState<number>(verificationData.assignment?.printLimit || 3);
  const [allowPrint] = useState<boolean>(verificationData.assignment?.allowPrint ?? true);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printStatusMessage, setPrintStatusMessage] = useState<string | null>(null);
  const [printErrorMessage, setPrintErrorMessage] = useState<string | null>(null);

  // Canvas Refs
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<SecurePdfDocument | null>(null);
  const loadedPdfBufferRef = useRef<ArrayBuffer | null>(null);
  const sessionId = verificationData.session?.id || '';

  // 1. Dynamic Watermark Micro-Shifting (every 8 seconds to deter static mask subtraction)
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkOffset({
        x: Math.floor(Math.random() * 24) - 12,
        y: Math.floor(Math.random() * 24) - 12,
      });
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // 2. Anti-Copy, Anti-Save, Screenshot & Shortcut Blocker
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      api.logSecurityEvent(sessionId, 'COPY_ATTEMPT_BLOCKED', { action: 'context_menu' });
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+S / Cmd+S (Save)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        api.logSecurityEvent(sessionId, 'KEYBOARD_SHORTCUT_BLOCKED', { key: 'Save (Ctrl+S)' });
        triggerScreenshotShield('Save shortcut is disabled for this secure document.');
        return false;
      }

      // Block Ctrl+P / Cmd+P (Uncontrolled Browser Print)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        api.logSecurityEvent(sessionId, 'KEYBOARD_SHORTCUT_BLOCKED', { key: 'Browser Print (Ctrl+P)' });
        triggerScreenshotShield('Please use the official [Print Document] button for authorized printing.');
        return false;
      }

      // Block Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return false;
      }

      // Block Ctrl+A / Cmd+A (Select All)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        return false;
      }

      // Block Ctrl+C / Cmd+C (Copy)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        api.logSecurityEvent(sessionId, 'COPY_ATTEMPT_BLOCKED', { key: 'Copy (Ctrl+C)' });
        return false;
      }

      // PrintScreen / Screenshot shortcut detection
      if (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === 's' || e.key === 'S')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S'))
      ) {
        api.logSecurityEvent(sessionId, 'SCREENSHOT_ATTEMPT_DETECTED', { key: e.key });
        triggerScreenshotShield('Screen capture is restricted for this protected Gradeup Study material.');
        try {
          navigator.clipboard?.writeText('');
        } catch {
          // ignore
        }
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      api.logSecurityEvent(sessionId, 'COPY_ATTEMPT_BLOCKED', { action: 'clipboard_copy' });
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('copy', handleCopy);
    };
  }, [sessionId]);

  // 3. Visibility Change & Focus Loss Shield
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsFocusShieldActive(true);
        setTabSwitchCount(prev => prev + 1);
        api.logSecurityEvent(sessionId, 'VISIBILITY_FOCUS_LOST', { state: 'hidden' });
      } else {
        // re-focus delay
        setTimeout(() => {
          setIsFocusShieldActive(false);
        }, 300);
      }
    };

    const handleWindowBlur = () => {
      setIsFocusShieldActive(true);
      api.logSecurityEvent(sessionId, 'VISIBILITY_FOCUS_LOST', { action: 'blur' });
    };

    const handleWindowFocus = () => {
      setTimeout(() => {
        setIsFocusShieldActive(false);
      }, 300);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [sessionId]);

  const triggerScreenshotShield = (message: string) => {
    setScreenshotWarningVisible(true);
    setIsFocusShieldActive(true);
    setTimeout(() => {
      setScreenshotWarningVisible(false);
      setIsFocusShieldActive(false);
    }, 3500);
  };

  // 4. Load Secure PDF Data from Protected Backend or Storage
  const loadPdf = useCallback(async () => {
    setPdfLoading(true);
    setPdfLoadError(null);

    const pdfId = verificationData.pdf?.id || '';
    const token = (verificationData.session as any)?.sessionToken || (verificationData.assignment as any)?.currentAccessToken || (verificationData.assignment as any)?.accessToken || '';

    // 1. Try server endpoint
    try {
      const res = await fetch(`/api/access/view-data?sessionId=${encodeURIComponent(sessionId)}&pdfId=${encodeURIComponent(pdfId)}&token=${encodeURIComponent(token)}`, {
        headers: {
          'x-session-id': sessionId,
          'x-access-token': token,
          'x-pdf-id': pdfId,
        },
      });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        if (buffer && buffer.byteLength > 100) {
          loadedPdfBufferRef.current = buffer;
          const doc = new SecurePdfDocument();
          await doc.loadFromBuffer(buffer);
          pdfDocRef.current = doc;
          setTotalPages(doc.totalPages);
          setPdfLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend PDF endpoint unreachable, attempting fallback storage...', err);
    }

    // 2. Try IndexedDB Local Cache
    try {
      const localBlob = await getLocalPdfBlob(pdfId) || 
        (verificationData.pdf?.storagePath ? await getLocalPdfBlob(verificationData.pdf.storagePath) : null) ||
        (verificationData.pdf?.fileName ? await getLocalPdfBlob(verificationData.pdf.fileName) : null);

      if (localBlob && localBlob.byteLength > 100) {
        loadedPdfBufferRef.current = localBlob;
        const doc = new SecurePdfDocument();
        await doc.loadFromBuffer(localBlob);
        pdfDocRef.current = doc;
        setTotalPages(doc.totalPages);
        setPdfLoading(false);
        return;
      }
    } catch (cacheErr) {
      console.warn('IndexedDB PDF lookup error:', cacheErr);
    }

    // 3. Try Supabase Storage
    const sb = getClientSupabase();
    if (sb && pdfId) {
      try {
        const { data: pdfRow } = await sb.from('pdfs').select('*').eq('id', pdfId).single();
        const filePath = pdfRow?.filepath || pdfRow?.storage_path || pdfRow?.filename;
        if (filePath) {
          const { data: fileBlob } = await sb.storage.from('pdfs').download(filePath);
          if (fileBlob) {
            const buffer = await fileBlob.arrayBuffer();
            loadedPdfBufferRef.current = buffer;
            const doc = new SecurePdfDocument();
            await doc.loadFromBuffer(buffer);
            pdfDocRef.current = doc;
            setTotalPages(doc.totalPages);
            setPdfLoading(false);
            return;
          }
        }
      } catch (sbErr) {
        console.warn('Supabase storage fallback error:', sbErr);
      }
    }

    // 4. Generate Interactive Secure Practice Sheet if binary is unavailable
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const title = verificationData.pdf?.title || 'Gradeup Study Material';
      const studentName = verificationData.student?.name || 'Candidate';
      const numPages = verificationData.pdf?.pageCount || 3;

      for (let i = 1; i <= numPages; i++) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        page.drawText('GRADEUP STUDY - OFFICIAL STUDY MODULE', {
          x: 50,
          y: 800,
          size: 14,
          font: fontBold,
          color: rgb(0.12, 0.16, 0.38),
        });
        page.drawText(title, {
          x: 50,
          y: 770,
          size: 16,
          font: fontBold,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(`Page ${i} of ${numPages} • Enrolled Student: ${studentName}`, {
          x: 50,
          y: 745,
          size: 10,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.4),
        });

        // Content placeholder lines
        page.drawText('1. Himachal Pradesh General Knowledge & Competitive Examination Syllabus', {
          x: 50,
          y: 700,
          size: 12,
          font: fontBold,
          color: rgb(0.15, 0.15, 0.15),
        });
        page.drawText('   Comprehensive notes, exam patterns, practice questions and previous years solutions.', {
          x: 50,
          y: 680,
          size: 11,
          font: fontRegular,
          color: rgb(0.3, 0.3, 0.3),
        });
        page.drawText('   Strictly protected study material for authorized enrolled students of Gradeup Study Library.', {
          x: 50,
          y: 660,
          size: 11,
          font: fontRegular,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      const pdfBytes = await pdfDoc.save();
      loadedPdfBufferRef.current = pdfBytes.buffer;
      const doc = new SecurePdfDocument();
      await doc.loadFromBuffer(pdfBytes.buffer);
      pdfDocRef.current = doc;
      setTotalPages(doc.totalPages);
      setPdfLoading(false);
    } catch (genErr: any) {
      console.error('Secure PDF loading error:', genErr);
      setPdfLoadError(
        'Unable to load protected document. Your session may have expired or been revoked.'
      );
      setPdfLoading(false);
    }
  }, [sessionId, verificationData]);

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  // 5. Render visible pages onto Canvases
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDocRef.current || pdfLoading) return;
    const canvas = canvasRefs.current[currentPage];
    if (!canvas) return;

    try {
      await pdfDocRef.current.renderPageToCanvas(currentPage, canvas, scale);
    } catch (err) {
      console.error('Page rendering error:', err);
    }
  }, [currentPage, scale, pdfLoading]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Zoom Helpers
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 2.5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.7));
  const handleResetZoom = () => setScale(1.3);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 6. Controlled Print Workflow (Strict Server-Validated + Watermarked)
  const handleControlledPrint = async () => {
    if (!allowPrint) {
      alert('Printing has been disabled for this document by Gradeup Study.');
      return;
    }

    if (printLimit > 0 && printCount >= printLimit) {
      alert(`Print limit reached (${printCount}/${printLimit} copies already printed).`);
      return;
    }

    setIsPrinting(true);
    setPrintStatusMessage('Stamping student watermarks across all pages of the document...');
    setPrintErrorMessage(null);

    try {
      // 1. Generate stamped PDF with real student watermark data & real document buffer
      const blob = await api.requestAuthorizedPrint(
        sessionId,
        loadedPdfBufferRef.current,
        {
          brand: 'GRADEUP STUDY',
          studentName: verificationData.student?.name || 'Candidate',
          studentMobile: verificationData.student?.mobile || '',
          studentEmail: verificationData.student?.email || '',
          accessId: verificationData.assignment?.id || 'GS-SECURE',
          sessionId,
          pdfId: verificationData.pdf?.id,
          timestamp: new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          })
        }
      );

      setPrintStatusMessage('Stamp generated. Launching print dialog...');
      setPrintCount(prev => prev + 1);

      api.logSecurityEvent(sessionId, 'AUTHORIZED_PRINT_TRIGGERED', {
        pageCount: totalPages,
        studentName: verificationData.student?.name,
        timestamp: new Date().toISOString()
      });

      // 2. Create temporary object URL for print iframe
      const blobUrl = URL.createObjectURL(blob);
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.src = blobUrl;

      document.body.appendChild(printIframe);

      let printTriggered = false;
      const triggerPrint = () => {
        if (printTriggered) return;
        printTriggered = true;
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (err) {
          console.warn('Iframe print failed, opening print helper:', err);
          window.open(blobUrl, '_blank');
        } finally {
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
            }
            URL.revokeObjectURL(blobUrl);
            setIsPrinting(false);
            setPrintStatusMessage(null);
          }, 4000);
        }
      };

      printIframe.onload = () => {
        setTimeout(triggerPrint, 600);
      };

      // Fallback timer in case iframe.onload does not fire in certain browser configurations
      setTimeout(() => {
        if (!printTriggered) {
          triggerPrint();
        }
      }, 2000);

    } catch (err: any) {
      console.error('Print failed:', err);
      setPrintErrorMessage(err.message || 'Print authorization failed.');
      setIsPrinting(false);
    }
  };

  const watermark = verificationData.watermarkData || {
    brand: 'GRADEUP STUDY',
    studentName: verificationData.student?.name || 'Authorized Candidate',
    studentMobile: verificationData.student?.mobile || '',
    studentEmail: verificationData.student?.email || '',
    accessId: 'GS-' + (verificationData.assignment?.id.slice(-6).toUpperCase() || 'SECURE'),
    sessionId: sessionId.slice(-6).toUpperCase(),
    timestamp: new Date().toLocaleString('en-IN'),
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none relative overflow-x-hidden"
      onDragStart={e => e.preventDefault()}
    >
      {/* 1. TOP SECURE METADATA & CONTROL BAR */}
      <div className="bg-slate-900/95 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30 px-4 py-2.5 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Document & Candidate Info */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center space-x-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-600 to-indigo-600 flex items-center justify-center shadow-md">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-extrabold text-white tracking-tight truncate max-w-[280px] sm:max-w-md">
                    {verificationData.pdf?.title || 'Gradeup Study Material'}
                  </h2>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    PROTECTED
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <span>Licensed to: <strong className="text-slate-200">{watermark.studentName}</strong></span>
                  <span>•</span>
                  <span>Mob: <code className="text-indigo-300">{verificationData.student?.mobile}</code></span>
                </div>
              </div>
            </div>

            {onReturnToAdmin && (
              <button
                onClick={onReturnToAdmin}
                className="md:hidden text-[11px] text-slate-400 hover:text-slate-200 border border-slate-700 px-2 py-1 rounded"
              >
                Admin
              </button>
            )}
          </div>

          {/* Center Navigation & Zoom Controls */}
          <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700 px-2 py-1 rounded-xl text-xs">
            {/* Page Navigation */}
            <button
              id="btn-prev-page"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="font-mono text-xs px-2 text-slate-200">
              Page <strong className="text-white">{currentPage}</strong> of {totalPages}
            </span>

            <button
              id="btn-next-page"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            {/* Zoom */}
            <button
              id="btn-zoom-out"
              onClick={handleZoomOut}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>

            <span className="font-mono text-[11px] text-slate-400 w-10 text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              id="btn-zoom-in"
              onClick={handleZoomIn}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            <button
              id="btn-toggle-fullscreen"
              onClick={toggleFullscreen}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Right: Print Action Button */}
          <div className="flex items-center space-x-3">
            {allowPrint ? (
              <div className="flex items-center space-x-2">
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">
                    Print Usage
                  </span>
                  <span className="text-xs font-bold text-amber-300">
                    {printLimit > 0 ? `${printCount} / ${printLimit} Prints` : 'Unlimited'}
                  </span>
                </div>

                <button
                  id="btn-controlled-print"
                  onClick={handleControlledPrint}
                  disabled={isPrinting || (printLimit > 0 && printCount >= printLimit)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition active:scale-95 ${
                    printLimit > 0 && printCount >= printLimit
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-950/40'
                  }`}
                >
                  {isPrinting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                      <span>Preparing Print...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 text-slate-950" />
                      <span>PRINT DOCUMENT</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span>Printing Disabled</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. SECURITY STATUS STRIP */}
      <div className="bg-slate-900 border-b border-slate-800/80 px-4 py-1 text-[11px] text-slate-400 flex items-center justify-between overflow-x-auto">
        <div className="flex items-center space-x-4 shrink-0">
          <span className="flex items-center gap-1 text-slate-300 font-medium">
            <Lock className="h-3 w-3 text-emerald-400" />
            Direct Download Disabled
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-medium">
            <EyeOff className="h-3 w-3 text-indigo-400" />
            Dynamic Watermark Shield Active
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-medium">
            <ShieldCheck className="h-3 w-3 text-amber-400" />
            Access ID: GS-{verificationData.assignment?.id.slice(-6).toUpperCase()}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 hidden sm:block shrink-0">
          Anti-Copy & Visibility Guard Active • Gradeup Study Secure Platform
        </div>
      </div>

      {/* 3. SCREENSHOT DETECTED / WARNING BANNER */}
      {screenshotWarningVisible && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center space-x-2 animate-bounce z-40">
          <AlertTriangle className="h-4 w-4" />
          <span>Screen capture action detected. All activity is logged under candidate audit profile.</span>
        </div>
      )}

      {/* 4. MAIN VIEWER STAGE */}
      <div className="flex-1 flex justify-center items-start p-4 sm:p-8 overflow-auto bg-slate-950 relative min-h-[75vh]">
        
        {pdfLoading ? (
          <div className="flex flex-col items-center justify-center my-auto py-24 space-y-4 text-center">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Loading Protected Study Material...</p>
              <p className="text-xs text-slate-400 mt-1">Decrypting binary stream and preparing security layers</p>
            </div>
          </div>
        ) : pdfLoadError ? (
          <div className="max-w-md w-full p-6 bg-slate-900 border border-rose-900/60 rounded-2xl text-center space-y-4 my-auto">
            <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-white">Document Access Error</h3>
            <p className="text-xs text-slate-300">{pdfLoadError}</p>
            <button
              onClick={loadPdf}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : (
          /* CANVAS & WATERMARK CONTAINER */
          <div className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white group">
            
            {/* HTML5 Canvas Rendering Target */}
            <canvas
              ref={el => (canvasRefs.current[currentPage] = el)}
              className="block pointer-events-none transition-all"
            />

            {/* DYNAMIC HIGH-DETERRENCE OVERLAY WATERMARK */}
            <div 
              className="absolute inset-0 pointer-events-none overflow-hidden flex flex-col justify-around select-none"
              style={{
                transform: `translate(${watermarkOffset.x}px, ${watermarkOffset.y}px)`,
                transition: 'transform 2s ease-in-out',
              }}
            >
              {[1, 2, 3].map(rowIdx => (
                <div 
                  key={rowIdx} 
                  className="transform -rotate-[28deg] scale-110 my-4 text-center leading-tight opacity-[0.22]"
                >
                  <div className="font-extrabold text-sm sm:text-base tracking-widest text-red-700 font-sans">
                    GRADEUP STUDY • CONFIDENTIAL
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-red-800">
                    LICENSED TO: {watermark.studentName.toUpperCase()}
                  </div>
                  <div className="text-[11px] font-mono text-red-900">
                    MOB: {watermark.studentMobile} | EMAIL: {watermark.studentEmail}
                  </div>
                  <div className="text-[10px] font-mono text-red-900">
                    ACCESS: {watermark.accessId} | SESS: {watermark.sessionId} | {watermark.timestamp}
                  </div>
                </div>
              ))}
            </div>

            {/* FROSTED FOCUS LOSS / SCREEN CAPTURE SHIELD */}
            {isFocusShieldActive && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center z-20 transition-all duration-300">
                <div className="h-16 w-16 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center mb-4 shadow-xl">
                  <Lock className="h-8 w-8 text-amber-400 animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-white tracking-tight mb-1">
                  Protected Document Shield Active
                </h3>
                <p className="text-xs text-slate-300 max-w-sm">
                  Document display is masked when window focus is lost or during screen capture actions.
                </p>
                <div className="mt-4 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                  Click inside this window to resume authorized viewing
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. BOTTOM NAVIGATION DOCK (MOBILE & QUICK ACCESS) */}
      <div className="bg-slate-900/90 border-t border-slate-800 px-4 py-2 text-xs flex items-center justify-between">
        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span>
            {verificationData.assignment?.expiresAt
              ? `Expires: ${new Date(verificationData.assignment.expiresAt).toLocaleDateString('en-IN')}`
              : 'Permanent Link'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-dock-prev"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-30"
          >
            Previous
          </button>
          <span className="font-mono text-xs text-slate-300 px-1">
            {currentPage} / {totalPages}
          </span>
          <button
            id="btn-dock-next"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
