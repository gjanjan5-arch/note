/**
 * Client-Side Image Compressor for Sari-Sari Store App
 * Optimizes high-resolution smartphone camera photos (5MB - 10MB)
 * down to lightweight ~600px images (~30KB - 50KB WebP/JPEG)
 * to ensure smooth rendering and fast IndexedDB storage on all mobile devices.
 */
export async function compressImage(
  fileOrDataUrl: File | Blob | string,
  maxDimension = 600,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const processLoadedImage = () => {
      try {
        let { naturalWidth: width, naturalHeight: height } = img;
        if (!width || !height) {
          width = img.width || 600;
          height = img.height || 600;
        }

        // Calculate proportional scale to fit inside maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) {
          if (typeof fileOrDataUrl === 'string') {
            resolve(fileOrDataUrl);
          } else {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(fileOrDataUrl);
          }
          return;
        }

        // Use high quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG
        let compressedDataUrl = '';
        try {
          compressedDataUrl = canvas.toDataURL('image/webp', quality);
        } catch (_) {
          compressedDataUrl = '';
        }

        if (!compressedDataUrl || !compressedDataUrl.startsWith('data:image/webp')) {
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(compressedDataUrl);
      } catch (err) {
        console.warn('[imageCompressor] Canvas compression failed, falling back to original:', err);
        if (typeof fileOrDataUrl === 'string') {
          resolve(fileOrDataUrl);
        } else {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(fileOrDataUrl);
        }
      }
    };

    img.onload = processLoadedImage;
    img.onerror = (err) => {
      console.warn('[imageCompressor] Error loading image for compression:', err);
      if (typeof fileOrDataUrl === 'string') {
        resolve(fileOrDataUrl);
      } else {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(fileOrDataUrl);
      }
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      img.src = URL.createObjectURL(fileOrDataUrl);
    }
  });
}
