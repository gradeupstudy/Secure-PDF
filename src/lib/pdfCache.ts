import { PdfDocument } from '../types';

const DB_NAME = 'GradeUpLibraryDB';
const DB_VERSION = 1;
const STORE_BLOBS = 'pdf_blobs';
const STORE_META = 'pdf_meta';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storePdfLocally(pdf: PdfDocument, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_BLOBS, STORE_META], 'readwrite');
    tx.objectStore(STORE_BLOBS).put(data, pdf.id);
    tx.objectStore(STORE_BLOBS).put(data, pdf.storagePath);
    tx.objectStore(STORE_META).put(pdf);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to store PDF in IndexedDB:', err);
  }
}

export async function getLocalPdfBlob(pdfIdOrPath: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const request = tx.objectStore(STORE_BLOBS).get(pdfIdOrPath);

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getLocalPdfs(): Promise<PdfDocument[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_META, 'readonly');
    const request = tx.objectStore(STORE_META).getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
