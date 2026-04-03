import { uploadFileToPresignedUrl } from './eventService';

describe('uploadFileToPresignedUrl', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uploads the fetched file blob with the provided method and headers', async () => {
    const fileBlob = { mock: 'blob' };
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce({
        blob: async () => fileBlob,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
      } as unknown as Response);

    await uploadFileToPresignedUrl(
      'put',
      'https://upload.example.com/object',
      { 'Content-Type': 'image/jpeg', 'x-amz-acl': 'public-read' },
      'file:///event-image.jpg',
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'file:///event-image.jpg');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://upload.example.com/object', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', 'x-amz-acl': 'public-read' },
      body: fileBlob,
    });
  });

  it('throws a clear error when the upload request fails', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce({
        blob: async () => ({ mock: 'blob' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as unknown as Response);

    await expect(
      uploadFileToPresignedUrl(
        'PUT',
        'https://upload.example.com/object',
        { 'Content-Type': 'image/jpeg' },
        'file:///event-image.jpg',
      ),
    ).rejects.toThrow('Upload failed with status 403');
  });
});
