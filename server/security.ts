import crypto from 'crypto';

// Cryptographic token generator (256 bits of randomness, URL-safe hex/base64url)
export function generateSecureAccessToken(): { rawToken: string; tokenHash: string } {
  // 32 bytes = 256 bits of entropy
  const buffer = crypto.randomBytes(32);
  const rawToken = buffer.toString('hex'); // 64 hex chars
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const buffer = crypto.randomBytes(24);
  const rawToken = 'sess_' + buffer.toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function normalizeMobile(mobile: string): string {
  // Clean whitespace, hyphens, and non-digits except leading +
  let cleaned = mobile.trim().replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskMobile(mobile: string): string {
  const norm = normalizeMobile(mobile);
  if (norm.length >= 10) {
    const start = norm.slice(0, 3);
    const end = norm.slice(-4);
    return `${start} XXXXX ${end}`;
  }
  return norm;
}

export function parseDeviceInfo(userAgent: string): { browser: string; os: string; deviceType: string } {
  const ua = userAgent || '';
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let deviceType = 'Desktop';

  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) {
    deviceType = 'Mobile';
  } else if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) {
    deviceType = 'Tablet';
  }

  if (/edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua)) browser = 'Apple Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  return { browser, os, deviceType };
}

// In-memory rate limiter per IP / token
interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

export function checkRateLimit(key: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false;
  }

  bucket.count += 1;
  return true;
}
