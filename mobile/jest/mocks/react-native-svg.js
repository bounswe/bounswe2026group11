const React = require('react');

function createSvgNode(tagName) {
  return React.forwardRef(function MockSvgNode(
    { children, testID, ...props },
    ref,
  ) {
    return React.createElement(
      tagName,
      {
        ref,
        'data-testid': testID,
        ...props,
      },
      children,
    );
  });
}

module.exports = {
  __esModule: true,
  default: createSvgNode('svg'),
  Svg: createSvgNode('svg'),
  SvgXml: createSvgNode('svg'),
  G: createSvgNode('g'),
  Path: createSvgNode('path'),
  Text: createSvgNode('text'),
};
