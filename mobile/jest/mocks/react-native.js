/** Minimal stub so modules that import `react-native` can load in Node/Jest. */
module.exports = {
  Platform: {
    OS: 'ios',
    select: (spec) => spec.ios,
  },
};
