import * as FileSystem from 'expo-file-system/legacy';
import { uploadFileToPresignedUrl } from './eventService';

jest.mock('expo-file-system/legacy');

describe('uploadFileToPresignedUrl', () => {
  const mockUploadAsync = jest.mocked(FileSystem.uploadAsync);

  beforeEach(() => {
    mockUploadAsync.mockResolvedValue({
      status: 200,
      headers: {},
      body: '',
      mimeType: 'image/jpeg',
    });
  });

  it('uploads the local file with the provided method and headers', async () => {
    await uploadFileToPresignedUrl(
      'put',
      'https://upload.example.com/object',
      { 'Content-Type': 'image/jpeg', 'x-amz-acl': 'public-read' },
      'file:///event-image.jpg',
    );

    expect(mockUploadAsync).toHaveBeenCalledWith('https://upload.example.com/object', 'file:///event-image.jpg', {
      httpMethod: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', 'x-amz-acl': 'public-read' },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
  });

  it('throws a clear error when the upload request fails', async () => {
    mockUploadAsync.mockResolvedValueOnce({
      status: 403,
      headers: {},
      body: '',
      mimeType: 'image/jpeg',
    });

    await expect(
      uploadFileToPresignedUrl(
        'PUT',
        'https://upload.example.com/object',
        { 'Content-Type': 'image/jpeg' },
        'file:///event-image.jpg',
      ),
    ).rejects.toThrow('Upload failed with status 403');
  });

  it('throws a clear error for unsupported upload methods', async () => {
    await expect(
      uploadFileToPresignedUrl(
        'DELETE',
        'https://upload.example.com/object',
        { 'Content-Type': 'image/jpeg' },
        'file:///event-image.jpg',
      ),
    ).rejects.toThrow('Unsupported upload method: DELETE');

    expect(mockUploadAsync).not.toHaveBeenCalled();
  });
});
