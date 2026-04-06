// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareAvatarBlobs } from './imageResize';

function makeFile(name = 'avatar.jpg', type = 'image/jpeg'): File {
  return new File(['data'], name, { type });
}

beforeEach(() => {
  // Mock URL.createObjectURL / revokeObjectURL
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  });

  // Mock Image load
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 800;
    height = 600;
    set src(_: string) {
      this.onload?.();
    }
  });

  // Mock canvas
  const mockBlob = new Blob(['img'], { type: 'image/jpeg' });
  const mockCtx = { drawImage: vi.fn() };
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
        toBlob: (cb: (b: Blob | null) => void) => cb(mockBlob),
      } as unknown as HTMLElement;
    }
    return document.createElement(tag);
  });
});

describe('prepareAvatarBlobs', () => {
  it('returns original and small blobs', async () => {
    const file = makeFile();
    const result = await prepareAvatarBlobs(file);

    expect(result.original).toBeInstanceOf(Blob);
    expect(result.small).toBeInstanceOf(Blob);
  });

  it('works with png files', async () => {
    const file = makeFile('avatar.png', 'image/png');
    const result = await prepareAvatarBlobs(file);

    expect(result.original).toBeInstanceOf(Blob);
    expect(result.small).toBeInstanceOf(Blob);
  });
});
