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
    if (pdf.storagePath) {
      tx.objectStore(STORE_BLOBS).put(data, pdf.storagePath);
    }
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
  if (!pdfIdOrPath) return null;
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_BLOBS, STORE_META], 'readonly');
    const blobStore = tx.objectStore(STORE_BLOBS);
    const metaStore = tx.objectStore(STORE_META);

    // 1. Direct key lookups
    const candidateKeys = [
      pdfIdOrPath,
      pdfIdOrPath.replace(/-/g, '_'),
      pdfIdOrPath.replace(/_/g, '-'),
      pdfIdOrPath.trim(),
    ];

    for (const key of candidateKeys) {
      const blob: ArrayBuffer | undefined = await new Promise((resolve) => {
        const req = blobStore.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });
      if (blob && blob.byteLength > 100) {
        return blob;
      }
    }

    // 2. Check metadata store to resolve filename/storagePath
    const allMeta: PdfDocument[] = await new Promise((resolve) => {
      const req = metaStore.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const matchingMeta = allMeta.find(m => 
      m.id === pdfIdOrPath || 
      m.storagePath === pdfIdOrPath || 
      m.fileName === pdfIdOrPath ||
      m.id.replace(/_/g, '-') === pdfIdOrPath.replace(/_/g, '-') ||
      m.id.replace(/-/g, '_') === pdfIdOrPath.replace(/-/g, '_')
    );

    if (matchingMeta) {
      const keys = [matchingMeta.id, matchingMeta.storagePath, matchingMeta.fileName].filter(Boolean) as string[];
      for (const k of keys) {
        const blob: ArrayBuffer | undefined = await new Promise((resolve) => {
          const req = blobStore.get(k);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        });
        if (blob && blob.byteLength > 100) {
          return blob;
        }
      }
    }

    // 3. If there is any blob stored in IndexedDB and we only have 1, return it
    const allKeys: IDBValidKey[] = await new Promise((resolve) => {
      const req = blobStore.getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (allKeys.length > 0) {
      for (const k of allKeys) {
        if (typeof k === 'string' && (k.includes(pdfIdOrPath) || pdfIdOrPath.includes(k))) {
          const blob: ArrayBuffer | undefined = await new Promise((resolve) => {
            const req = blobStore.get(k);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(undefined);
          });
          if (blob && blob.byteLength > 100) {
            return blob;
          }
        }
      }
    }

    return null;
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

export async function deleteLocalPdf(pdfId: string, storagePath?: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_BLOBS, STORE_META], 'readwrite');
    tx.objectStore(STORE_META).delete(pdfId);
    tx.objectStore(STORE_BLOBS).delete(pdfId);
    if (storagePath) {
      tx.objectStore(STORE_BLOBS).delete(storagePath);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to delete PDF from IndexedDB:', err);
  }
}
