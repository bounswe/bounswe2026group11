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
  Linking,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EventDetailPendingJoinRequest } from '@/models/event';
import { useTheme, type Theme } from '@/theme';

interface JoinRequestsModalProps {
  visible: boolean;
  requests: EventDetailPendingJoinRequest[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onClose: () => void;
  onApprove: (joinRequestId: string) => void;
  onReject: (joinRequestId: string) => void;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function JoinRequestsModal({
  visible,
  requests,
  loading,
  hasMore,
  onLoadMore,
  onClose,
  onApprove,
  onReject,
}: JoinRequestsModalProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
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
            <Text style={styles.title}>
              {t('events.joinRequests.title', { count: requests.length })}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={requests}
            keyExtractor={(item) => item.join_request_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.requestRow} testID={`join-request-row-${item.user.username}`}>
                <TouchableOpacity 
                  style={styles.userInfoTouchable}
                  onPress={() => {
                    onClose();
                    router.push(`/user/${item.user.id}` as Href);
                  }}
                >
                  {item.user.avatar_url ? (
                    <Image
                      source={{ uri: item.user.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Feather name="user" size={20} color={theme.textTertiary} />
                    </View>
                  )}

                  <View style={styles.info}>
                    <Text style={styles.name}>
                      {item.user.display_name || item.user.username}
                    </Text>
                    <Text style={styles.username}>@{item.user.username}</Text>
                    {item.message ? (
                      <Text style={styles.message}>
                        "{item.message}"
                      </Text>
                    ) : null}

                    {item.image_url ? (
                      <TouchableOpacity
                        style={styles.attachmentLink}
                        onPress={() => item.image_url && setPreviewImage(item.image_url)}
                      >
                        <Feather name="image" size={14} color={theme.infoText} />
                        <Text style={styles.attachmentLinkText}>
                          {t('events.joinRequests.viewAttachment')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => onReject(item.join_request_id)}
                    testID={`join-request-reject-${item.user.username}`}
                  >
                    <Feather name="x" size={20} color={theme.errorText} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => onApprove(item.join_request_id)}
                    testID={`join-request-approve-${item.user.username}`}
                  >
                    <Feather name="check" size={20} color={theme.successText} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {loading
                  ? t('events.joinRequests.loading')
                  : t('events.joinRequests.empty')}
              </Text>
            }
            ListFooterComponent={
              hasMore ? (
                <TouchableOpacity style={styles.loadMoreBtn} onPress={onLoadMore}>
                  <Text style={styles.loadMoreText}>{t('common.loadMore')}</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </Animated.View>
      </TouchableOpacity>

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <TouchableOpacity
          style={styles.previewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}
        >
          <View style={styles.previewContainer}>
            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.closePreviewBtn}
              onPress={() => setPreviewImage(null)}
            >
              <Feather name="x" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: t.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: t.surface,
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
    backgroundColor: t.borderStrong,
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
    color: t.text,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingBottom: 40,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  userInfoTouchable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: t.surfaceVariant,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: t.surfaceVariant,
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
    color: t.text,
  },
  username: {
    fontSize: 14,
    color: t.textSecondary,
    marginTop: 2,
  },
  message: {
    marginTop: 4,
    fontStyle: 'italic',
    color: t.textSecondary,
  },
  attachmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: t.infoBg,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  attachmentLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: t.infoText,
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
    backgroundColor: t.errorBg,
  },
  approveBtn: {
    backgroundColor: t.successBg,
  },
  empty: {
    textAlign: 'center',
    color: t.textSecondary,
    marginTop: 32,
    fontSize: 15,
  },
  loadMoreBtn: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: t.infoBg,
  },
  loadMoreText: {
    color: t.infoText,
    fontWeight: '600',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_HEIGHT * 0.8,
  },
  closePreviewBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  });
}
