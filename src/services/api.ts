import { createClient } from '@supabase/supabase-js';
import { 
  OverviewStats, 
  PdfDocument, 
  Student, 
  Assignment, 
  PrintLog, 
  SecurityEvent, 
  SessionRecord, 
  StudentAccessVerification 
} from '../types';

const ADMIN_TOKEN_KEY = 'gradeup_admin_token';
const SUPABASE_URL_KEY = 'gradeup_supabase_url';
const SUPABASE_KEY_KEY = 'gradeup_supabase_key';

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || 'gradeup_admin_session_token_2026';
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function getStoredSupabaseConfig(): { url: string; key: string } {
  return {
    url: localStorage.getItem(SUPABASE_URL_KEY) || '',
    key: localStorage.getItem(SUPABASE_KEY_KEY) || '',
  };
}

export function setStoredSupabaseConfig(url: string, key: string) {
  if (url) localStorage.setItem(SUPABASE_URL_KEY, url);
  if (key) localStorage.setItem(SUPABASE_KEY_KEY, key);
}

function adminHeaders(): HeadersInit {
  const token = getAdminToken() || 'gradeup_admin_session_token_2026';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

export const api = {
  // --- Admin Auth ---
  loginAdmin: async (email: string, password: string) => {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    if (data.token) setAdminToken(data.token);
    return data;
  },

  getOverview: async (): Promise<OverviewStats> => {
    const res = await fetch('/api/admin/overview', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Failed to fetch overview stats');
    return res.json();
  },

  // --- PDFs ---
  getPdfs: async (): Promise<PdfDocument[]> => {
    const res = await fetch('/api/admin/pdfs', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Failed to fetch PDFs');
    return res.json();
  },

  uploadPdf: async (formData: FormData): Promise<PdfDocument> => {
    const token = getAdminToken() || 'gradeup_admin_session_token_2026';
    const res = await fetch('/api/admin/pdfs/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Failed to upload PDF');
    }
    return res.json();
  },

  updatePdf: async (id: string, updates: Partial<PdfDocument>): Promise<PdfDocument> => {
    const res = await fetch(`/api/admin/pdfs/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update PDF');
    return res.json();
  },

  deletePdf: async (id: string): Promise<void> => {
    const res = await fetch(`/api/admin/pdfs/${id}`, {
      method: 'DELETE',
      headers: adminHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete PDF');
  },

  // --- Students ---
  getStudents: async (): Promise<Student[]> => {
    const res = await fetch('/api/admin/students', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Failed to fetch students');
    return res.json();
  },

  createStudent: async (student: { name: string; mobile: string; email: string; notes?: string }): Promise<Student> => {
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(student)
    });
    if (!res.ok) throw new Error('Failed to save student');
    return res.json();
  },

  deleteStudent: async (id: string): Promise<void> => {
    const res = await fetch(`/api/admin/students/${id}`, {
      method: 'DELETE',
      headers: adminHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete student');
  },

  // --- Assignments & Access Links ---
  getAssignments: async (): Promise<Assignment[]> => {
    const res = await fetch('/api/admin/assignments', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Failed to fetch assignments');
    return res.json();
  },

  createAssignment: async (payload: {
    studentName: string;
    studentMobile: string;
    studentEmail: string;
    pdfId: string;
    allowPrint: boolean;
    printLimit: number;
    deviceLimit?: number;
    expiresAt: string | null;
    notes?: string;
  }): Promise<{ success: boolean; assignment: Assignment; rawToken: string; tokenUrl: string }> => {
    const res = await fetch('/api/admin/assignments/create', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create assignment' }));
      throw new Error(err.error || 'Failed to generate link');
    }
    return res.json();
  },

  revokeAssignment: async (id: string): Promise<void> => {
    const res = await fetch(`/api/admin/assignments/${id}/revoke`, {
      method: 'POST',
      headers: adminHeaders()
    });
    if (!res.ok) throw new Error('Failed to revoke access link');
  },

  resetAssignment: async (id: string): Promise<{ assignment: Assignment; rawToken: string; tokenUrl: string }> => {
    const res = await fetch(`/api/admin/assignments/${id}/reset`, {
      method: 'POST',
      headers: adminHeaders()
    });
    if (!res.ok) throw new Error('Failed to reset access link');
    return res.json();
  },

  updateLimits: async (id: string, limits: { printLimit?: number; allowPrint?: boolean; expiresAt?: string | null; deviceLimit?: number }) => {
    const res = await fetch(`/api/admin/assignments/${id}/limits`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(limits)
    });
    if (!res.ok) throw new Error('Failed to update limits');
    return res.json();
  },

  // --- Logs & Sessions ---
  getPrintLogs: async (): Promise<PrintLog[]> => {
    const res = await fetch('/api/admin/print-logs', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Failed to fetch print logs');
    return res.json();
  },

  getSecurityLogs: async (): Promise<SecurityEvent[]> => {
    const res = await fetch('/api/admin/security-logs', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Failed to fetch security logs');
    return res.json();
  },

  getActiveSessions: async (): Promise<SessionRecord[]> => {
    const res = await fetch('/api/admin/sessions', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Failed to fetch active sessions');
    return res.json();
  },

  terminateSession: async (sessionId: string): Promise<void> => {
    const res = await fetch(`/api/admin/sessions/${sessionId}/terminate`, {
      method: 'POST',
      headers: adminHeaders()
    });
    if (!res.ok) throw new Error('Failed to terminate session');
  },

  terminateAllSessionsForAssignment: async (assignmentId: string): Promise<{ terminatedCount: number }> => {
    const res = await fetch(`/api/admin/assignments/${assignmentId}/terminate-sessions`, {
      method: 'POST',
      headers: adminHeaders()
    });
    if (!res.ok) throw new Error('Failed to terminate sessions');
    return res.json();
  },

  getSettings: async () => {
    const res = await fetch('/api/admin/settings', { headers: adminHeaders() });
    return res.json();
  },

  updateSettings: async (settings: any) => {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(settings)
    });
    return res.json();
  },

  // --- Supabase Cloud Database Management ---
  getSupabaseStatus: async () => {
    try {
      const res = await fetch('/api/admin/supabase/status', { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('Backend status endpoint unreachable:', e);
    }

    const { url, key } = getStoredSupabaseConfig();
    if (url && key) {
      try {
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await client.from('students').select('id').limit(1);
        const errMsg = (error?.message || '').toLowerCase();
        const isConnected = !error || errMsg.includes('relation') || errMsg.includes('does not exist');
        return {
          configured: true,
          connected: isConnected,
          tablesReady: !error,
          url,
          error: error ? (errMsg.includes('relation') || errMsg.includes('does not exist') ? 'Supabase connected! Tables are not created yet. Please execute SQL Schema.' : error.message) : undefined,
        };
      } catch (err: any) {
        return {
          configured: true,
          connected: false,
          url,
          error: err.message || 'Direct Supabase connection error',
        };
      }
    }

    return {
      configured: false,
      connected: false,
      error: 'Supabase URL and Key not configured yet.',
    };
  },

  configureSupabase: async (url: string, key: string) => {
    const cleanUrl = url.trim();
    const cleanKey = key.trim();

    setStoredSupabaseConfig(cleanUrl, cleanKey);

    try {
      const res = await fetch('/api/admin/supabase/configure', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ url: cleanUrl, key: cleanKey }),
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.error) {
          throw new Error(err.error);
        }
      }
    } catch (serverErr: any) {
      console.warn('Backend configure failed, validating with client SDK...', serverErr);
      
      // If client SDK can connect
      try {
        const client = createClient(cleanUrl, cleanKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await client.from('students').select('id').limit(1);
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('relation') || msg.includes('does not exist') || error.code === '42P01') {
            return {
              configured: true,
              connected: true,
              tablesReady: false,
              url: cleanUrl,
              error: 'Credentials verified! Tables are not created yet. Please execute the SQL Schema in Supabase SQL Editor.',
            };
          }
          throw new Error(error.message || 'Invalid Supabase Key or Connection URL.');
        }

        return {
          configured: true,
          connected: true,
          tablesReady: true,
          url: cleanUrl,
        };
      } catch (clientErr: any) {
        throw new Error(clientErr.message || serverErr.message || 'Failed to connect to Supabase.');
      }
    }
  },

  syncToSupabase: async () => {
    const res = await fetch('/api/admin/supabase/sync', {
      method: 'POST',
      headers: adminHeaders(),
    });
    if (!res.ok) throw new Error('Failed to synchronize with Supabase');
    return res.json();
  },

  getSupabaseSqlSchema: async (): Promise<{ sql: string }> => {
    const res = await fetch('/api/admin/supabase/sql-schema', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Failed to fetch SQL Schema');
    return res.json();
  },

  // --- Student Verification & Access ---
  verifyStudentAccess: async (token: string): Promise<StudentAccessVerification> => {
    const res = await fetch(`/api/access/verify/${encodeURIComponent(token)}`);
    const data = await res.json();
    return data;
  },

  logSecurityEvent: async (sessionId: string, eventType: string, metadata?: any) => {
    try {
      await fetch('/api/access/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ eventType, metadata })
      });
    } catch {
      // Non-blocking telemetry
    }
  },

  requestAuthorizedPrint: async (sessionId: string): Promise<Blob> => {
    const res = await fetch('/api/access/print-request', {
      method: 'POST',
      headers: {
        'x-session-id': sessionId
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Print request failed' }));
      throw new Error(err.error || 'Printing unauthorized or limit reached');
    }

    return res.blob();
  }
};
