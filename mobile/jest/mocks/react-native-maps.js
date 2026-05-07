const React = require('react');

/**
 * Props that MapView uses but must not be forwarded to DOM nodes in jsdom
 * (react-dom warns on unknown attributes).
 */
const MAP_ONLY_PROPS = new Set([
  'customMapStyle',
  'scrollEnabled',
  'zoomEnabled',
  'pitchEnabled',
  'rotateEnabled',
  'region',
  'initialRegion',
  'coordinate',
  'provider',
  'mapPadding',
  'anchor',
  'tracksViewChanges',
  'tooltip',
  'identifier',
  'zIndex',
  'onDeselect',
  'stopPropagation',
  'onPress',
]);

function stripMapOnlyProps(props) {
  if (!props || typeof props !== 'object') {
    return props;
  }
  const out = {};
  if (typeof props.onPress === 'function') {
    out.onClick = props.onPress;
  }

  for (const key of Object.keys(props)) {
    if (!MAP_ONLY_PROPS.has(key)) {
      out[key] = props[key];
    }
  }
  return out;
}

function createMockComponent(tagName) {
  return React.forwardRef(function MockComponent(
    { children, testID, ...props },
    ref,
  ) {
    return React.createElement(
      tagName,
      {
        ref,
        'data-testid': testID,
        ...stripMapOnlyProps(props),
      },
      children,
    );
  });
}

const MapView = createMockComponent('div');
const Marker = createMockComponent('div');
const Callout = createMockComponent('div');
const Polyline = createMockComponent('div');

module.exports = {
  __esModule: true,
  default: MapView,
  Marker,
  Callout,
  Polyline,
  PROVIDER_GOOGLE: 'google',
};
