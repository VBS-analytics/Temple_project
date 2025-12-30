import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { TAMIL_FONT_NAME, TAMIL_FONT_FILE, TAMIL_FONT_DATA_BASE64 } from './pdfMakeTamilFont';

declare global {
  interface Window {
    pdfMake?: {
      createPdf: (documentDefinition: TDocumentDefinitions) => {
        download: (fileName: string) => void;
        getBlob: (callback: (blob: Blob) => void) => void;
        getBuffer: (callback: (buffer: ArrayBuffer | Uint8Array) => void) => void;
      };
      fonts?: Record<
        string,
        {
          normal: string;
          bold?: string;
          italics?: string;
          bolditalics?: string;
        }
      >;
      vfs?: Record<string, string>;
      defaults?: {
        font?: string;
        [key: string]: any;
      };
    };
  }
}

let pdfMakeLoaded = false;
let tamilFontRegistered = false;

const ensureValidBase64 = () => {
  const b64 = TAMIL_FONT_DATA_BASE64;

  if (!b64 || typeof b64 !== 'string') {
    throw new Error('Tamil font base64 is empty or invalid');
  }

  if (b64.includes('data:') || b64.includes('base64,')) {
    throw new Error(
      'Tamil font base64 must be RAW base64 only. Remove "data:...;base64," prefix.',
    );
  }

  if (b64.includes('...')) {
    throw new Error('Tamil font base64 is truncated (contains "..."). Paste the full base64.');
  }

  if (b64.length < 50_000) {
    throw new Error(
      `Tamil font base64 looks too short (${b64.length}). You likely pasted incomplete data.`,
    );
  }

  // Decode test: if decode fails, base64 is corrupt
  try {
    // atob available in browser
    // eslint-disable-next-line no-undef
    atob(b64.slice(0, 2000)); // decode partial for quick sanity
  } catch {
    throw new Error('Tamil font base64 is not valid base64 (decode failed).');
  }

  // Optional: TTF files usually start with 0x00010000 or 'OTTO' (OTF).
  // Base64 for 0x00010000 often begins with "AAEAAA..."
  // OTF begins with "T1RUTw" (OTTO)
  const start = b64.slice(0, 12);
  const looksLikeTtfOrOtf = start.startsWith('AAEAAA') || start.startsWith('T1RUTw');
  if (!looksLikeTtfOrOtf) {
    // Not always guaranteed, but very useful to catch WOFF/WOFF2, or wrong file.
    console.warn(
      'Tamil font base64 does not look like a TTF/OTF header. Ensure you used a real .ttf or .otf (not .woff/.woff2).',
    );
  }
};

const registerTamilFont = () => {
  if (tamilFontRegistered) return true;

  if (typeof window === 'undefined') {
    console.error('PDFMake can only run in the browser');
    return false;
  }

  if (!window.pdfMake) {
    console.error('PDFMake not loaded yet');
    return false;
  }

  // If already present
  if (window.pdfMake.fonts?.[TAMIL_FONT_NAME] && window.pdfMake.vfs?.[TAMIL_FONT_FILE]) {
    tamilFontRegistered = true;
    return true;
  }

  try {
    ensureValidBase64();

    window.pdfMake.vfs = window.pdfMake.vfs || {};
    window.pdfMake.vfs[TAMIL_FONT_FILE] = TAMIL_FONT_DATA_BASE64;

    window.pdfMake.fonts = window.pdfMake.fonts || {};
    window.pdfMake.fonts[TAMIL_FONT_NAME] = {
      normal: TAMIL_FONT_FILE,
      bold: TAMIL_FONT_FILE,
      italics: TAMIL_FONT_FILE,
      bolditalics: TAMIL_FONT_FILE,
    };

    window.pdfMake.defaults = window.pdfMake.defaults || {};
    window.pdfMake.defaults.font = TAMIL_FONT_NAME;

    tamilFontRegistered = true;
    console.log('Tamil font registered successfully');
    console.log('Available fonts:', Object.keys(window.pdfMake.fonts || {}));
    return true;
  } catch (error) {
    console.error('Failed to register Tamil font:', error);
    return false;
  }
};

export const verifyTamilFont = () => {
  if (typeof window === 'undefined') {
    console.error('PDFMake not available on server');
    return false;
  }
  if (!window.pdfMake) {
    console.error('PDFMake not loaded yet');
    return false;
  }

  const fonts = window.pdfMake.fonts || {};
  const vfs = window.pdfMake.vfs || {};

  console.log('Available fonts:', Object.keys(fonts));
  console.log('VFS files:', Object.keys(vfs));
  console.log('Tamil font registered:', !!fonts[TAMIL_FONT_NAME]);
  console.log('Tamil font file in VFS:', !!vfs[TAMIL_FONT_FILE]);

  return !!fonts[TAMIL_FONT_NAME] && !!vfs[TAMIL_FONT_FILE];
};

export const PDF_TAMIL_FONT_NAME = TAMIL_FONT_NAME;

const scriptLoadPromises: Record<string, Promise<void>> = {};

const loadScript = (src: string) => {
  if (scriptLoadPromises[src]) {
    return scriptLoadPromises[src];
  }

  scriptLoadPromises[src] = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.pdfmakeLoaderLoaded === 'true') {
        resolve();
        return;
      }

      existing.addEventListener(
        'load',
        () => resolve(),
        { once: true },
      );
      existing.addEventListener(
        'error',
        () => {
          delete scriptLoadPromises[src];
          reject(new Error(`Failed to load script: ${src}`));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener(
      'load',
      () => {
        script.dataset.pdfmakeLoaderLoaded = 'true';
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => {
        delete scriptLoadPromises[src];
        reject(new Error(`Failed to load script: ${src}`));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return scriptLoadPromises[src];
};

export const loadPdfMake = async () => {
  if (typeof window === 'undefined') {
    throw new Error('PDFMake is only available in the browser');
  }

  if (pdfMakeLoaded && window.pdfMake) {
    const ok = registerTamilFont();
    if (!ok) console.error('Tamil font registration failed after reload');
    return window.pdfMake;
  }

  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js');

  pdfMakeLoaded = true;

  if (!window.pdfMake) {
    throw new Error('PDFMake failed to load');
  }

  if (typeof window.pdfMake.createPdf !== 'function') {
    throw new Error('PDFMake failed to initialize (createPdf missing)');
  }

  const ok = registerTamilFont();
  if (!ok) {
    throw new Error('Tamil font registration failed (check base64 / file type)');
  }

  return window.pdfMake;
};

// Optional test helper
export const testTamilFont = async () => {
  const pdfMake = await loadPdfMake();

  const testDoc: TDocumentDefinitions = {
    content: [
      { text: 'Tamil Font Test', style: 'header' },
      { text: 'தமிழ் எழுத்துக்கள்', style: 'tamil' },
      { text: 'சனிக்கிழமை நவகிரக பூஜை', style: 'tamil' },
    ],
    defaultStyle: { font: PDF_TAMIL_FONT_NAME, fontSize: 14 },
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      tamil: { fontSize: 16, margin: [0, 0, 0, 5] },
    },
  };

  // Use blob download to avoid browser quirks
  const pdfDoc: any = pdfMake.createPdf(testDoc);
  pdfDoc.getBlob((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tamil-font-test.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
};
