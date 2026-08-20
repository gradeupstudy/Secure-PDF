import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Global or dynamic config
let runtimeSupabaseUrl = '';
let runtimeSupabaseKey = '';

export function setSupabaseRuntimeConfig(url: string, key: string) {
  runtimeSupabaseUrl = url.trim();
  runtimeSupabaseKey = key.trim();
  supabaseClient = null; // reset client to reinitialize
}

const getSupabaseUrl = () => 
  runtimeSupabaseUrl || 
  process.env.SUPABASE_URL || 
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const getSupabaseKey = () => 
  runtimeSupabaseKey ||
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY || 
  '';

let supabaseClient: SupabaseClient | null = null;

/**
 * Returns the Supabase client instance if environment variables are configured.
 */
export function getSupabase(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) {
    return null;
  }
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      supabaseClient = null;
    }
  }
  return supabaseClient;
}

/**
 * Checks connection status to Supabase
 */
export async function checkSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  url?: string;
  maskedKey?: string;
  error?: string;
  tablesReady?: boolean;
}> {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    return {
      configured: false,
      connected: false,
      error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are not set in environment variables.',
    };
  }

  const maskedKey = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : '****';
  const client = getSupabase();
  if (!client) {
    return {
      configured: true,
      connected: false,
      url,
      maskedKey,
      error: 'Could not create Supabase client instance.',
    };
  }

  try {
    const { data, error } = await client.from('students').select('id').limit(1);
    if (error) {
      const errMsg = (error.message || '').toLowerCase();
      // If table doesn't exist yet or PGRST schema cache hasn't refreshed
      if (
        errMsg.includes('relation') || 
        errMsg.includes('does not exist') || 
        errMsg.includes('could not find the table') ||
        error.code === '42P01' || 
        error.code === 'PGRST204' ||
        error.code === 'PGRST200'
      ) {
        return {
          configured: true,
          connected: true,
          url,
          maskedKey,
          tablesReady: false,
          error: 'Supabase credentials are valid! Tables are not created yet. Please execute the SQL Schema in Supabase SQL Editor.',
        };
      }

      // Check if invalid API key or URL
      return {
        configured: true,
        connected: false,
        url,
        maskedKey,
        error: error.message || 'Invalid Supabase Key or Connection URL.',
      };
    }

    return {
      configured: true,
      connected: true,
      url,
      maskedKey,
      tablesReady: true,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      url,
      maskedKey,
      error: err.message || 'Unknown error connecting to Supabase.',
    };
  }
}

/**
 * Sync all in-memory / local records to Supabase Cloud
 */
export async function pushAllToSupabase(data: any): Promise<{ success: boolean; message: string; details?: any }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, message: 'Supabase is not configured. Add SUPABASE_URL and key to environment variables.' };
  }

  try {
    // 1. Sync Students
    if (data.students && data.students.length > 0) {
      const studentRows = data.students.map((s: any) => ({
        id: s.id,
        name: s.name,
        mobile: s.mobile,
        email: s.email,
        status: s.status,
        notes: s.notes || null,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      }));
      const { error: err1 } = await client.from('students').upsert(studentRows, { onConflict: 'id' });
      if (err1) console.error('Error syncing students to Supabase:', err1);
    }

    // 2. Sync PDFs
    if (data.pdfs && data.pdfs.length > 0) {
      const pdfRows = data.pdfs.map((p: any) => ({
        id: p.id,
        title: p.title,
        file_name: p.fileName,
        description: p.description || null,
        storage_path: p.storagePath,
        file_size: p.fileSize || 0,
        page_count: p.pageCount || 1,
        status: p.status,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }));
      const { error: err2 } = await client.from('pdfs').upsert(pdfRows, { onConflict: 'id' });
      if (err2) console.error('Error syncing pdfs to Supabase:', err2);
    }

    // 3. Sync Assignments
    if (data.assignments && data.assignments.length > 0) {
      const assignRows = data.assignments.map((a: any) => ({
        id: a.id,
        student_id: a.studentId,
        pdf_id: a.pdfId,
        status: a.status,
        allow_print: a.allowPrint,
        print_limit: a.printLimit,
        print_count: a.printCount,
        device_limit: a.deviceLimit,
        expires_at: a.expiresAt || null,
        notes: a.notes || null,
        current_access_token: a.currentAccessToken || null,
        access_token_hash: a.accessTokenHash || null,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
      }));
      const { error: err3 } = await client.from('assignments').upsert(assignRows, { onConflict: 'id' });
      if (err3) console.error('Error syncing assignments to Supabase:', err3);
    }

    // 4. Sync Tokens
    if (data.tokens && data.tokens.length > 0) {
      const tokenRows = data.tokens.map((t: any) => ({
        id: t.id,
        assignment_id: t.assignmentId,
        token_hash: t.tokenHash,
        raw_token: t.rawToken || null,
        status: t.status,
        created_at: t.createdAt,
        expires_at: t.expiresAt || null,
        revoked_at: t.revokedAt || null,
        last_used_at: t.lastUsedAt || null,
      }));
      const { error: err4 } = await client.from('tokens').upsert(tokenRows, { onConflict: 'id' });
      if (err4) console.error('Error syncing tokens to Supabase:', err4);
    }

    // 5. Sync Settings
    if (data.settings) {
      await client.from('settings').upsert({
        key: 'portal_config',
        value: data.settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    }

    return {
      success: true,
      message: `Successfully synchronized ${data.students?.length || 0} students, ${data.pdfs?.length || 0} PDFs, and ${data.assignments?.length || 0} assignments to Supabase.`,
    };
  } catch (err: any) {
    console.error('Failed to sync to Supabase:', err);
    return {
      success: false,
      message: err.message || 'Failed to sync with Supabase.',
    };
  }
}

/**
 * Pull all data from Supabase into memory
 */
export async function pullAllFromSupabase(): Promise<any | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const [
      { data: students, error: errS },
      { data: pdfs, error: errP },
      { data: assignments, error: errA },
      { data: tokens, error: errT },
      { data: sessions },
      { data: printLogs },
      { data: securityEvents },
      { data: settingsRow }
    ] = await Promise.all([
      client.from('students').select('*'),
      client.from('pdfs').select('*'),
      client.from('assignments').select('*'),
      client.from('tokens').select('*'),
      client.from('sessions').select('*').limit(200),
      client.from('print_logs').select('*').limit(500),
      client.from('security_events').select('*').limit(500),
      client.from('settings').select('*').eq('key', 'portal_config').maybeSingle(),
    ]);

    if (errS || errP || errA) {
      console.warn('Could not fetch all tables from Supabase, skipping pull:', errS || errP || errA);
      return null;
    }

    const mappedStudents = (students || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      mobile: s.mobile,
      email: s.email,
      status: s.status,
      notes: s.notes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    const mappedPdfs = (pdfs || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      fileName: p.file_name,
      description: p.description,
      storagePath: p.storage_path,
      fileSize: Number(p.file_size || 0),
      pageCount: Number(p.page_count || 1),
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    const mappedAssignments = (assignments || []).map((a: any) => ({
      id: a.id,
      studentId: a.student_id,
      pdfId: a.pdf_id,
      status: a.status,
      allowPrint: Boolean(a.allow_print),
      printLimit: Number(a.print_limit || 0),
      printCount: Number(a.print_count || 0),
      deviceLimit: Number(a.device_limit || 1),
      expiresAt: a.expires_at,
      notes: a.notes,
      currentAccessToken: a.current_access_token,
      accessTokenHash: a.access_token_hash,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));

    const mappedTokens = (tokens || []).map((t: any) => ({
      id: t.id,
      assignmentId: t.assignment_id,
      tokenHash: t.token_hash,
      rawToken: t.raw_token,
      status: t.status,
      createdAt: t.created_at,
      expiresAt: t.expires_at,
      revokedAt: t.revoked_at,
      lastUsedAt: t.last_used_at,
    }));

    return {
      students: mappedStudents,
      pdfs: mappedPdfs,
      assignments: mappedAssignments,
      tokens: mappedTokens,
      sessions: (sessions || []).map((s: any) => ({
        id: s.id,
        assignmentId: s.assignment_id,
        tokenHash: s.token_hash,
        status: s.status,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        deviceFingerprint: s.device_fingerprint,
        deviceInfo: s.device_info,
        createdAt: s.created_at,
        lastActiveAt: s.last_active_at,
        expiresAt: s.expires_at,
        terminatedAt: s.terminated_at,
        terminationReason: s.termination_reason,
      })),
      printLogs: (printLogs || []).map((pl: any) => ({
        id: pl.id,
        assignmentId: pl.assignment_id,
        studentId: pl.student_id,
        pdfId: pl.pdf_id,
        studentName: pl.student_name,
        studentMobile: pl.student_mobile,
        pdfTitle: pl.pdf_title,
        attemptNumber: pl.attempt_number,
        ipAddress: pl.ip_address,
        userAgent: pl.user_agent,
        status: pl.status,
        watermarkSnapshot: pl.watermark_snapshot,
        createdAt: pl.created_at,
      })),
      securityEvents: (securityEvents || []).map((se: any) => ({
        id: se.id,
        sessionId: se.session_id,
        assignmentId: se.assignment_id,
        studentId: se.student_id,
        studentName: se.student_name,
        eventType: se.event_type,
        severity: se.severity,
        ipAddress: se.ip_address,
        metadata: se.metadata,
        createdAt: se.created_at,
      })),
      settings: settingsRow?.value || undefined,
    };
  } catch (err) {
    console.error('Error pulling from Supabase:', err);
    return null;
  }
}

/**
 * Complete SQL Schema script ready to copy-paste into Supabase SQL Editor
 */
export const SUPABASE_SQL_SCHEMA = `-- =========================================================================
-- GRADEUP STUDY SECURE PDF PRINT PORTAL - SUPABASE SQL SCHEMA
-- Run this script in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =========================================================================

-- 1. Create Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create PDF Documents Table
CREATE TABLE IF NOT EXISTS public.pdfs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    description TEXT,
    storage_path TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    page_count INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Assignments Table
CREATE TABLE IF NOT EXISTS public.assignments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    pdf_id TEXT NOT NULL REFERENCES public.pdfs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    allow_print BOOLEAN NOT NULL DEFAULT true,
    print_limit INT NOT NULL DEFAULT 3,
    print_count INT NOT NULL DEFAULT 0,
    device_limit INT NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ,
    notes TEXT,
    current_access_token TEXT,
    access_token_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Access Tokens Table
CREATE TABLE IF NOT EXISTS public.tokens (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    raw_token TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    terminated_at TIMESTAMPTZ,
    termination_reason TEXT
);

-- 6. Create Controlled Print Logs Table
CREATE TABLE IF NOT EXISTS public.print_logs (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
    pdf_id TEXT REFERENCES public.pdfs(id) ON DELETE SET NULL,
    student_name TEXT,
    student_mobile TEXT,
    pdf_title TEXT,
    attempt_number INT NOT NULL DEFAULT 1,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    watermark_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Create Security Radar Events Table
CREATE TABLE IF NOT EXISTS public.security_events (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE SET NULL,
    assignment_id TEXT REFERENCES public.assignments(id) ON DELETE SET NULL,
    student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
    student_name TEXT,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    ip_address TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Create Portal Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Indexes for Superfast Verification
CREATE INDEX IF NOT EXISTS idx_assignments_student ON public.assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_pdf ON public.assignments(pdf_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON public.tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_assignment ON public.sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_print_logs_assignment ON public.print_logs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow Service Role and App API Full Access
CREATE POLICY "Allow all access to service role" ON public.students FOR ALL USING (true);
CREATE POLICY "Allow all access to service role" ON public.pdfs FOR ALL USING (true);
CREATE POLICY "Allow all access to service role" ON public.assignments FOR ALL USING (true);
CREATE POLICY "Allow all access to service role" ON public.tokens FOR ALL USING (true);
CREATE POLICY "Allow all access to service role" ON public.sessions FOR ALL USING (true);
CREATE POLICY "Allow all access to service role" ON public.print_logs FOR ALL USING (true);
CREATE POLICY "Allow all access to service role" ON public.security_events FOR ALL USING (true);
CREATE POLICY "Allow all access to service role" ON public.settings FOR ALL USING (true);
`;
