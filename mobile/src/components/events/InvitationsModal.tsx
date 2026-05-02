import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Animated,
  PanResponder,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { EventDetailInvitation } from '@/models/event';

interface InvitationsModalProps {
  visible: boolean;
  invitations: EventDetailInvitation[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onClose: () => void;
  onInvite: (usernames: string[], message?: string) => Promise<void>;
  isInviting: boolean;
  userSearchQuery: string;
  setUserSearchQuery: (query: string) => void;
  userSuggestions: any[];
  isSearchingUsers: boolean;
}

export default function InvitationsModal({
  visible,
  invitations,
  loading,
  hasMore,
  onLoadMore,
  onClose,
  onInvite,
  isInviting,
  userSearchQuery,
  setUserSearchQuery,
  userSuggestions,
  isSearchingUsers,
}: InvitationsModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');

  const panY = React.useRef(new Animated.Value(0)).current;

  const resetPositionAnim = Animated.spring(panY, {
    toValue: 0,
    useNativeDriver: true,
  });

  const closeAnim = Animated.timing(panY, {
    toValue: 1000,
    duration: 200,
    useNativeDriver: true,
  });

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
      onPanResponderMove: Animated.event([null, { dy: panY }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeAnim.start(() => onClose());
        } else {
          resetPositionAnim.start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (visible) {
      panY.setValue(0);
      setUserSearchQuery('');
      setError(null);
    }
  }, [visible, setUserSearchQuery]);

  const handleInvite = async () => {
    if (!userSearchQuery.trim()) return;
    setError(null);
    try {
      const usernames = userSearchQuery
        .split(/[ ,]+/)
        .map((u) => u.trim().replace(/^@/, ''))
        .filter((u) => u.length > 0);

      if (usernames.length === 0) return;

      await onInvite(usernames, inviteMessage.trim() || undefined);
      setUserSearchQuery('');
      setInviteMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    }
  };

  const handleSelectSuggestion = (username: string) => {
    // Replace the last typed username part with the selected one
    const parts = userSearchQuery.split(/[ ,]+/);
    parts[parts.length - 1] = username;
    setUserSearchQuery(parts.join(', ') + ', ');
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return { bg: '#DCFCE7', text: '#16A34A', label: 'Accepted' };
      case 'DECLINED':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'Declined' };
      default:
        return { bg: '#FEF3C7', text: '#D97706', label: 'Pending' };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View
            style={[
              styles.container,
              { transform: [{ translateY: panY }] },
            ]}
          >
            <View {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>
            
            <View style={styles.header}>
              <Text style={styles.title}>Manage Invitations</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* Invite Form */}
            <View style={styles.inviteForm}>
              <Text style={styles.label}>Invite by Username</Text>
              <View style={styles.inputWrapper}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[styles.input, !!error && styles.inputError]}
                    placeholder="e.g. janesmith, bob"
                    placeholderTextColor="#9CA3AF"
                    value={userSearchQuery}
                    onChangeText={(val) => {
                      setUserSearchQuery(val);
                      if (error) setError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isInviting}
                  />
                  {userSuggestions && userSuggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      {userSuggestions.map((user) => (
                        <TouchableOpacity
                          key={user.id}
                          style={styles.suggestionItem}
                          onPress={() => handleSelectSuggestion(user.username)}
                        >
                          <Text style={styles.suggestionText}>@{user.username}</Text>
                          {user.display_name && (
                            <Text style={styles.suggestionSubtext}>{user.display_name}</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.inviteBtn, (!userSearchQuery.trim() || isInviting) && styles.inviteBtnDisabled]}
                  onPress={handleInvite}
                  disabled={!userSearchQuery.trim() || isInviting}
                >
                  {isInviting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.inviteBtnText}>Invite</Text>
                  )}
                </TouchableOpacity>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Text style={styles.hint}>Separate usernames with a space or comma.</Text>

              <View style={styles.messageInputContainer}>
                <Text style={styles.label}>Add a Note (Optional)</Text>
                <TextInput
                  style={styles.messageInput}
                  placeholder="e.g. Hope to see you there!"
                  placeholderTextColor="#9CA3AF"
                  value={inviteMessage}
                  onChangeText={setInviteMessage}
                  multiline
                  numberOfLines={2}
                  maxLength={200}
                  editable={!isInviting}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <FlatList
              data={invitations}
              keyExtractor={(item) => item.invitation_id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const status = getStatusStyle(item.status);
                return (
                  <View style={styles.invitationRow}>
                    {item.user.avatar_url ? (
                      <Image
                        source={{ uri: item.user.avatar_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Feather name="user" size={20} color="#9CA3AF" />
                      </View>
                    )}

                    <View style={styles.info}>
                      <Text style={styles.name}>
                        {item.user.display_name || item.user.username}
                      </Text>
                      <Text style={styles.username}>@{item.user.username}</Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusText, { color: status.text }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="mail-outline" size={40} color="#D1D5DB" />
                  <Text style={styles.emptyText}>
                    {loading ? 'Loading invitations...' : 'No invitations sent yet.'}
                  </Text>
                </View>
              }
              ListFooterComponent={
                hasMore ? (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={onLoadMore}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#6366F1" />
                    ) : (
                      <Text style={styles.loadMoreText}>Load more</Text>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
    minHeight: '50%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  inviteForm: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 56,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inviteBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingHorizontal: 24,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  inviteBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  messageInputContainer: {
    marginTop: 16,
  },
  messageInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
    minHeight: 60,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 1000,
    elevation: 5,
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  suggestionSubtext: {
    fontSize: 13,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
  },
  list: {
    paddingBottom: 40,
  },
  invitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  username: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 12,
    fontSize: 15,
  },
  loadMoreBtn: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F5F3FF',
  },
  loadMoreText: {
    color: '#7C3AED',
    fontWeight: '600',
  },
});
