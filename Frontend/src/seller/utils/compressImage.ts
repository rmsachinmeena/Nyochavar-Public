/**
 * Phone cameras make pictures of 5 to 12 MB. Before a picture is uploaded it is shrunk to at most 2000 pixels on the
 * long side (still sharp for the store) and saved as a JPEG, which makes the upload several times faster.
 * A picture that is already small is sent as it is, and if shrinking fails for any reason the original is sent.
 */
const MAX_SIDE = 2000;
const SKIP_BELOW_BYTES = 800 * 1024;
const QUALITY = 0.86;

export const compressImage = async (file: File): Promise<File> => {
  try {
    if (file.size <= SKIP_BELOW_BYTES && file.type !== 'image/png') return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    // A small PNG is kept as it is: turning it into a JPEG would lose its transparency
    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    // White behind the picture, for the parts of a PNG that are see-through
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    // Only use the shrunk copy when it really is smaller
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') || 'picture';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
};
