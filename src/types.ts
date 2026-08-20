export type LinkStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUSPICIOUS';
export type PrintStatus = 'SUCCESS' | 'DENIED' | 'LIMIT_REACHED' | 'EXPIRED' | 'REVOKED' | 'SECURITY_BLOCK';
export type SecurityEventType = 
  | 'LINK_OPENED'
  | 'PDF_RENDERED'
  | 'SCREENSHOT_ATTEMPT_DETECTED'
  | 'VISIBILITY_FOCUS_LOST'
  | 'TAB_SWITCHED'
  | 'COPY_ATTEMPT_BLOCKED'
  | 'KEYBOARD_SHORTCUT_BLOCKED'
  | 'PRINT_CLICKED'
  | 'PRINT_SUCCESSFUL'
  | 'PRINT_BLOCKED'
  | 'NEW_DEVICE_DETECTED'
  | 'SUSPICIOUS_MULTI_IP'
  | 'SESSION_TERMINATED'
  | 'LINK_REVOKED'
  | 'LINK_RESET'
  | 'TOKEN_BRUTE_FORCE_BLOCKED';

export interface Student {
  id: string;
  name: string;
  mobile: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PdfDocument {
  id: string;
  title: string;
  fileName: string;
  description?: string;
  storagePath: string;
  fileSize: number; // in bytes
  pageCount: number;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  studentId: string;
  pdfId: string;
  status: LinkStatus;
  allowPrint: boolean;
  printLimit: number; // 0 for unlimited, or positive integer (e.g. 1, 2, 3, 5)
  printCount: number;
  deviceLimit: number; // e.g. 1, 2, 3, 0 for unlimited
  expiresAt: string | null; // ISO string or null for no expiry
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields for display
  student?: Student;
  pdf?: PdfDocument;
  currentAccessToken?: string; // only available when created or reset
  accessTokenHash?: string;
}

export interface AccessToken {
  id: string;
  assignmentId: string;
  tokenHash: string;
  rawToken?: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export interface SessionRecord {
  id: string;
  assignmentId: string;
  tokenId: string;
  studentId: string;
  deviceIdentifier: string;
  browser: string;
  os: string;
  ipAddress: string;
  userAgent: string;
  status: 'ACTIVE' | 'TERMINATED' | 'EXPIRED';
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  // joined info
  studentName?: string;
  studentEmail?: string;
  pdfTitle?: string;
}

export interface PrintLog {
  id: string;
  assignmentId: string;
  studentId: string;
  pdfId: string;
  sessionId: string;
  attemptNumber: number;
  status: PrintStatus;
  createdAt: string;
  ipAddress: string;
  userAgent: string;
  pageCount?: number;
  reason?: string;
  // joined info
  studentName?: string;
  studentMobile?: string;
  studentEmail?: string;
  pdfTitle?: string;
}

export interface SecurityEvent {
  id: string;
  assignmentId?: string;
  studentId?: string;
  sessionId?: string;
  eventType: SecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  // joined info
  studentName?: string;
  studentMobile?: string;
  pdfTitle?: string;
}

export interface AuditLog {
  id: string;
  adminEmail: string;
  action: string;
  targetType: 'PDF' | 'STUDENT' | 'ASSIGNMENT' | 'SESSION' | 'SETTINGS';
  targetId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface OverviewStats {
  totalPdfs: number;
  totalStudents: number;
  activeLinks: number;
  revokedLinks: number;
  expiredLinks: number;
  totalPrints: number;
  suspiciousSessions: number;
  todayActivityCount: number;
  recentSecurityEvents: SecurityEvent[];
  recentPrintLogs: PrintLog[];
}

export interface StudentAccessVerification {
  valid: boolean;
  error?: 'INVALID_TOKEN' | 'REVOKED' | 'EXPIRED' | 'PDF_DISABLED' | 'SESSION_TERMINATED' | 'DEVICE_LIMIT_EXCEEDED' | 'RATE_LIMITED';
  message?: string;
  assignment?: {
    id: string;
    status: LinkStatus;
    allowPrint: boolean;
    printLimit: number;
    printCount: number;
    expiresAt: string | null;
  };
  student?: {
    id: string;
    name: string;
    mobile: string;
    email: string;
  };
  pdf?: {
    id: string;
    title: string;
    pageCount: number;
    fileSize: number;
  };
  session?: {
    id: string;
    token: string;
    expiresAt: string;
  };
  watermarkData?: {
    brand: string;
    studentName: string;
    studentMobile: string;
    studentEmail: string;
    accessId: string;
    sessionId: string;
    timestamp: string;
  };
}

export interface PrintAuthorizationResponse {
  authorized: boolean;
  printId?: string;
  message?: string;
  error?: string;
  newPrintCount?: number;
  printLimit?: number;
  watermarkedPdfUrl?: string;
}
