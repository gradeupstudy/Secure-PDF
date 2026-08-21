import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { WatermarkConfig } from '../types';

export interface WatermarkOptions {
  brand?: string;
  studentName: string;
  studentMobile: string;
  studentEmail?: string;
  accessId?: string;
  sessionId?: string;
  timestamp?: string;
  config?: WatermarkConfig;
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
 * Dynamically stamps indelible student-specific watermarks
 * onto EVERY page of the multi-page PDF document.
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

  const cfg = options.config;
  const pages = pdfDoc.getPages();
  const brand = sanitizeForPdfText(cfg?.brandText || options.brand || 'GRADEUP STUDY • CONFIDENTIAL');
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

  const baseFontSize = cfg?.fontSize && cfg.fontSize >= 12 ? cfg.fontSize : 18; // Default 18 (much larger)
  const watermarkOpacity = typeof cfg?.opacity === 'number' ? Math.max(0.12, Math.min(0.70, cfg.opacity)) : 0.32;
  const angleDeg = typeof cfg?.angle === 'number' ? cfg.angle : 32;
  const density = cfg?.density || 'triple';

  let textColor = rgb(0.78, 0.08, 0.08); // crimson default
  let bannerColor = rgb(0.85, 0.12, 0.12);
  if (cfg?.color === 'red') {
    textColor = rgb(0.85, 0.1, 0.1);
    bannerColor = rgb(0.9, 0.1, 0.1);
  } else if (cfg?.color === 'navy' || cfg?.color === 'darkblue') {
    textColor = rgb(0.08, 0.18, 0.45);
    bannerColor = rgb(0.08, 0.18, 0.45);
  } else if (cfg?.color === 'charcoal') {
    textColor = rgb(0.2, 0.25, 0.3);
    bannerColor = rgb(0.15, 0.2, 0.25);
  }

  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx];
    const { width, height } = page.getSize();

    // 1. Top Security Watermark Header Strip (Red Background)
    if (cfg?.showTopBanner !== false) {
      page.drawRectangle({
        x: 0,
        y: height - 22,
        width: width,
        height: 22,
        color: bannerColor,
        opacity: 0.95,
      });

      const headerText = `${brand} | CANDIDATE: ${cleanStudentName}${cleanMobile ? ` | MOB: ${cleanMobile}` : ''} | ${printTimestamp}`;
      page.drawText(headerText, {
        x: 12,
        y: height - 16,
        size: Math.min(9, width / 55),
        font: fontBold,
        color: rgb(1, 1, 1),
      });
    }

    // 2. Diagonal Repeating Watermarks Across Page Body
    const diagonalLines: { text: string; size: number; bold: boolean }[] = [];
    if (brand) {
      diagonalLines.push({ text: brand, size: baseFontSize * 1.05, bold: true });
    }
    if (cfg?.showStudentName !== false) {
      diagonalLines.push({ text: `LICENSED TO: ${cleanStudentName}`, size: baseFontSize * 1.15, bold: true });
    }
    const contactParts: string[] = [];
    if (cfg?.showStudentMobile !== false && cleanMobile) contactParts.push(`MOB: ${cleanMobile}`);
    if (cfg?.showStudentEmail !== false && cleanEmail) contactParts.push(`EMAIL: ${cleanEmail}`);
    if (contactParts.length > 0) {
      diagonalLines.push({ text: contactParts.join(' | '), size: baseFontSize * 0.85, bold: true });
    }
    const trackingParts: string[] = [];
    if (cfg?.showAuditId !== false) trackingParts.push(`ACCESS: ${accessId} | SESS: ${sessionId}`);
    if (cfg?.showTimestamp !== false) trackingParts.push(printTimestamp);
    if (trackingParts.length > 0) {
      diagonalLines.push({ text: trackingParts.join(' | '), size: baseFontSize * 0.75, bold: false });
    }

    let yOffsets = [height * 0.72, height * 0.46, height * 0.20];
    if (density === 'single') {
      yOffsets = [height * 0.48];
    } else if (density === 'dense') {
      yOffsets = [height * 0.82, height * 0.62, height * 0.42, height * 0.24, height * 0.08];
    }

    for (const baseY of yOffsets) {
      let currentY = baseY;
      for (const item of diagonalLines) {
        page.drawText(item.text, {
          x: width * 0.06,
          y: currentY,
          size: item.size,
          font: item.bold ? fontBold : fontRegular,
          color: textColor,
          opacity: watermarkOpacity,
          rotate: degrees(angleDeg),
        });
        currentY -= (item.size * 1.25 + 4);
      }
    }

    // 3. Bottom Audit Footer Strip
    if (cfg?.showBottomFooter !== false) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: 18,
        color: rgb(0.08, 0.12, 0.22),
        opacity: 0.9,
      });

      const footerText = `Authorized Hard Copy | Page ${idx + 1} of ${pages.length} | Audit ID: ${accessId}-${sessionId} | Strictly for Personal Study Use Only`;
      page.drawText(footerText, {
        x: 12,
        y: 5,
        size: Math.min(8, width / 60),
        font: fontRegular,
        color: rgb(0.9, 0.93, 0.98),
      });
    }
  }

  return await pdfDoc.save();
}
