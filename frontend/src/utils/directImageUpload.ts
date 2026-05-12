import type { ImageUploadInitResponse } from '@/models/profile';

export async function uploadImageVariants(
  uploadInit: ImageUploadInitResponse,
  blobs: { original: Blob; small: Blob },
): Promise<void> {
  for (const instruction of uploadInit.uploads) {
    const blob = instruction.variant === 'ORIGINAL' ? blobs.original : blobs.small;

    let response: Response;
    try {
      response = await fetch(instruction.url, {
        method: instruction.method,
        mode: 'cors',
        headers: instruction.headers,
        body: blob,
      });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Image upload was blocked before reaching storage. Check Spaces CORS allows PUT from this web origin with Content-Type, Cache-Control, and x-amz-acl headers.',
        );
      }
      throw err;
    }

    if (!response.ok) {
      throw new Error(`Image upload failed (${instruction.variant}, ${response.status}).`);
    }
  }
}
