type ShareImageFileOptions = {
  url: string;
  filename: string;
  title: string;
  text: string;
};

const buildShareData = async ({ url, filename, title, text }: ShareImageFileOptions) => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    throw new Error('Web Share API is not available');
  }

  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error('Unable to load share asset');
  }

  const blob = await response.blob();
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

  const shareData: ShareData & { files?: File[] } = {
    title,
    text,
  };

  if (navigator.canShare?.({ files: [file] })) {
    shareData.files = [file];
  } else {
    shareData.url = url;
  }

  return shareData;
};

export const shareImageFile = async (options: ShareImageFileOptions) => {
  const shareData = await buildShareData(options);
  await navigator.share(shareData);
};
