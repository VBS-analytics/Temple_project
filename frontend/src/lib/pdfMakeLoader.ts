import type { TDocumentDefinitions } from 'pdfmake/interfaces';

declare global {
  interface Window {
    pdfMake?: {
      createPdf: (documentDefinition: TDocumentDefinitions) => {
        download: (fileName: string) => void;
      };
    };
  }
}

let pdfMakeLoaded = false;

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

  return window.pdfMake;
};
