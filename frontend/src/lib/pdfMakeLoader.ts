import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { TAMIL_FONT_NAME, TAMIL_FONT_FILE, TAMIL_FONT_DATA_BASE64 } from './pdfMakeTamilFont';

declare global {
  interface Window {
    pdfMake?: {
      createPdf: (documentDefinition: TDocumentDefinitions) => {
        download: (fileName: string) => void;
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
    };
  }
}

let pdfMakeLoaded = false;
let tamilFontRegistered = false;

const registerTamilFont = () => {
  if (tamilFontRegistered) {
    return;
  }
  if (!window.pdfMake) {
    return;
  }
  if (window.pdfMake.fonts?.[TAMIL_FONT_NAME]) {
    tamilFontRegistered = true;
    return;
  }

  window.pdfMake.vfs = window.pdfMake.vfs ?? {};
  window.pdfMake.vfs[TAMIL_FONT_FILE] = TAMIL_FONT_DATA_BASE64;
  window.pdfMake.fonts = window.pdfMake.fonts ?? {};
  window.pdfMake.fonts[TAMIL_FONT_NAME] = {
    normal: TAMIL_FONT_FILE,
    bold: TAMIL_FONT_FILE,
    italics: TAMIL_FONT_FILE,
    bolditalics: TAMIL_FONT_FILE,
  };
  tamilFontRegistered = true;
};

export const PDF_TAMIL_FONT_NAME = TAMIL_FONT_NAME;

export const loadPdfMake = async () => {
  if (!pdfMakeLoaded) {
    const script1 = document.createElement('script');
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
    script1.async = true;

    const script2 = document.createElement('script');
    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js';
    script2.async = true;

    await new Promise<void>((resolve) => {
      script1.onload = () => {
        document.head.appendChild(script2);
        script2.onload = () => {
          pdfMakeLoaded = true;
          resolve();
        };
      };
      document.head.appendChild(script1);
    });
  }

  if (!window.pdfMake) {
    throw new Error('PDFMake failed to load');
  }

  registerTamilFont();

  return window.pdfMake;
};
