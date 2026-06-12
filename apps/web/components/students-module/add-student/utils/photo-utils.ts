const MAX_PHOTO_DIMENSION = 512;
const JPEG_QUALITY = 0.85;
const MAX_PERSIST_BYTES = 450_000;

export function isPersistablePhotoUrl(url: string | undefined | null): boolean {
  return Boolean(url?.startsWith('data:image/'));
}

export function isEphemeralPhotoUrl(url: string | undefined | null): boolean {
  return Boolean(url?.startsWith('blob:'));
}

/** Resize and encode as JPEG data URL for draft persistence + later upload. */
export function readImageFileAsDraftPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose a JPEG, PNG, or WebP image.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(img.width, img.height, 1));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not process the image.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          let quality = JPEG_QUALITY;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > MAX_PERSIST_BYTES && quality > 0.45) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(dataUrl);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Could not process the image.'));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function dataUrlToPhotoFile(dataUrl: string, filename = 'photo.jpg'): File | null {
  if (!dataUrl.startsWith('data:')) return null;
  const [header, base64 = ''] = dataUrl.split(',');
  const mime = header?.match(/data:(.*?);base64/)?.[1] ?? 'image/jpeg';
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}

export function revokePhotoPreviewUrl(url: string | undefined | null) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
