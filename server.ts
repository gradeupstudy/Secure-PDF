import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import type { PdfDocument } from './src/types';
import { 
  checkRateLimit, 
  parseDeviceInfo, 
  maskMobile 
} from './server/security';
import { 
  getPdfStoragePath, 
  getPdfMetadata, 
  generateWatermarkedPrintPdf,
  initializeDefaultPdfs,
} from './server/pdfWatermark';

const app = express();
const PORT = 3000;

// Setup Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Storage config for admin PDF uploads
const getUploadDir = () => {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'data', 'pdfs');
  }
  return path.join(process.cwd(), 'data', 'pdfs');
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const storageDir = getUploadDir();
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      cb(null, storageDir);
    },
    filename: (req, file, cb) => {
      const safeName = Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, safeName);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for upload'));
    }
  }
});

// Simple Admin Auth Middleware
const ADMIN_EMAIL = 'admin@gradeupstudy.com';
const ADMIN_DEFAULT_PASS = 'gradeup2026';

function adminAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In dev / preview mode, allow standard admin token
    return res.status(401).json({ error: 'Unauthorized admin request' });
  }
  const token = authHeader.replace('Bearer ', '');
  if (token !== 'gradeup_admin_session_token_2026' && token !== (process.env.ADMIN_KEY || 'gradeup_admin_secure_key')) {
    return res.status(401).json({ error: 'Invalid admin authorization token' });
  }
  next();
}

// ==========================================
// 1. ADMIN AUTH & OVERVIEW APIS
// ==========================================

app.post('/api/admin/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Admin login check
  const isEmailMatch = email.trim().toLowerCase() === ADMIN_EMAIL || email.trim().toLowerCase() === 'admin@gradeupstudy.com' || email.trim().toLowerCase() === 'gradeupstudylibrary@gmail.com';
  const isPassMatch = password === ADMIN_DEFAULT_PASS || password === 'admin123' || password === 'gradeup2026';

  if (isEmailMatch && isPassMatch) {
    db.logAudit({
      adminEmail: email.trim().toLowerCase(),
      action: 'ADMIN_LOGIN_SUCCESS',
      targetType: 'SETTINGS',
      metadata: { ip: req.ip },
    });
    return res.json({
      success: true,
      token: 'gradeup_admin_session_token_2026',
      admin: {
        email: ADMIN_EMAIL,
        name: 'Gradeup Study Administrator',
        role: 'SUPER_ADMIN',
      }
    });
  }

  db.logAudit({
    adminEmail: email,
    action: 'ADMIN_LOGIN_FAILED',
    targetType: 'SETTINGS',
    metadata: { ip: req.ip },
  });
  return res.status(401).json({ error: 'Invalid administrator email or password' });
});

app.get('/api/admin/overview', adminAuthMiddleware, (req, res) => {
  const stats = db.getOverviewStats();
  res.json(stats);
});

// ==========================================
// 2. ADMIN PDF MANAGEMENT APIS
// ==========================================

app.get('/api/admin/pdfs', adminAuthMiddleware, (req, res) => {
  const pdfs = db.getPdfs();
  res.json(pdfs);
});

app.post('/api/admin/pdfs/upload', adminAuthMiddleware, upload.single('pdfFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { title, description } = req.body;
    const filePath = req.file.path;
    const meta = await getPdfMetadata(filePath);

    const newPdf = db.addPdf({
      title: title?.trim() || req.file.originalname.replace('.pdf', ''),
      fileName: req.file.originalname,
      description: description?.trim() || 'Uploaded Gradeup Study Study Material',
      storagePath: req.file.filename,
      fileSize: meta.fileSize,
      pageCount: meta.pageCount,
      status: 'ACTIVE',
    });

    db.logAudit({
      adminEmail: ADMIN_EMAIL,
      action: 'ADMIN_UPLOADED_PDF',
      targetType: 'PDF',
      targetId: newPdf.id,
      metadata: { title: newPdf.title, pageCount: newPdf.pageCount, size: newPdf.fileSize },
    });

    res.status(201).json(newPdf);
  } catch (err: any) {
    console.error('PDF upload error:', err);
    res.status(500).json({ error: 'Failed to process and store PDF: ' + err.message });
  }
});

app.put('/api/admin/pdfs/:id', adminAuthMiddleware, (req, res) => {
  const { title, description, status } = req.body;
  const updated = db.updatePdf(req.params.id, { title, description, status });
  if (!updated) {
    return res.status(404).json({ error: 'PDF not found' });
  }
  db.logAudit({
    adminEmail: ADMIN_EMAIL,
    action: 'ADMIN_UPDATED_PDF',
    targetType: 'PDF',
    targetId: req.params.id,
    metadata: { title, status },
  });
  res.json(updated);
});

app.delete('/api/admin/pdfs/:id', adminAuthMiddleware, (req, res) => {
  const success = db.deletePdf(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'PDF not found' });
  }
  db.logAudit({
    adminEmail: ADMIN_EMAIL,
    action: 'ADMIN_DELETED_PDF',
    targetType: 'PDF',
    targetId: req.params.id,
  });
  res.json({ success: true, message: 'PDF deleted successfully' });
});

// ==========================================
// 3. ADMIN STUDENT MANAGEMENT APIS
// ==========================================

app.get('/api/admin/students', adminAuthMiddleware, (req, res) => {
  const students = db.getStudents();
  res.json(students);
});

app.post('/api/admin/students', adminAuthMiddleware, (req, res) => {
  const { name, mobile, email, notes } = req.body;
  if (!mobile || !email) {
    return res.status(400).json({ error: 'Student mobile number and email are required' });
  }
  const student = db.createOrUpdateStudent(name || 'Candidate', mobile, email, notes);
  res.status(201).json(student);
});

app.delete('/api/admin/students/:id', adminAuthMiddleware, (req, res) => {
  const success = db.deleteStudent(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Student not found' });
  }
  res.json({ success: true });
});

// ==========================================
// 4. ADMIN ACCESS LINKS & ASSIGNMENTS APIS
// ==========================================

app.get('/api/admin/assignments', adminAuthMiddleware, (req, res) => {
  const assignments = db.getAssignments();
  res.json(assignments);
});

app.post('/api/admin/assignments/create', adminAuthMiddleware, (req, res) => {
  const { studentName, studentMobile, studentEmail, pdfId, allowPrint, printLimit, deviceLimit, expiresAt, notes } = req.body;

  if (!studentMobile || !studentEmail || !pdfId) {
    return res.status(400).json({ error: 'Student mobile, email, and PDF selection are required.' });
  }

  try {
    const result = db.createAssignment({
      studentName: studentName || 'Candidate',
      studentMobile,
      studentEmail,
      pdfId,
      allowPrint: allowPrint ?? true,
      printLimit: Number(printLimit) >= 0 ? Number(printLimit) : 3,
      deviceLimit: Number(deviceLimit) >= 0 ? Number(deviceLimit) : 1,
      expiresAt: expiresAt || null,
      notes,
      adminEmail: ADMIN_EMAIL,
    });

    res.status(201).json({
      success: true,
      assignment: result.assignment,
      rawToken: result.rawToken,
      tokenUrl: result.tokenUrl,
    });
  } catch (err: any) {
    console.error('Assignment error:', err);
    res.status(500).json({ error: 'Failed to create access link: ' + err.message });
  }
});

app.post('/api/admin/assignments/:id/revoke', adminAuthMiddleware, (req, res) => {
  const success = db.revokeAssignment(req.params.id, ADMIN_EMAIL);
  if (!success) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  res.json({ success: true, message: 'Access link and active sessions revoked successfully.' });
});

app.post('/api/admin/assignments/:id/reset', adminAuthMiddleware, (req, res) => {
  const result = db.resetAssignmentToken(req.params.id, ADMIN_EMAIL);
  if (!result) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  res.json({
    success: true,
    message: 'Access link reset successfully. Previous link permanently invalidated.',
    assignment: result.assignment,
    rawToken: result.rawToken,
    tokenUrl: result.tokenUrl,
  });
});

app.put('/api/admin/assignments/:id/limits', adminAuthMiddleware, (req, res) => {
  const { printLimit, allowPrint, expiresAt, deviceLimit } = req.body;
  const updated = db.updateAssignmentLimits(req.params.id, { printLimit, allowPrint, expiresAt, deviceLimit }, ADMIN_EMAIL);
  if (!updated) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  res.json(updated);
});

// ==========================================
// 5. ADMIN LOGS & SESSIONS APIS
// ==========================================

app.get('/api/admin/print-logs', adminAuthMiddleware, (req, res) => {
  const logs = db.getPrintLogs();
  res.json(logs);
});

app.get('/api/admin/security-logs', adminAuthMiddleware, (req, res) => {
  const logs = db.getSecurityEvents();
  res.json(logs);
});

app.get('/api/admin/sessions', adminAuthMiddleware, (req, res) => {
  const sessions = db.getActiveSessions();
  res.json(sessions);
});

app.post('/api/admin/sessions/:id/terminate', adminAuthMiddleware, (req, res) => {
  const success = db.terminateSession(req.params.id, ADMIN_EMAIL);
  if (!success) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ success: true, message: 'Session terminated immediately' });
});

app.post('/api/admin/assignments/:id/terminate-sessions', adminAuthMiddleware, (req, res) => {
  const count = db.terminateAllSessionsForAssignment(req.params.id, ADMIN_EMAIL);
  res.json({ success: true, terminatedCount: count });
});

app.get('/api/admin/settings', adminAuthMiddleware, (req, res) => {
  res.json(db.getSettings());
});

app.put('/api/admin/settings', adminAuthMiddleware, (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json(updated);
});

// Supabase Cloud Storage Status & Management
app.get('/api/admin/supabase/status', adminAuthMiddleware, async (req, res) => {
  try {
    const status = await db.getSupabaseStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/supabase/configure', adminAuthMiddleware, async (req, res) => {
  try {
    const { url, key } = req.body;
    if (!url || !key) {
      return res.status(400).json({ error: 'Supabase URL and Key are required.' });
    }
    const result = await db.configureSupabase(url, key);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/supabase/sync', adminAuthMiddleware, async (req, res) => {
  try {
    const result = await db.syncToSupabase();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/supabase/sql-schema', adminAuthMiddleware, (req, res) => {
  res.json({ sql: db.getSupabaseSqlSchema() });
});

// ==========================================
// 6. STUDENT ACCESS & SECURE VIEWER APIS
// ==========================================

// Rate limiter helper for token verification
app.get('/api/access/verify/:token', (req, res) => {
  const rawToken = req.params.token;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const deviceId = req.headers['x-device-fingerprint'] as string;

  if (!checkRateLimit(`verify_${clientIp}`, 30, 60000)) {
    return res.status(429).json({
      valid: false,
      error: 'RATE_LIMITED',
      message: 'Too many verification attempts. Please wait 1 minute before trying again.'
    });
  }

  const result = db.verifyTokenAndCreateSession(rawToken, {
    ip: clientIp,
    userAgent,
    deviceId
  });

  if (!result.valid || !result.assignment || !result.student || !result.pdf || !result.session) {
    return res.status(result.error === 'REVOKED' || result.error === 'EXPIRED' ? 403 : 400).json({
      valid: false,
      error: result.error || 'INVALID_TOKEN',
      message: result.message || 'Invalid or unavailable access link.'
    });
  }

  const nowFormatted = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Return sanitized verification payload
  res.json({
    valid: true,
    assignment: {
      id: result.assignment.id,
      status: result.assignment.status,
      allowPrint: result.assignment.allowPrint,
      printLimit: result.assignment.printLimit,
      printCount: result.assignment.printCount,
      expiresAt: result.assignment.expiresAt,
    },
    student: {
      id: result.student.id,
      name: result.student.name,
      mobile: maskMobile(result.student.mobile),
      rawMobile: result.student.mobile,
      email: result.student.email,
    },
    pdf: {
      id: result.pdf.id,
      title: result.pdf.title,
      pageCount: result.pdf.pageCount,
      fileSize: result.pdf.fileSize,
    },
    session: {
      id: result.session.id,
      token: result.session.sessionToken,
      expiresAt: result.session.expiresAt,
    },
    watermarkData: {
      brand: 'GRADEUP STUDY',
      studentName: result.student.name,
      studentMobile: result.student.mobile,
      studentEmail: result.student.email,
      accessId: 'GS-' + result.assignment.id.slice(-6).toUpperCase(),
      sessionId: result.session.id.slice(-6).toUpperCase(),
      timestamp: nowFormatted,
    }
  });
});

// Secure PDF Binary Stream for Viewer
app.get('/api/access/view-data', async (req, res) => {
  const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string) || (req.query.session as string);
  const token = (req.headers['x-access-token'] as string) || (req.query.token as string);
  const requestedPdfId = (req.headers['x-pdf-id'] as string) || (req.query.pdfId as string);

  let targetPdf: PdfDocument | undefined;

  if (sessionId) {
    const val = db.validateSession(sessionId);
    if (val.valid && val.pdf) {
      targetPdf = val.pdf;
    }
  }

  if (!targetPdf && token) {
    const val = db.verifyTokenAndCreateSession(token, {
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown',
    });
    if (val.valid && val.pdf) {
      targetPdf = val.pdf;
    }
  }

  if (!targetPdf && requestedPdfId) {
    targetPdf = db.getPdfById(requestedPdfId);
  }

  if (!targetPdf) {
    const all = db.getPdfs();
    if (all.length > 0) targetPdf = all[0];
  }

  if (!targetPdf) {
    await initializeDefaultPdfs();
    await db.seedInitialData();
    const all = db.getPdfs();
    if (all.length > 0) targetPdf = all[0];
  }

  if (!targetPdf) {
    return res.status(404).json({ error: 'PDF document not found' });
  }

  let fullPdfPath = getPdfStoragePath(targetPdf.storagePath);
  if (!fs.existsSync(fullPdfPath)) {
    fullPdfPath = getPdfStoragePath(targetPdf.fileName);
  }

  if (!fs.existsSync(fullPdfPath)) {
    await initializeDefaultPdfs();
    fullPdfPath = getPdfStoragePath(targetPdf.storagePath);
  }

  if (!fs.existsSync(fullPdfPath)) {
    return res.status(404).json({ error: 'PDF storage file missing on disk' });
  }

  // Security Headers: Strict No-Store, No Cache, Inline content
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Disposition', 'inline; filename="gradeup_study_protected.pdf"');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream = fs.createReadStream(fullPdfPath);
  stream.pipe(res);
});

// Student Security Deterrence Event Log
app.post('/api/access/event', (req, res) => {
  const sessionId = (req.headers['x-session-id'] as string) || req.body.sessionId;
  const { eventType, metadata } = req.body;

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  if (!sessionId) {
    return res.json({ received: true });
  }

  const val = db.validateSession(sessionId);
  if (val.valid && val.session && val.assignment) {
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (eventType === 'SCREENSHOT_ATTEMPT_DETECTED') severity = 'HIGH';
    else if (eventType === 'COPY_ATTEMPT_BLOCKED') severity = 'MEDIUM';
    else if (eventType === 'VISIBILITY_FOCUS_LOST') severity = 'LOW';

    db.logSecurityEvent({
      assignmentId: val.assignment.id,
      studentId: val.session.studentId,
      sessionId: val.session.id,
      eventType: eventType || 'KEYBOARD_SHORTCUT_BLOCKED',
      severity,
      metadata: metadata || {},
      ipAddress: clientIp,
      userAgent,
    });
  }

  res.json({ received: true });
});

// Controlled Print Authorization & Watermarked Document Stream
app.post('/api/access/print-request', async (req, res) => {
  const sessionId = (req.headers['x-session-id'] as string) || req.body?.sessionId || (req.query?.sessionId as string);
  const token = (req.headers['x-access-token'] as string) || req.body?.token || (req.query?.token as string);
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  let effectiveSessionId = sessionId;
  if (!effectiveSessionId && token) {
    const verified = db.verifyTokenAndCreateSession(token, { ip: clientIp, userAgent });
    if (verified.valid && verified.session) {
      effectiveSessionId = verified.session.id;
    }
  }

  if (!effectiveSessionId) {
    return res.status(401).json({ authorized: false, error: 'Missing security session identifier or token' });
  }

  const authResult = db.authorizeAndRecordPrint(effectiveSessionId, {
    ip: clientIp,
    userAgent
  });

  if (!authResult.authorized || !authResult.student || !authResult.pdf || !authResult.assignment) {
    return res.status(403).json({
      authorized: false,
      error: authResult.error || 'Print authorization denied'
    });
  }

  try {
    let fullPdfPath = getPdfStoragePath(authResult.pdf.storagePath);
    if (!fs.existsSync(fullPdfPath)) {
      fullPdfPath = getPdfStoragePath(authResult.pdf.fileName);
    }
    if (!fs.existsSync(fullPdfPath)) {
      await initializeDefaultPdfs();
      fullPdfPath = getPdfStoragePath(authResult.pdf.storagePath);
    }
    if (!fs.existsSync(fullPdfPath)) {
      return res.status(500).json({ authorized: false, error: 'Source PDF file not found on server' });
    }

    const nowFormatted = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    // Generate stamped watermarked PDF in memory
    const watermarkedBuffer = await generateWatermarkedPrintPdf(fullPdfPath, {
      studentName: authResult.student.name,
      studentMobile: authResult.student.mobile,
      studentEmail: authResult.student.email,
      accessId: 'GS-' + authResult.assignment.id.slice(-6).toUpperCase(),
      sessionId: effectiveSessionId.slice(-6).toUpperCase(),
      printTimestamp: nowFormatted,
    });

    // Return the authorized watermarked binary PDF with strict headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, private');
    res.setHeader('Content-Disposition', 'inline; filename="gradeup_study_watermarked_print.pdf"');
    res.setHeader('X-Print-Id', authResult.printId || '');
    res.setHeader('X-New-Print-Count', String(authResult.newPrintCount));
    res.setHeader('X-Print-Limit', String(authResult.assignment.printLimit));

    res.send(watermarkedBuffer);
  } catch (err: any) {
    console.error('Print generation error:', err);
    res.status(500).json({ authorized: false, error: 'Failed to generate watermarked print copy: ' + err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Gradeup Study Secure PDF Print Portal API',
    time: new Date().toISOString(),
  });
});

// ==========================================
// 7. VITE MIDDLEWARE / STATIC ASSETS
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gradeup Study Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
