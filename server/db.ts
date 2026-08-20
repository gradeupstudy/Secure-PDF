import fs from 'fs';
import path from 'path';
import { 
  Student, 
  PdfDocument, 
  Assignment, 
  AccessToken, 
  SessionRecord, 
  PrintLog, 
  SecurityEvent, 
  AuditLog, 
  OverviewStats,
  LinkStatus
} from '../src/types';
import { 
  generateSecureAccessToken, 
  hashToken, 
  normalizeMobile, 
  normalizeEmail,
  generateSessionToken 
} from './security';
import { ensureStorageDir, initializeDefaultPdfs, getPdfMetadata, getPdfStoragePath } from './pdfWatermark';
import { 
  checkSupabaseConnection, 
  pushAllToSupabase, 
  pullAllFromSupabase, 
  setSupabaseRuntimeConfig,
  SUPABASE_SQL_SCHEMA 
} from './supabase';

const DB_FILE = path.join(process.cwd(), 'data', 'portal_db.json');

interface DatabaseSchema {
  students: Student[];
  pdfs: PdfDocument[];
  assignments: Assignment[];
  tokens: AccessToken[];
  sessions: SessionRecord[];
  printLogs: PrintLog[];
  securityEvents: SecurityEvent[];
  auditLogs: AuditLog[];
  settings: {
    brandName: string;
    supportEmail: string;
    supportPhone: string;
    allowWatermarkMicroshift: boolean;
    defaultPrintLimit: number;
    maxSessionDurationMinutes: number;
    requireFocusShield: boolean;
  };
}

class Database {
  private data: DatabaseSchema = {
    students: [],
    pdfs: [],
    assignments: [],
    tokens: [],
    sessions: [],
    printLogs: [],
    securityEvents: [],
    auditLogs: [],
    settings: {
      brandName: 'Gradeup Study',
      supportEmail: 'support@gradeupstudy.com',
      supportPhone: '+91 98160 12345',
      allowWatermarkMicroshift: true,
      defaultPrintLimit: 3,
      maxSessionDurationMinutes: 120,
      requireFocusShield: true,
    }
  };

  constructor() {
    this.init();
  }

  private async init() {
    ensureStorageDir();
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading db file, seeding fresh:', err);
        await this.seedInitialData();
      }
    } else {
      await this.seedInitialData();
    }

    // Try pulling from Supabase if connected
    this.tryPullFromSupabase();
  }

  private async tryPullFromSupabase() {
    try {
      const cloudData = await pullAllFromSupabase();
      if (cloudData && cloudData.students && cloudData.students.length > 0) {
        console.log(`[Supabase] Loaded ${cloudData.students.length} students & ${cloudData.pdfs?.length || 0} PDFs from cloud database.`);
        this.data = {
          ...this.data,
          ...cloudData,
          settings: cloudData.settings || this.data.settings,
        };
        // Also persist to local cache
        fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('[Supabase] Could not pull from cloud on startup:', err);
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving DB:', err);
    }

    // Asynchronously push to Supabase if configured
    this.pushToSupabaseAsync();
  }

  private async pushToSupabaseAsync() {
    try {
      const conn = await checkSupabaseConnection();
      if (conn.configured && conn.connected && conn.tablesReady !== false) {
        await pushAllToSupabase(this.data);
      }
    } catch (err) {
      // Background sync silently logs without blocking
    }
  }

  public async seedInitialData() {
    await initializeDefaultPdfs();

    const now = new Date().toISOString();
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

    // 1. Initial PDFs
    const pdf1Path = getPdfStoragePath('hp_police_constable_mock_set_01.pdf');
    const pdf2Path = getPdfStoragePath('hp_patwari_quantitative_aptitude_2026.pdf');
    const pdf3Path = getPdfStoragePath('gradeup_study_hp_gk_special_capsule.pdf');

    const meta1 = fs.existsSync(pdf1Path) ? await getPdfMetadata(pdf1Path) : { pageCount: 4, fileSize: 152000 };
    const meta2 = fs.existsSync(pdf2Path) ? await getPdfMetadata(pdf2Path) : { pageCount: 3, fileSize: 124000 };
    const meta3 = fs.existsSync(pdf3Path) ? await getPdfMetadata(pdf3Path) : { pageCount: 3, fileSize: 118000 };

    this.data.pdfs = [
      {
        id: 'pdf_hp_police_01',
        title: 'HP Police Constable Practice Set 01 - Full Mock Test',
        fileName: 'hp_police_constable_mock_set_01.pdf',
        description: 'Official Gradeup Study Mock Examination with 80 Questions with complete solutions.',
        storagePath: 'hp_police_constable_mock_set_01.pdf',
        fileSize: meta1.fileSize,
        pageCount: meta1.pageCount,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pdf_hp_patwari_02',
        title: 'HP Patwari Quantitative Aptitude & Arithmetic Booster 2026',
        fileName: 'hp_patwari_quantitative_aptitude_2026.pdf',
        description: 'High-yield problem solving module with step-by-step solutions.',
        storagePath: 'hp_patwari_quantitative_aptitude_2026.pdf',
        fileSize: meta2.fileSize,
        pageCount: meta2.pageCount,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pdf_hp_gk_03',
        title: 'Gradeup Study Himachal Pradesh GK Special Capsule 2026',
        fileName: 'gradeup_study_hp_gk_special_capsule.pdf',
        description: 'Complete Himachal Pradesh History, Geography, and Culture revision notes.',
        storagePath: 'gradeup_study_hp_gk_special_capsule.pdf',
        fileSize: meta3.fileSize,
        pageCount: meta3.pageCount,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      }
    ];

    // 2. Initial Students
    this.data.students = [
      {
        id: 'std_rahul_kumar',
        name: 'Rahul Kumar',
        mobile: '+919816123456',
        email: 'rahul.kumar@example.com',
        status: 'ACTIVE',
        notes: 'Targeting HP Police Constable 2026 Exam (Shimla Batch)',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'std_priya_sharma',
        name: 'Priya Sharma',
        mobile: '+919805987654',
        email: 'priya.sharma@example.com',
        status: 'ACTIVE',
        notes: 'Patwari Preparation (Mandi Center)',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'std_amit_thakur',
        name: 'Amit Thakur',
        mobile: '+919418554321',
        email: 'amit.thakur@example.com',
        status: 'ACTIVE',
        notes: 'General Studies Test Series',
        createdAt: now,
        updatedAt: now,
      }
    ];

    // 3. Initial Assignments & Access Tokens
    this.data.assignments = [];
    this.data.tokens = [];

    // Assignment 1 for Rahul
    const { rawToken: token1, tokenHash: hash1 } = generateSecureAccessToken();
    const assign1: Assignment = {
      id: 'asg_demo_01',
      studentId: 'std_rahul_kumar',
      pdfId: 'pdf_hp_police_01',
      status: 'ACTIVE',
      allowPrint: true,
      printLimit: 3,
      printCount: 1,
      deviceLimit: 1,
      expiresAt: expiryDate,
      notes: 'Initial practice test assignment',
      createdAt: now,
      updatedAt: now,
      currentAccessToken: token1,
      accessTokenHash: hash1,
    };
    this.data.assignments.push(assign1);
    this.data.tokens.push({
      id: 'tok_01',
      assignmentId: assign1.id,
      tokenHash: hash1,
      rawToken: token1,
      status: 'ACTIVE',
      createdAt: now,
      expiresAt: expiryDate,
      revokedAt: null,
      lastUsedAt: now,
    });

    // Assignment 2 for Priya
    const { rawToken: token2, tokenHash: hash2 } = generateSecureAccessToken();
    const assign2: Assignment = {
      id: 'asg_demo_02',
      studentId: 'std_priya_sharma',
      pdfId: 'pdf_hp_patwari_02',
      status: 'ACTIVE',
      allowPrint: true,
      printLimit: 2,
      printCount: 0,
      deviceLimit: 2,
      expiresAt: expiryDate,
      notes: 'Quantitative module',
      createdAt: now,
      updatedAt: now,
      currentAccessToken: token2,
      accessTokenHash: hash2,
    };
    this.data.assignments.push(assign2);
    this.data.tokens.push({
      id: 'tok_02',
      assignmentId: assign2.id,
      tokenHash: hash2,
      rawToken: token2,
      status: 'ACTIVE',
      createdAt: now,
      expiresAt: expiryDate,
      revokedAt: null,
      lastUsedAt: null,
    });

    // 4. Initial Sample Print Logs
    this.data.printLogs = [
      {
        id: 'prnt_init_01',
        assignmentId: 'asg_demo_01',
        studentId: 'std_rahul_kumar',
        pdfId: 'pdf_hp_police_01',
        sessionId: 'sess_init_rahul',
        attemptNumber: 1,
        status: 'SUCCESS',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        ipAddress: '103.21.124.89',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
        pageCount: 4,
      }
    ];

    // 5. Initial Security Events
    this.data.securityEvents = [
      {
        id: 'sec_init_01',
        assignmentId: 'asg_demo_01',
        studentId: 'std_rahul_kumar',
        sessionId: 'sess_init_rahul',
        eventType: 'LINK_OPENED',
        severity: 'LOW',
        metadata: { browser: 'Chrome', os: 'Windows' },
        ipAddress: '103.21.124.89',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: new Date(Date.now() - 4000000).toISOString(),
      },
      {
        id: 'sec_init_02',
        assignmentId: 'asg_demo_01',
        studentId: 'std_rahul_kumar',
        sessionId: 'sess_init_rahul',
        eventType: 'VISIBILITY_FOCUS_LOST',
        severity: 'LOW',
        metadata: { reason: 'User switched application window' },
        ipAddress: '103.21.124.89',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: new Date(Date.now() - 3700000).toISOString(),
      }
    ];

    // 6. Initial Audit Logs
    this.data.auditLogs = [
      {
        id: 'aud_init_01',
        adminEmail: 'admin@gradeupstudy.com',
        action: 'ADMIN_CREATED_ASSIGNMENT',
        targetType: 'ASSIGNMENT',
        targetId: 'asg_demo_01',
        metadata: { student: 'Rahul Kumar', pdf: 'HP Police Constable Practice Set 01', printLimit: 3 },
        createdAt: now,
      }
    ];

    this.save();
  }

  // --- Students CRUD ---
  public getStudents(): Student[] {
    return [...this.data.students].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getStudentById(id: string): Student | undefined {
    return this.data.students.find(s => s.id === id);
  }

  public findStudentByMobileOrEmail(mobile: string, email: string): Student | undefined {
    const normMob = normalizeMobile(mobile);
    const normEmail = normalizeEmail(email);
    return this.data.students.find(s => normalizeMobile(s.mobile) === normMob || normalizeEmail(s.email) === normEmail);
  }

  public createOrUpdateStudent(name: string, mobile: string, email: string, notes?: string): Student {
    const normMob = normalizeMobile(mobile);
    const normEmail = normalizeEmail(email);
    const now = new Date().toISOString();

    let student = this.data.students.find(
      s => normalizeMobile(s.mobile) === normMob || normalizeEmail(s.email) === normEmail
    );

    if (student) {
      student.name = name.trim() || student.name;
      student.mobile = normMob;
      student.email = normEmail;
      if (notes !== undefined) student.notes = notes;
      student.updatedAt = now;
    } else {
      student = {
        id: 'std_' + Math.random().toString(36).substring(2, 9),
        name: name.trim() || 'Candidate',
        mobile: normMob,
        email: normEmail,
        status: 'ACTIVE',
        notes: notes || '',
        createdAt: now,
        updatedAt: now,
      };
      this.data.students.push(student);
    }
    this.save();
    return student;
  }

  public deleteStudent(id: string): boolean {
    const idx = this.data.students.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.data.students.splice(idx, 1);
      // Also revoke assignments for this student
      this.data.assignments.forEach(a => {
        if (a.studentId === id) {
          a.status = 'REVOKED';
        }
      });
      this.save();
      return true;
    }
    return false;
  }

  // --- PDFs CRUD ---
  public getPdfs(): PdfDocument[] {
    return [...this.data.pdfs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getPdfById(id: string): PdfDocument | undefined {
    return this.data.pdfs.find(p => p.id === id);
  }

  public addPdf(pdf: Omit<PdfDocument, 'id' | 'createdAt' | 'updatedAt'>): PdfDocument {
    const now = new Date().toISOString();
    const newPdf: PdfDocument = {
      ...pdf,
      id: 'pdf_' + Math.random().toString(36).substring(2, 9),
      createdAt: now,
      updatedAt: now,
    };
    this.data.pdfs.push(newPdf);
    this.save();
    return newPdf;
  }

  public updatePdf(id: string, updates: Partial<PdfDocument>): PdfDocument | null {
    const pdf = this.data.pdfs.find(p => p.id === id);
    if (!pdf) return null;
    Object.assign(pdf, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return pdf;
  }

  public deletePdf(id: string): boolean {
    const idx = this.data.pdfs.findIndex(p => 
      p.id === id || 
      p.storagePath === id || 
      p.fileName === id ||
      p.id.replace(/_/g, '-') === id.replace(/_/g, '-')
    );
    if (idx !== -1) {
      const pdf = this.data.pdfs[idx];
      // delete storage file
      try {
        const fullPath = getPdfStoragePath(pdf.storagePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (err) {
        console.error('Error removing pdf storage:', err);
      }
      this.data.pdfs.splice(idx, 1);
      // Revoke related assignments
      this.data.assignments.forEach(a => {
        if (a.pdfId === id || a.pdfId === pdf.id) {
          a.status = 'REVOKED';
        }
      });
      this.save();
      return true;
    }
    return true;
  }

  // --- Assignments & Access Links ---
  public getAssignments(): Assignment[] {
    const assignments = [...this.data.assignments].map(a => {
      const student = this.getStudentById(a.studentId);
      const pdf = this.getPdfById(a.pdfId);
      return {
        ...a,
        student,
        pdf,
      };
    });
    return assignments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getAssignmentById(id: string): Assignment | undefined {
    const a = this.data.assignments.find(x => x.id === id);
    if (!a) return undefined;
    return {
      ...a,
      student: this.getStudentById(a.studentId),
      pdf: this.getPdfById(a.pdfId),
    };
  }

  public createAssignment(params: {
    studentName: string;
    studentMobile: string;
    studentEmail: string;
    pdfId: string;
    allowPrint: boolean;
    printLimit: number;
    deviceLimit?: number;
    expiresAt: string | null;
    notes?: string;
    adminEmail?: string;
  }): { assignment: Assignment; rawToken: string; tokenUrl: string } {
    const student = this.createOrUpdateStudent(
      params.studentName,
      params.studentMobile,
      params.studentEmail,
      params.notes
    );

    const now = new Date().toISOString();
    const { rawToken, tokenHash } = generateSecureAccessToken();

    const assignmentId = 'asg_' + Math.random().toString(36).substring(2, 9);
    const assignment: Assignment = {
      id: assignmentId,
      studentId: student.id,
      pdfId: params.pdfId,
      status: 'ACTIVE',
      allowPrint: params.allowPrint,
      printLimit: params.printLimit ?? 3,
      printCount: 0,
      deviceLimit: params.deviceLimit ?? 1,
      expiresAt: params.expiresAt,
      notes: params.notes,
      createdAt: now,
      updatedAt: now,
      currentAccessToken: rawToken,
      accessTokenHash: tokenHash,
    };

    this.data.assignments.push(assignment);

    const tokenRecord: AccessToken = {
      id: 'tok_' + Math.random().toString(36).substring(2, 9),
      assignmentId: assignment.id,
      tokenHash,
      rawToken,
      status: 'ACTIVE',
      createdAt: now,
      expiresAt: params.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    };
    this.data.tokens.push(tokenRecord);

    // Audit log
    this.logAudit({
      adminEmail: params.adminEmail || 'admin@gradeupstudy.com',
      action: 'ADMIN_CREATED_ASSIGNMENT',
      targetType: 'ASSIGNMENT',
      targetId: assignment.id,
      metadata: {
        student: student.name,
        mobile: student.mobile,
        pdfId: params.pdfId,
        printLimit: params.printLimit,
        expiresAt: params.expiresAt,
      }
    });

    this.save();

    const tokenUrl = `/access/${rawToken}`;
    return {
      assignment: {
        ...assignment,
        student,
        pdf: this.getPdfById(params.pdfId),
      },
      rawToken,
      tokenUrl,
    };
  }

  public revokeAssignment(assignmentId: string, adminEmail: string = 'admin@gradeupstudy.com'): boolean {
    const assignment = this.data.assignments.find(a => a.id === assignmentId);
    if (!assignment) return false;

    const now = new Date().toISOString();
    assignment.status = 'REVOKED';
    assignment.updatedAt = now;

    // Revoke all tokens for this assignment
    this.data.tokens.forEach(t => {
      if (t.assignmentId === assignmentId) {
        t.status = 'REVOKED';
        t.revokedAt = now;
      }
    });

    // Invalidate all active sessions for this assignment immediately
    this.data.sessions.forEach(s => {
      if (s.assignmentId === assignmentId && s.status === 'ACTIVE') {
        s.status = 'TERMINATED';
      }
    });

    this.logAudit({
      adminEmail,
      action: 'ADMIN_REVOKED_LINK',
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      metadata: { previousStatus: 'ACTIVE', revokedAt: now }
    });

    this.logSecurityEvent({
      assignmentId,
      studentId: assignment.studentId,
      eventType: 'LINK_REVOKED',
      severity: 'HIGH',
      metadata: { revokedBy: adminEmail },
      ipAddress: 'server',
      userAgent: 'Admin-Action',
    });

    this.save();
    return true;
  }

  public resetAssignmentToken(assignmentId: string, adminEmail: string = 'admin@gradeupstudy.com'): { assignment: Assignment; rawToken: string; tokenUrl: string } | null {
    const assignment = this.data.assignments.find(a => a.id === assignmentId);
    if (!assignment) return null;

    const now = new Date().toISOString();

    // 1. Revoke existing tokens
    this.data.tokens.forEach(t => {
      if (t.assignmentId === assignmentId && t.status === 'ACTIVE') {
        t.status = 'REVOKED';
        t.revokedAt = now;
      }
    });

    // 2. Invalidate active sessions associated with the old token
    this.data.sessions.forEach(s => {
      if (s.assignmentId === assignmentId && s.status === 'ACTIVE') {
        s.status = 'TERMINATED';
      }
    });

    // 3. Generate brand new 256-bit cryptographic token
    const { rawToken, tokenHash } = generateSecureAccessToken();
    assignment.status = 'ACTIVE';
    assignment.updatedAt = now;
    assignment.currentAccessToken = rawToken;
    assignment.accessTokenHash = tokenHash;

    const newToken: AccessToken = {
      id: 'tok_' + Math.random().toString(36).substring(2, 9),
      assignmentId: assignment.id,
      tokenHash,
      rawToken,
      status: 'ACTIVE',
      createdAt: now,
      expiresAt: assignment.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    };
    this.data.tokens.push(newToken);

    this.logAudit({
      adminEmail,
      action: 'ADMIN_RESET_LINK',
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      metadata: { resetAt: now }
    });

    this.logSecurityEvent({
      assignmentId,
      studentId: assignment.studentId,
      eventType: 'LINK_RESET',
      severity: 'MEDIUM',
      metadata: { resetBy: adminEmail, oldSessionsTerminated: true },
      ipAddress: 'server',
      userAgent: 'Admin-Action',
    });

    this.save();

    return {
      assignment: {
        ...assignment,
        student: this.getStudentById(assignment.studentId),
        pdf: this.getPdfById(assignment.pdfId),
      },
      rawToken,
      tokenUrl: `/access/${rawToken}`,
    };
  }

  public updateAssignmentLimits(
    assignmentId: string, 
    updates: { printLimit?: number; allowPrint?: boolean; expiresAt?: string | null; deviceLimit?: number },
    adminEmail: string = 'admin@gradeupstudy.com'
  ): Assignment | null {
    const assignment = this.data.assignments.find(a => a.id === assignmentId);
    if (!assignment) return null;

    if (updates.printLimit !== undefined) assignment.printLimit = updates.printLimit;
    if (updates.allowPrint !== undefined) assignment.allowPrint = updates.allowPrint;
    if (updates.expiresAt !== undefined) assignment.expiresAt = updates.expiresAt;
    if (updates.deviceLimit !== undefined) assignment.deviceLimit = updates.deviceLimit;
    assignment.updatedAt = new Date().toISOString();

    this.logAudit({
      adminEmail,
      action: 'ADMIN_CHANGED_LIMITS',
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      metadata: updates
    });

    this.save();
    return this.getAssignmentById(assignmentId) || null;
  }

  // --- Token Verification & Session Creation for Student ---
  public verifyTokenAndCreateSession(
    rawToken: string, 
    clientInfo: { ip: string; userAgent: string; deviceId?: string }
  ): { 
    valid: boolean; 
    error?: 'INVALID_TOKEN' | 'REVOKED' | 'EXPIRED' | 'PDF_DISABLED' | 'SESSION_TERMINATED' | 'DEVICE_LIMIT_EXCEEDED';
    message?: string;
    assignment?: Assignment;
    student?: Student;
    pdf?: PdfDocument;
    session?: SessionRecord & { sessionToken: string };
  } {
    const tokenHash = hashToken(rawToken);
    const tokenRecord = this.data.tokens.find(t => t.tokenHash === tokenHash);

    if (!tokenRecord) {
      return { valid: false, error: 'INVALID_TOKEN', message: 'Invalid or unavailable access link.' };
    }

    if (tokenRecord.status === 'REVOKED') {
      return { valid: false, error: 'REVOKED', message: 'This access link has been revoked by Gradeup Study.' };
    }

    const now = new Date();
    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < now) {
      return { valid: false, error: 'EXPIRED', message: 'This access link has expired.' };
    }

    const assignment = this.data.assignments.find(a => a.id === tokenRecord.assignmentId);
    if (!assignment) {
      return { valid: false, error: 'INVALID_TOKEN', message: 'Access assignment not found.' };
    }

    if (assignment.status === 'REVOKED') {
      return { valid: false, error: 'REVOKED', message: 'This access link has been revoked by Gradeup Study.' };
    }

    if (assignment.expiresAt && new Date(assignment.expiresAt) < now) {
      return { valid: false, error: 'EXPIRED', message: 'This access link has expired.' };
    }

    const student = this.getStudentById(assignment.studentId);
    const pdf = this.getPdfById(assignment.pdfId);

    if (!student) {
      return { valid: false, error: 'INVALID_TOKEN', message: 'Student record not found.' };
    }

    if (!pdf || pdf.status !== 'ACTIVE') {
      return { valid: false, error: 'PDF_DISABLED', message: 'This PDF document is currently disabled or unavailable.' };
    }

    // Check device limit & active sessions
    const activeSessionsForAssignment = this.data.sessions.filter(
      s => s.assignmentId === assignment.id && s.status === 'ACTIVE' && new Date(s.expiresAt) > now
    );

    const deviceIdentifier = clientInfo.deviceId || hashToken(clientInfo.ip + clientInfo.userAgent).slice(0, 16);
    const existingDeviceSession = activeSessionsForAssignment.find(s => s.deviceIdentifier === deviceIdentifier);

    if (!existingDeviceSession && assignment.deviceLimit > 0 && activeSessionsForAssignment.length >= assignment.deviceLimit) {
      this.logSecurityEvent({
        assignmentId: assignment.id,
        studentId: student.id,
        eventType: 'NEW_DEVICE_DETECTED',
        severity: 'HIGH',
        metadata: {
          activeDevices: activeSessionsForAssignment.length,
          deviceLimit: assignment.deviceLimit,
          attemptedDevice: deviceIdentifier,
        },
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      });

      return {
        valid: false,
        error: 'DEVICE_LIMIT_EXCEEDED',
        message: `Maximum allowed active devices (${assignment.deviceLimit}) reached for this access link.`
      };
    }

    // Update token last used
    tokenRecord.lastUsedAt = now.toISOString();

    // Create new protected session
    const { rawToken: rawSessionToken, tokenHash: sessionHash } = generateSessionToken();
    const sessionExpiresAt = new Date(Date.now() + this.data.settings.maxSessionDurationMinutes * 60 * 1000).toISOString();

    const { browser, os } = clientInfo.userAgent ? { browser: 'Browser', os: 'OS' } : { browser: 'Unknown', os: 'Unknown' };

    const newSession: SessionRecord = {
      id: 'sess_' + Math.random().toString(36).substring(2, 9),
      assignmentId: assignment.id,
      tokenId: tokenRecord.id,
      studentId: student.id,
      deviceIdentifier,
      browser,
      os,
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      status: 'ACTIVE',
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt: sessionExpiresAt,
    };

    this.data.sessions.push(newSession);

    this.logSecurityEvent({
      assignmentId: assignment.id,
      studentId: student.id,
      sessionId: newSession.id,
      eventType: 'LINK_OPENED',
      severity: 'LOW',
      metadata: { pdfTitle: pdf.title, deviceIdentifier },
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    });

    this.save();

    return {
      valid: true,
      assignment,
      student,
      pdf,
      session: {
        ...newSession,
        sessionToken: rawSessionToken,
      }
    };
  }

  // --- Session Validation ---
  public validateSession(sessionId: string): { valid: boolean; session?: SessionRecord; assignment?: Assignment; student?: Student; pdf?: PdfDocument } {
    const session = this.data.sessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'ACTIVE') {
      return { valid: false };
    }

    const now = new Date();
    if (new Date(session.expiresAt) < now) {
      session.status = 'EXPIRED';
      this.save();
      return { valid: false };
    }

    const assignment = this.data.assignments.find(a => a.id === session.assignmentId);
    if (!assignment || assignment.status !== 'ACTIVE') {
      return { valid: false };
    }

    if (assignment.expiresAt && new Date(assignment.expiresAt) < now) {
      return { valid: false };
    }

    const student = this.getStudentById(session.studentId);
    const pdf = this.getPdfById(assignment.pdfId);

    if (!student || !pdf || pdf.status !== 'ACTIVE') {
      return { valid: false };
    }

    // Refresh last activity
    session.lastActivityAt = now.toISOString();
    this.save();

    return { valid: true, session, assignment, student, pdf };
  }

  public terminateSession(sessionId: string, adminEmail: string = 'admin@gradeupstudy.com'): boolean {
    const session = this.data.sessions.find(s => s.id === sessionId);
    if (!session) return false;

    session.status = 'TERMINATED';
    this.logAudit({
      adminEmail,
      action: 'ADMIN_TERMINATED_SESSION',
      targetType: 'SESSION',
      targetId: sessionId,
    });

    this.logSecurityEvent({
      sessionId,
      assignmentId: session.assignmentId,
      studentId: session.studentId,
      eventType: 'SESSION_TERMINATED',
      severity: 'MEDIUM',
      metadata: { terminatedBy: adminEmail },
      ipAddress: 'server',
      userAgent: 'Admin-Action',
    });

    this.save();
    return true;
  }

  public terminateAllSessionsForAssignment(assignmentId: string, adminEmail: string = 'admin@gradeupstudy.com'): number {
    let count = 0;
    this.data.sessions.forEach(s => {
      if (s.assignmentId === assignmentId && s.status === 'ACTIVE') {
        s.status = 'TERMINATED';
        count++;
      }
    });

    if (count > 0) {
      this.logAudit({
        adminEmail,
        action: 'ADMIN_TERMINATED_ALL_SESSIONS',
        targetType: 'ASSIGNMENT',
        targetId: assignmentId,
        metadata: { terminatedCount: count }
      });
      this.save();
    }
    return count;
  }

  // --- Print Authorization & Transactional Counter ---
  public authorizeAndRecordPrint(
    sessionId: string, 
    clientInfo: { ip: string; userAgent: string }
  ): { 
    authorized: boolean; 
    error?: string; 
    printId?: string; 
    assignment?: Assignment; 
    student?: Student; 
    pdf?: PdfDocument;
    newPrintCount?: number;
  } {
    const val = this.validateSession(sessionId);
    if (!val.valid || !val.session || !val.assignment || !val.student || !val.pdf) {
      this.recordPrintLog({
        assignmentId: val.assignment?.id || 'unknown',
        studentId: val.student?.id || 'unknown',
        pdfId: val.pdf?.id || 'unknown',
        sessionId,
        attemptNumber: 0,
        status: 'DENIED',
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        reason: 'Invalid or terminated session'
      });
      return { authorized: false, error: 'Session is invalid or expired. Please re-open your link.' };
    }

    const { assignment, student, pdf } = val;

    if (!assignment.allowPrint) {
      this.recordPrintLog({
        assignmentId: assignment.id,
        studentId: student.id,
        pdfId: pdf.id,
        sessionId,
        attemptNumber: assignment.printCount + 1,
        status: 'DENIED',
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        reason: 'Printing has been disabled for this document'
      });
      return { authorized: false, error: 'Printing has been disabled for this document by Gradeup Study.' };
    }

    if (assignment.printLimit > 0 && assignment.printCount >= assignment.printLimit) {
      this.recordPrintLog({
        assignmentId: assignment.id,
        studentId: student.id,
        pdfId: pdf.id,
        sessionId,
        attemptNumber: assignment.printCount + 1,
        status: 'LIMIT_REACHED',
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        reason: `Print limit reached (${assignment.printCount}/${assignment.printLimit})`
      });
      return { authorized: false, error: `Your allowed print limit has been reached (${assignment.printCount}/${assignment.printLimit} used).` };
    }

    // Atomic increment
    assignment.printCount += 1;
    assignment.updatedAt = new Date().toISOString();

    const printId = 'prnt_' + Math.random().toString(36).substring(2, 9);
    this.recordPrintLog({
      id: printId,
      assignmentId: assignment.id,
      studentId: student.id,
      pdfId: pdf.id,
      sessionId,
      attemptNumber: assignment.printCount,
      status: 'SUCCESS',
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      pageCount: pdf.pageCount,
    });

    this.logSecurityEvent({
      assignmentId: assignment.id,
      studentId: student.id,
      sessionId,
      eventType: 'PRINT_SUCCESSFUL',
      severity: 'LOW',
      metadata: { printAttempt: assignment.printCount, printLimit: assignment.printLimit },
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    });

    this.save();

    return {
      authorized: true,
      printId,
      assignment,
      student,
      pdf,
      newPrintCount: assignment.printCount,
    };
  }

  // --- Logs & Auditing ---
  public recordPrintLog(log: Omit<PrintLog, 'id' | 'createdAt'> & { id?: string }): PrintLog {
    const newLog: PrintLog = {
      id: log.id || 'prnt_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      ...log,
    };
    this.data.printLogs.unshift(newLog);
    if (this.data.printLogs.length > 500) this.data.printLogs.pop();
    this.save();
    return newLog;
  }

  public logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'createdAt'>): SecurityEvent {
    const newEvent: SecurityEvent = {
      id: 'sec_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      ...event,
    };
    this.data.securityEvents.unshift(newEvent);
    if (this.data.securityEvents.length > 500) this.data.securityEvents.pop();
    this.save();
    return newEvent;
  }

  public logAudit(log: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    const newAudit: AuditLog = {
      id: 'aud_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      ...log,
    };
    this.data.auditLogs.unshift(newAudit);
    if (this.data.auditLogs.length > 500) this.data.auditLogs.pop();
    this.save();
    return newAudit;
  }

  public getPrintLogs(): PrintLog[] {
    return this.data.printLogs.map(l => {
      const student = this.getStudentById(l.studentId);
      const pdf = this.getPdfById(l.pdfId);
      return {
        ...l,
        studentName: student?.name,
        studentMobile: student?.mobile,
        studentEmail: student?.email,
        pdfTitle: pdf?.title,
      };
    });
  }

  public getSecurityEvents(): SecurityEvent[] {
    return this.data.securityEvents.map(e => {
      const student = e.studentId ? this.getStudentById(e.studentId) : undefined;
      return {
        ...e,
        studentName: student?.name,
        studentMobile: student?.mobile,
      };
    });
  }

  public getActiveSessions(): SessionRecord[] {
    return this.data.sessions.map(s => {
      const student = this.getStudentById(s.studentId);
      const assignment = this.data.assignments.find(a => a.id === s.assignmentId);
      const pdf = assignment ? this.getPdfById(assignment.pdfId) : undefined;
      return {
        ...s,
        studentName: student?.name,
        studentEmail: student?.email,
        pdfTitle: pdf?.title,
      };
    }).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }

  public getOverviewStats(): OverviewStats {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeLinks = this.data.assignments.filter(
      a => a.status === 'ACTIVE' && (!a.expiresAt || new Date(a.expiresAt) > now)
    ).length;

    const revokedLinks = this.data.assignments.filter(a => a.status === 'REVOKED').length;

    const expiredLinks = this.data.assignments.filter(
      a => a.status === 'ACTIVE' && a.expiresAt && new Date(a.expiresAt) <= now
    ).length;

    const totalPrints = this.data.printLogs.filter(p => p.status === 'SUCCESS').length;

    const suspiciousSessions = this.data.securityEvents.filter(
      e => e.severity === 'HIGH' || e.severity === 'CRITICAL'
    ).length;

    const todayActivityCount = this.data.securityEvents.filter(
      e => new Date(e.createdAt) >= todayStart
    ).length + this.data.printLogs.filter(
      p => new Date(p.createdAt) >= todayStart
    ).length;

    return {
      totalPdfs: this.data.pdfs.filter(p => p.status === 'ACTIVE').length,
      totalStudents: this.data.students.length,
      activeLinks,
      revokedLinks,
      expiredLinks,
      totalPrints,
      suspiciousSessions,
      todayActivityCount,
      recentSecurityEvents: this.getSecurityEvents().slice(0, 8),
      recentPrintLogs: this.getPrintLogs().slice(0, 8),
    };
  }

  public getSettings() {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<DatabaseSchema['settings']>) {
    Object.assign(this.data.settings, updates);
    this.save();
    return this.data.settings;
  }

  public async configureSupabase(url: string, key: string) {
    setSupabaseRuntimeConfig(url, key);
    // test connection
    const status = await checkSupabaseConnection();
    if (status.connected) {
      // automatically sync data
      await pushAllToSupabase(this.data);
    }
    return status;
  }

  public async getSupabaseStatus() {
    const status = await checkSupabaseConnection();
    return {
      ...status,
      localRecordCounts: {
        students: this.data.students.length,
        pdfs: this.data.pdfs.length,
        assignments: this.data.assignments.length,
        tokens: this.data.tokens.length,
        sessions: this.data.sessions.length,
        printLogs: this.data.printLogs.length,
        securityEvents: this.data.securityEvents.length,
      }
    };
  }

  public async syncToSupabase() {
    return await pushAllToSupabase(this.data);
  }

  public getSupabaseSqlSchema() {
    return SUPABASE_SQL_SCHEMA;
  }
}

export const db = new Database();
