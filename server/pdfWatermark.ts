import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

const getStorageDir = () => {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'data', 'pdfs');
  }
  return path.join(process.cwd(), 'data', 'pdfs');
};

export function ensureStorageDir(): string {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getPdfStoragePath(fileName: string): string {
  const dir = ensureStorageDir();
  return path.join(dir, fileName);
}

/**
 * Creates high-quality mock Gradeup Study practice PDFs if they don't already exist.
 */
export async function initializeDefaultPdfs(): Promise<void> {
  ensureStorageDir();

  const defaultPdfs = [
    {
      fileName: 'hp_police_constable_mock_set_01.pdf',
      title: 'HP Police Constable Practice Set 01 - Full Mock Test',
      description: 'Official Gradeup Study Mock Examination with 80 Questions (General Hindi, English, Maths, Reasoning & HP GK).',
      pages: 4
    },
    {
      fileName: 'hp_patwari_quantitative_aptitude_2026.pdf',
      title: 'HP Patwari Quantitative Aptitude & Arithmetic Booster 2026',
      description: 'High-yield problem solving module with step-by-step solutions for HP Patwari Exam preparation.',
      pages: 3
    },
    {
      fileName: 'gradeup_study_hp_gk_special_capsule.pdf',
      title: 'Gradeup Study Himachal Pradesh GK Special Capsule 2026',
      description: 'Complete Himachal Pradesh History, Geography, Economy and Culture Revision Notes.',
      pages: 3
    }
  ];

  const dir = ensureStorageDir();
  for (const item of defaultPdfs) {
    const filePath = path.join(dir, item.fileName);
    if (!fs.existsSync(filePath)) {
      await generateMockPdfFile(filePath, item.title, item.description, item.pages);
    }
  }
}

async function generateMockPdfFile(filePath: string, title: string, description: string, numPages: number): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  for (let i = 1; i <= numPages; i++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
    const { width, height } = page.getSize();

    // Top Header Banner
    page.drawRectangle({
      x: 30,
      y: height - 60,
      width: width - 60,
      height: 40,
      color: rgb(0.08, 0.22, 0.45),
    });

    page.drawText('GRADEUP STUDY  |  OFFICIAL SECURE EXAMINATION MATERIAL', {
      x: 45,
      y: height - 42,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText('www.gradeupstudy.com  •  Confidential Student Access Copy', {
      x: width - 290,
      y: height - 52,
      size: 8,
      font: fontRegular,
      color: rgb(0.85, 0.9, 0.98),
    });

    // Document Title
    page.drawText(title, {
      x: 40,
      y: height - 90,
      size: 15,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });

    page.drawText(`Document Code: GS-EXAM-2026-${i.toString().padStart(2, '0')}  •  Page ${i} of ${numPages}`, {
      x: 40,
      y: height - 108,
      size: 9,
      font: fontOblique,
      color: rgb(0.4, 0.45, 0.5),
    });

    // Content Separator Line
    page.drawLine({
      start: { x: 40, y: height - 118 },
      end: { x: width - 40, y: height - 118 },
      thickness: 1,
      color: rgb(0.8, 0.85, 0.9),
    });

    // Page Specific Content
    let yPos = height - 145;

    if (i === 1) {
      page.drawText('CANDIDATE INSTRUCTIONS & SYLLABUS OVERVIEW', {
        x: 40,
        y: yPos,
        size: 11,
        font: fontBold,
        color: rgb(0.08, 0.22, 0.45),
      });
      yPos -= 20;

      const instructions = [
        '1. This secure document is exclusively licensed to the designated candidate by Gradeup Study.',
        '2. Unauthorized sharing, reproduction, extraction or transmission is strictly prohibited and tracked.',
        '3. Total Questions: 80 Questions  |  Time Allowed: 60 Minutes  |  Negative Marking: 0.25 marks.',
        '4. Maintain this printed/viewed material strictly for your personal study and test evaluation.'
      ];

      for (const inst of instructions) {
        page.drawText(inst, {
          x: 40,
          y: yPos,
          size: 9.5,
          font: fontRegular,
          color: rgb(0.2, 0.25, 0.3),
        });
        yPos -= 18;
      }

      yPos -= 15;
      page.drawText('SECTION A: HIMACHAL PRADESH GENERAL KNOWLEDGE & CURRENT AFFAIRS', {
        x: 40,
        y: yPos,
        size: 11,
        font: fontBold,
        color: rgb(0.08, 0.22, 0.45),
      });
      yPos -= 25;

      const questions = [
        {
          q: 'Q1. In which year was the Himachal Pradesh State Forest Development Corporation established?',
          opts: '(A) 1974      (B) 1980      (C) 1985      (D) 1991',
          ans: 'Key Insight: The HP State Forest Dev Corp was constituted on 25th March 1974.'
        },
        {
          q: 'Q2. Which river in Himachal Pradesh is known by the Vedic name "Askini"?',
          opts: '(A) Ravi      (B) Chenab    (C) Beas      (D) Sutlej',
          ans: 'Key Insight: Chenab river was referred to as Askini in Vedic texts and Chandrabhaga locally.'
        },
        {
          q: 'Q3. Who among the following was the first Chief Commissioner of Himachal Pradesh in 1948?',
          opts: '(A) N.C. Mehta    (B) E. Penderal Moon    (C) Bhagwan Sahay    (D) Y.S. Parmar',
          ans: 'Key Insight: Shri N.C. Mehta took charge as the first Chief Commissioner on 15 April 1948.'
        }
      ];

      for (const item of questions) {
        page.drawText(item.q, { x: 40, y: yPos, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        yPos -= 16;
        page.drawText(item.opts, { x: 55, y: yPos, size: 9.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        yPos -= 14;
        page.drawText(item.ans, { x: 55, y: yPos, size: 8.5, font: fontOblique, color: rgb(0.3, 0.45, 0.6) });
        yPos -= 25;
      }
    } else {
      page.drawText(`EXAMINATION PRACTICE MODULE - SECTION ${String.fromCharCode(64 + i)}`, {
        x: 40,
        y: yPos,
        size: 11,
        font: fontBold,
        color: rgb(0.08, 0.22, 0.45),
      });
      yPos -= 25;

      for (let qNum = 1; qNum <= 4; qNum++) {
        const overallQ = (i - 1) * 4 + qNum;
        page.drawText(`Q${overallQ}. Solved Mock Item #${overallQ}: Comprehensive Analytical Problem Set for Gradeup Study Candidates`, {
          x: 40,
          y: yPos,
          size: 10,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        yPos -= 16;
        page.drawText('(A) Option Alpha       (B) Option Beta       (C) Option Gamma       (D) Option Delta', {
          x: 55,
          y: yPos,
          size: 9.5,
          font: fontRegular,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPos -= 14;
        page.drawText('Detailed Explanatory Note & Shortcut Technique by Gradeup Study Faculty.', {
          x: 55,
          y: yPos,
          size: 8.5,
          font: fontOblique,
          color: rgb(0.3, 0.45, 0.6),
        });
        yPos -= 25;
      }

      // Notes block
      page.drawRectangle({
        x: 40,
        y: yPos - 60,
        width: width - 80,
        height: 70,
        color: rgb(0.96, 0.97, 0.99),
        borderColor: rgb(0.8, 0.85, 0.9),
        borderWidth: 1,
      });

      page.drawText('IMPORTANT STUDY TIP & FORMULA REFERENCE:', {
        x: 50,
        y: yPos - 12,
        size: 9,
        font: fontBold,
        color: rgb(0.1, 0.3, 0.6),
      });

      page.drawText('• Daily revision of Himachal Pradesh budget and economic survey is critical for scoring maximum marks.', {
        x: 50,
        y: yPos - 28,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.25, 0.3, 0.35),
      });
      page.drawText('• Maintain consistent speed during the reasoning section: maximum 45 seconds per puzzle.', {
        x: 50,
        y: yPos - 44,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.25, 0.3, 0.35),
      });
    }

    // Bottom Footer
    page.drawLine({
      start: { x: 40, y: 50 },
      end: { x: width - 40, y: 50 },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.92),
    });

    page.drawText('GRADEUP STUDY • Secure Academic Testing System', {
      x: 40,
      y: 35,
      size: 8,
      font: fontBold,
      color: rgb(0.4, 0.45, 0.5),
    });

    page.drawText(`Page ${i} of ${numPages}  •  Licensed Copy`, {
      x: width - 150,
      y: 35,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);
}

/**
 * Dynamically stamps indelible Gradeup Study student-specific watermarks onto every page for controlled printing.
 */
export async function generateWatermarkedPrintPdf(
  inputPdfPath: string,
  watermark: {
    studentName: string;
    studentMobile: string;
    studentEmail: string;
    accessId: string;
    sessionId: string;
    printTimestamp: string;
  }
): Promise<Buffer> {
  const existingPdfBytes = fs.readFileSync(inputPdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();

  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx];
    const { width, height } = page.getSize();

    // 1. Top Security Watermark Header Strip
    page.drawRectangle({
      x: 0,
      y: height - 18,
      width: width,
      height: 18,
      color: rgb(0.9, 0.1, 0.1),
      opacity: 0.9,
    });

    page.drawText(
      `GRADEUP STUDY PRINTED COPY  •  STUDENT: ${watermark.studentName.toUpperCase()}  •  MOB: ${watermark.studentMobile}  •  ${watermark.printTimestamp}`,
      {
        x: 15,
        y: height - 13,
        size: 7.5,
        font: fontBold,
        color: rgb(1, 1, 1),
      }
    );

    // 2. Diagonal Multi-line Repeating Watermark Grid
    const diagonalTextLines = [
      'GRADEUP STUDY SECURE PORTAL',
      `LICENSED TO: ${watermark.studentName}`,
      `MOBILE: ${watermark.studentMobile} | EMAIL: ${watermark.studentEmail}`,
      `ACCESS ID: ${watermark.accessId} | SESSION: ${watermark.sessionId}`,
      `PRINTED ON: ${watermark.printTimestamp}`,
    ];

    // Stamp repeating diagonal watermarks
    const yOffsets = [height * 0.72, height * 0.45, height * 0.18];
    for (const baseY of yOffsets) {
      page.pushOperators();
      
      let lineY = baseY;
      for (const line of diagonalTextLines) {
        page.drawText(line, {
          x: width * 0.12,
          y: lineY,
          size: 11,
          font: fontBold,
          color: rgb(0.72, 0.05, 0.05),
          opacity: 0.18,
          rotate: degrees(32),
        });
        lineY -= 14;
      }
    }

    // 3. Bottom Verification Stamp
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: 16,
      color: rgb(0.1, 0.15, 0.25),
      opacity: 0.85,
    });

    page.drawText(
      `Authorized Print Copy #${idx + 1}/${pages.length} • Gradeup Study Security Hash: ${watermark.accessId}-${watermark.sessionId.slice(-6)} • Personal Use Only`,
      {
        x: 15,
        y: 4,
        size: 7,
        font: fontRegular,
        color: rgb(0.9, 0.92, 0.95),
      }
    );
  }

  const outputBytes = await pdfDoc.save();
  return Buffer.from(outputBytes);
}

/**
 * Returns metadata of a PDF file
 */
export async function getPdfMetadata(filePath: string): Promise<{ pageCount: number; fileSize: number }> {
  const stat = fs.statSync(filePath);
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return {
    pageCount: pdfDoc.getPageCount(),
    fileSize: stat.size,
  };
}
