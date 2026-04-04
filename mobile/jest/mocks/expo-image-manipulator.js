module.exports = {
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file:///mock-manipulated.jpg' }),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
};
