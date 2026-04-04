import React from 'react';
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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EventDetailPendingJoinRequest } from '@/models/event';

interface JoinRequestsModalProps {
  visible: boolean;
  requests: EventDetailPendingJoinRequest[];
  onClose: () => void;
  onApprove: (joinRequestId: string) => void;
  onReject: (joinRequestId: string) => void;
}

export default function JoinRequestsModal({
  visible,
  requests,
  onClose,
  onApprove,
  onReject,
}: JoinRequestsModalProps) {
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
    if (visible) panY.setValue(0);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
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
            <Text style={styles.title}>Pending Requests ({requests.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={requests}
            keyExtractor={(item) => item.join_request_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.requestRow}>
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
                  {item.message ? (
                    <Text style={styles.message} numberOfLines={2}>
                      "{item.message}"
                    </Text>
                  ) : null}
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => onReject(item.join_request_id)}
                  >
                    <Feather name="x" size={20} color="#DC2626" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => onApprove(item.join_request_id)}
                  >
                    <Feather name="check" size={20} color="#16A34A" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No pending requests.</Text>
            }
          />
        </Animated.View>
      </TouchableOpacity>
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
    maxHeight: '80%',
    minHeight: '40%',
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
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingBottom: 40,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  username: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  message: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
  },
  approveBtn: {
    backgroundColor: '#DCFCE7',
  },
  empty: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 32,
    fontSize: 15,
  },
});
