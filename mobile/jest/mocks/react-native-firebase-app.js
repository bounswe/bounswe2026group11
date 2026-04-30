/** Jest stub — native Firebase is not available in Node. */
module.exports = {
  __esModule: true,
  default: {
    app: () => ({
      name: '[DEFAULT]',
    }),
  },
};
