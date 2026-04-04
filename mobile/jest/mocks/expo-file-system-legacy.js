module.exports = {
  uploadAsync: jest.fn().mockResolvedValue({
    status: 200,
    headers: {},
    body: '',
    mimeType: 'image/jpeg',
  }),
  FileSystemUploadType: {
    BINARY_CONTENT: 0,
    MULTIPART: 1,
  },
};
