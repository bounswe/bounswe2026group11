/** Minimal React Native DOM-friendly stub for Node/Jest tests. */
const React = require('react');

/**
 * Props that React Native uses but must not be forwarded to DOM nodes in jsdom
 * (react-dom warns on unknown attributes).
 */
const REACT_NATIVE_ONLY_PROPS = new Set([
  'activeOpacity',
  'allowFontScaling',
  'contentContainerStyle',
  'cursorColor',
  'ellipsizeMode',
  'keyboardDismissMode',
  'keyboardShouldPersistTaps',
  'maxFontSizeMultiplier',
  'minimumFontScale',
  'numberOfLines',
  'placeholderTextColor',
  'rejectResponderTermination',
  'scrollEventThrottle',
  'selectable',
  'selectionColor',
  'showsHorizontalScrollIndicator',
  'showsVerticalScrollIndicator',
  'textAlignVertical',
  'underlineColorAndroid',
  'adjustsFontSizeToFit',
  'clearButtonMode',
  'clearTextOnFocus',
  'collapsable',
  'delayLongPress',
  'delayPressIn',
  'delayPressOut',
  'hitSlop',
  'horizontal',
  'keyboardType',
  'nestedScrollEnabled',
  'overScrollMode',
  'pressRetentionOffset',
  'refreshControl',
  'removeClippedSubviews',
  'renderToHardwareTextureAndroid',
  'resizeMethod',
  'resizeMode',
  'scrollEnabled',
  'shouldRasterizeIOS',
  'snapToAlignment',
  'snapToInterval',
  'textContentType',
  'tvParallaxProperties',
]);

function stripReactNativeOnlyProps(props) {
  if (!props || typeof props !== 'object') {
    return props;
  }
  const out = {};
  for (const key of Object.keys(props)) {
    if (!REACT_NATIVE_ONLY_PROPS.has(key)) {
      out[key] = props[key];
    }
  }
  return out;
}

function mergeStyle(style) {
  if (Array.isArray(style)) {
    return style.reduce((acc, item) => Object.assign(acc, mergeStyle(item)), {});
  }
  return style ?? undefined;
}

function createContainer(tagName) {
  return React.forwardRef(function MockContainer(
    { children, accessibilityLabel, testID, style, ...props },
    ref,
  ) {
    return React.createElement(
      tagName,
      {
        ref,
        'aria-label': accessibilityLabel,
        'data-testid': testID,
        style: mergeStyle(style),
        ...stripReactNativeOnlyProps(props),
      },
      children,
    );
  });
}

const View = createContainer('div');
const ScrollView = createContainer('div');
const KeyboardAvoidingView = createContainer('div');

const Text = React.forwardRef(function MockText(
  { children, accessibilityLabel, testID, style, ...props },
  ref,
) {
  return React.createElement(
    'span',
    {
      ref,
      'aria-label': accessibilityLabel,
      'data-testid': testID,
      style: mergeStyle(style),
      ...stripReactNativeOnlyProps(props),
    },
    children,
  );
});

const TouchableOpacity = React.forwardRef(function MockTouchableOpacity(
  {
    children,
    onPress,
    accessibilityLabel,
    accessibilityRole,
    testID,
    style,
    disabled,
    ...props
  },
  ref,
) {
  return React.createElement(
    'button',
    {
      ref,
      type: 'button',
      role: accessibilityRole,
      'aria-label': accessibilityLabel,
      'data-testid': testID,
      style: mergeStyle(style),
      disabled,
      onClick: disabled ? undefined : onPress,
      ...stripReactNativeOnlyProps(props),
    },
    children,
  );
});

const TextInput = React.forwardRef(function MockTextInput(
  {
    value,
    onChangeText,
    onSubmitEditing,
    placeholder,
    accessibilityLabel,
    testID,
    style,
    editable = true,
    multiline,
    ...props
  },
  ref,
) {
  const commonProps = {
    ref,
    value,
    placeholder,
    'aria-label': accessibilityLabel,
    'data-testid': testID,
    style: mergeStyle(style),
    disabled: !editable,
    onChange: onChangeText
      ? (event) => onChangeText(event.target.value)
      : undefined,
    onKeyDown: onSubmitEditing
      ? (event) => {
          if (event.key === 'Enter') {
            onSubmitEditing({ nativeEvent: { text: value } });
          }
        }
      : undefined,
    ...stripReactNativeOnlyProps(props),
  };

  return multiline
    ? React.createElement('textarea', commonProps)
    : React.createElement('input', commonProps);
});

const Image = React.forwardRef(function MockImage(
  { source, accessibilityLabel, testID, style, ...props },
  ref,
) {
  return React.createElement('img', {
    ref,
    src: source?.uri,
    alt: accessibilityLabel ?? '',
    'data-testid': testID,
    style: mergeStyle(style),
    ...stripReactNativeOnlyProps(props),
  });
});

const ActivityIndicator = React.forwardRef(function MockActivityIndicator(
  { accessibilityLabel, testID, style, ...props },
  ref,
) {
  return React.createElement('div', {
    ref,
    role: 'progressbar',
    'aria-label': accessibilityLabel,
    'data-testid': testID,
    style: mergeStyle(style),
    ...stripReactNativeOnlyProps(props),
  });
});

module.exports = {
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: (spec) => spec.ios,
  },
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet: {
    create: (styles) => styles,
  },
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
};
