export type ScanFilter = 'auto' | 'bw' | 'color' | 'original';

/**
 * Process an image to look like a scanned document.
 * Uses Canvas API for contrast/brightness/grayscale enhancement.
 */
export function processScannedImage(
  dataUrl: string,
  filter: ScanFilter = 'auto'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }

      // Use original dimensions (capped for performance)
      const maxDim = 2400;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      if (filter === 'original') {
        resolve(canvas.toDataURL('image/jpeg', 0.92));
        return;
      }

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      if (filter === 'bw') {
        // High-contrast black & white scan effect
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // Adaptive threshold for document scanning
          const val = gray > 140 ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
      } else if (filter === 'color') {
        // Enhanced color scan: boost contrast + saturation + brightness
        for (let i = 0; i < data.length; i += 4) {
          for (let c = 0; c < 3; c++) {
            let val = data[i + c];
            // Increase contrast (factor 1.5 centered at 128)
            val = ((val - 128) * 1.5) + 128;
            // Slight brightness boost
            val += 15;
            data[i + c] = Math.max(0, Math.min(255, val));
          }
        }
      } else {
        // 'auto' — document-optimized: high contrast grayscale
        for (let i = 0; i < data.length; i += 4) {
          let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // Boost contrast strongly
          gray = ((gray - 128) * 1.8) + 128;
          // Brighten whites
          gray += 20;
          gray = Math.max(0, Math.min(255, gray));
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Failed to load image for processing'));
    img.src = dataUrl;
  });
}
