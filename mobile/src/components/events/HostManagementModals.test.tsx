/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import type {
  EventDetailInvitation,
  EventDetailPendingJoinRequest,
} from '@/models/event';
import InvitationsModal from './InvitationsModal';
import JoinRequestsModal from './JoinRequestsModal';

jest.mock('react-native', () => {
  const ReactLocal = require('react');

  const reactNativeOnlyProps = new Set([
    'accessibilityLabel',
    'accessibilityRole',
    'activeOpacity',
    'animationType',
    'autoCapitalize',
    'autoCorrect',
    'contentContainerStyle',
    'editable',
    'keyboardShouldPersistTaps',
    'maxLength',
    'multiline',
    'numberOfLines',
    'onRequestClose',
    'placeholderTextColor',
    'resizeMode',
    'showsVerticalScrollIndicator',
    'transparent',
    'visible',
  ]);

  const stripReactNativeOnlyProps = (props: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (key === 'testID') {
        out['data-testid'] = props[key];
      } else if (key === 'accessibilityLabel') {
        out['aria-label'] = props[key];
      } else if (key === 'accessibilityRole') {
        out.role = props[key];
      } else if (!reactNativeOnlyProps.has(key)) {
        out[key] = props[key];
      }
    }
    return out;
  };

  const mergeStyle = (style: unknown): React.CSSProperties | undefined => {
    if (Array.isArray(style)) {
      return style.reduce(
        (acc, item) => ({ ...acc, ...(mergeStyle(item) ?? {}) }),
        {},
      );
    }
    return style && typeof style === 'object'
      ? (style as React.CSSProperties)
      : undefined;
  };

  const createContainer =
    (tagName: string) =>
    ({ children, style, ...props }: { children?: React.ReactNode; style?: unknown }) =>
      ReactLocal.createElement(
        tagName,
        {
          style: mergeStyle(style),
          ...stripReactNativeOnlyProps(props),
        },
        children,
      );

  const createButton = ({
    children,
    onPress,
    style,
    disabled,
    ...props
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    style?: unknown;
    disabled?: boolean;
  }) =>
    ReactLocal.createElement(
      'div',
      {
        role: 'button',
        'aria-disabled': disabled,
        style: mergeStyle(style),
        onClick: disabled ? undefined : onPress,
        ...stripReactNativeOnlyProps(props),
      },
      children,
    );

  class AnimatedValue {
    value: number;

    constructor(value: number) {
      this.value = value;
    }

    setValue(nextValue: number) {
      this.value = nextValue;
    }
  }

  const FlatList = ({
    data,
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
    keyExtractor,
  }: {
    data?: unknown[];
    renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
    keyExtractor?: (item: unknown, index: number) => string;
  }) =>
    ReactLocal.createElement(
      'div',
      null,
      data && data.length > 0
        ? data.map((item, index) =>
            ReactLocal.createElement(
              'div',
              { key: keyExtractor ? keyExtractor(item, index) : index },
              renderItem({ item, index }),
            ),
          )
        : ListEmptyComponent,
      ListFooterComponent,
    );

  return {
    ActivityIndicator: createContainer('div'),
    Alert: { alert: jest.fn() },
    Animated: {
      Value: AnimatedValue,
      View: createContainer('div'),
      event: () => jest.fn(),
      timing: () => ({ start: (callback?: () => void) => callback?.() }),
      spring: () => ({ start: (callback?: () => void) => callback?.() }),
    },
    Dimensions: {
      get: () => ({ height: 900, width: 430 }),
    },
    FlatList,
    Image: ({ source, style, ...props }: { source?: { uri?: string }; style?: unknown }) =>
      ReactLocal.createElement('img', {
        src: source?.uri,
        style: mergeStyle(style),
        ...stripReactNativeOnlyProps(props),
      }),
    KeyboardAvoidingView: createContainer('div'),
    Linking: { openURL: jest.fn() },
    Modal: ({ children, visible }: { children?: React.ReactNode; visible: boolean }) =>
      visible ? ReactLocal.createElement('div', null, children) : null,
    PanResponder: {
      create: () => ({ panHandlers: {} }),
    },
    Platform: { OS: 'ios' },
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: createContainer('span'),
    TextInput: ({
      value,
      onChangeText,
      style,
      ...props
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
      style?: unknown;
    }) =>
      ReactLocal.createElement('input', {
        value,
        style: mergeStyle(style),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        ...stripReactNativeOnlyProps(props),
      }),
    TouchableOpacity: createButton,
    View: createContainer('div'),
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  const Icon = ({ name }: { name: string }) =>
    ReactLocal.createElement('span', { 'data-icon': name });

  return {
    Feather: Icon,
    MaterialIcons: Icon,
  };
});

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'host-1', username: 'host_user' },
  }),
}));

const pendingRequest: EventDetailPendingJoinRequest = {
  join_request_id: 'join-1',
  status: 'PENDING',
  message: 'I would love to join.',
  image_url: 'https://example.com/evidence.jpg',
  created_at: '2026-04-01T10:00:00+03:00',
  updated_at: '2026-04-01T10:00:00+03:00',
  user: {
    id: 'user-1',
    username: 'jane_doe',
    display_name: 'Jane Doe',
    avatar_url: null,
    rating_count: 4,
  },
};

const invitation: EventDetailInvitation = {
  invitation_id: 'inv-1',
  status: 'PENDING',
  message: null,
  expires_at: null,
  created_at: '2026-04-01T10:00:00+03:00',
  updated_at: '2026-04-01T10:00:00+03:00',
  user: {
    id: 'user-2',
    username: 'alex_lee',
    display_name: 'Alex Lee',
    avatar_url: null,
    rating_count: 6,
  },
};

describe('host management sheets', () => {
  it('renders join request management labels from i18n', () => {
    render(
      <JoinRequestsModal
        visible
        requests={[pendingRequest]}
        loading={false}
        hasMore
        onLoadMore={jest.fn()}
        onClose={jest.fn()}
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />,
    );

    expect(screen.getByText('Pending Requests (1)')).toBeTruthy();
    expect(screen.getByText('View Attachment')).toBeTruthy();
    expect(screen.getByText('Load more')).toBeTruthy();
  });

  it('renders invitation management labels from i18n', () => {
    render(
      <InvitationsModal
        visible
        invitations={[invitation]}
        loading={false}
        hasMore
        onLoadMore={jest.fn()}
        onClose={jest.fn()}
        onInvite={jest.fn().mockResolvedValue(undefined)}
        onRevoke={jest.fn().mockResolvedValue(undefined)}
        isInviting={false}
        userSearchQuery=""
        setUserSearchQuery={jest.fn()}
        userSuggestions={[]}
        isSearchingUsers={false}
      />,
    );

    expect(screen.getByText('Manage Invitations')).toBeTruthy();
    expect(screen.getByText('Invite by Username')).toBeTruthy();
    expect(screen.getByText('Current Invitations')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Load more')).toBeTruthy();
    expect(screen.queryByText(/events\.invitations/)).toBeNull();
  });
});
