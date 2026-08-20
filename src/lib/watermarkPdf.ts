import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

export interface WatermarkOptions {
  brand?: string;
  studentName: string;
  studentMobile: string;
  studentEmail?: string;
  accessId?: string;
  sessionId?: string;
  timestamp?: string;
}

/**
 * Safely sanitizes text for PDF StandardFonts (WinAnsi encoding)
 * Converts non-ASCII and special bullets to standard printable ASCII characters
 */
function sanitizeForPdfText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[•●·]/g, '|')
    .replace(/[–—]/g, '-')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[^\x20-\x7E]/g, ' ') // Strip non-WinAnsi characters to prevent pdf-lib crash
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dynamically stamps indelible Gradeup Study student-specific watermarks
 * onto EVERY page of the actual multi-page PDF document.
 */
export async function stampWatermarksOnPdf(
  inputBuffer: ArrayBuffer,
  options: WatermarkOptions
): Promise<Uint8Array> {
  // Always create a fresh clone of input buffer to avoid detached buffer issues
  const bufferCopy = inputBuffer.slice(0);
  const pdfDoc = await PDFDocument.load(bufferCopy, { ignoreEncryption: true });
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const brand = sanitizeForPdfText(options.brand || 'GRADEUP STUDY');
  const rawStudentName = options.studentName || 'Authorized Candidate';
  const cleanStudentName = sanitizeForPdfText(rawStudentName).toUpperCase() || 'STUDENT';
  const cleanMobile = sanitizeForPdfText(options.studentMobile || '');
  const cleanEmail = sanitizeForPdfText(options.studentEmail || '');
  const accessId = sanitizeForPdfText(options.accessId || 'GS-SECURE');
  const sessionId = sanitizeForPdfText(options.sessionId || 'SESS-01').slice(-8).toUpperCase();
  const printTimestamp = sanitizeForPdfText(
    options.timestamp ||
      new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
  );

  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx];
    const { width, height } = page.getSize();

    // 1. Top Security Watermark Header Strip (Red Background)
    page.drawRectangle({
      x: 0,
      y: height - 20,
      width: width,
      height: 20,
      color: rgb(0.85, 0.12, 0.12),
      opacity: 0.95,
    });

    const headerText = `${brand} SECURE HARD COPY | CANDIDATE: ${cleanStudentName}${cleanMobile ? ` | MOB: ${cleanMobile}` : ''} | ${printTimestamp}`;
    page.drawText(headerText, {
      x: 12,
      y: height - 14,
      size: Math.min(8.5, width / 55),
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // 2. Diagonal Repeating Watermarks Across Page Body (Center, Top-Mid, Lower-Mid)
    const diagonalLines = [
      `${brand} | CONFIDENTIAL STUDY MATERIAL`,
      `LICENSED TO: ${cleanStudentName}`,
      cleanMobile ? `MOB: ${cleanMobile} | EMAIL: ${cleanEmail || 'REGISTERED'}` : `EMAIL: ${cleanEmail || 'REGISTERED'}`,
      `AUDIT: ${accessId} | SESSION: ${sessionId} | ${printTimestamp}`,
    ];

    const yOffsets = [height * 0.72, height * 0.46, height * 0.20];
    for (const baseY of yOffsets) {
      let currentY = baseY;
      for (const line of diagonalLines) {
        page.drawText(line, {
          x: width * 0.08,
          y: currentY,
          size: Math.min(10.5, width / 48),
          font: fontBold,
          color: rgb(0.75, 0.08, 0.08),
          opacity: 0.17,
          rotate: degrees(32),
        });
        currentY -= 14;
      }
    }

    // 3. Bottom Audit Footer Strip (Dark Blue Background)
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: 18,
      color: rgb(0.08, 0.12, 0.22),
      opacity: 0.9,
    });

    const footerText = `Authorized Print Copy | Page ${idx + 1} of ${pages.length} | Audit ID: ${accessId}-${sessionId} | Strictly for Personal Study Use Only`;
    page.drawText(footerText, {
      x: 12,
      y: 5,
      size: Math.min(7.5, width / 65),
      font: fontRegular,
      color: rgb(0.9, 0.93, 0.98),
    });
  }

  return await pdfDoc.save();
}
