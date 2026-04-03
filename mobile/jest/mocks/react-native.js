/** Minimal React Native DOM-friendly stub for Node/Jest tests. */
const React = require('react');

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
        ...props,
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
      ...props,
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
      ...props,
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
    ...props,
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
    ...props,
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
    ...props,
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
