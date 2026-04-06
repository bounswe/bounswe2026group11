const SMALL_SIZE = 200;

function resizeToJpeg(file: File, maxDimension: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Failed to convert image'));
          resolve(blob);
        },
        'image/jpeg',
        0.9,
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export async function prepareAvatarBlobs(
  file: File,
): Promise<{ original: Blob; small: Blob }> {
  const [original, small] = await Promise.all([
    resizeToJpeg(file, 1200),
    resizeToJpeg(file, SMALL_SIZE),
  ]);
  return { original, small };
}
