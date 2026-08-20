import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker matching exact library version
if (typeof window !== 'undefined') {
  try {
    const version = pdfjsLib.version || '6.2.108';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  } catch (err) {
    console.warn('PDF.js worker setup fallback:', err);
  }
}

export interface RenderedPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class SecurePdfDocument {
  private pdfDoc: any = null;
  public totalPages: number = 0;

  public async loadFromUrl(url: string, headers: Record<string, string> = {}): Promise<void> {
    const version = pdfjsLib.version || '6.2.108';
    const loadingTask = pdfjsLib.getDocument({
      url,
      httpHeaders: headers,
      withCredentials: false,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
      cMapPacked: true,
    });

    this.pdfDoc = await loadingTask.promise;
    this.totalPages = this.pdfDoc.numPages;
  }

  public async loadFromBuffer(buffer: ArrayBuffer): Promise<void> {
    const version = pdfjsLib.version || '6.2.108';
    const loadingTask = pdfjsLib.getDocument({
      data: buffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
      cMapPacked: true,
    });

    this.pdfDoc = await loadingTask.promise;
    this.totalPages = this.pdfDoc.numPages;
  }

  public async renderPageToCanvas(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number = 1.5
  ): Promise<{ width: number; height: number }> {
    if (!this.pdfDoc) throw new Error('PDF not loaded');
    const page = await this.pdfDoc.getPage(pageNumber);

    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context not available');

    // High DPI scaling
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const renderContext = {
      canvasContext: context,
      transform: transform,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    return {
      width: viewport.width,
      height: viewport.height,
    };
  }
}
