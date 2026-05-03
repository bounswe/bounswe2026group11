import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ReceivedInvitation } from '@/models/invitation';
import { formatEventDateLabel } from '@/utils/eventDate';

interface InvitationCardProps {
  invitation: ReceivedInvitation;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onPress?: (eventId: string) => void;
  isActionLoading?: boolean;
}

export default function InvitationCard({
  invitation,
  onAccept,
  onDecline,
  onPress,
  isActionLoading,
}: InvitationCardProps) {
  const { event, host, message } = invitation;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.mainContent}
        onPress={() => onPress?.(event.id)}
      >
        <View style={styles.imageWrapper}>
          {event.image_url ? (
            <Image
              source={{ uri: event.image_url }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Feather name="calendar" size={28} color="#94A3B8" />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.statusBadgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: '#EDE9FE' }]}>
                <Text style={[styles.statusBadgeText, { color: '#5B21B6' }]}>
                  Invited
                </Text>
              </View>

              <View style={[styles.privacyBadge, styles.privacyBadgePrivate]}>
                <Feather name="lock" size={10} color="#5B21B6" />
                <Text style={[styles.privacyBadgeText, styles.privacyBadgeTextPrivate]}>
                  Private
                </Text>
              </View>
            </View>

            <View style={styles.hostPill}>
              <Feather name="user" size={12} color="#334155" />
              <Text style={styles.hostPillText} numberOfLines={1}>
                {host.display_name || host.username}
              </Text>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>

          <View style={styles.metaGroup}>
            <View style={styles.metaRow}>
              <Feather name="clock" size={16} color="#64748B" />
              <Text style={styles.metaText}>
                {formatEventDateLabel(event.start_time)}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Feather name="map-pin" size={16} color="#64748B" />
              <Text style={styles.metaText}>
                Location available on event page
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {message && (
        <View style={styles.messageBox}>
          <Text style={styles.messageLabel}>Note from host:</Text>
          <Text style={styles.messageText}>"{message}"</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => onDecline(invitation.invitation_id)}
          disabled={isActionLoading}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => onAccept(invitation.invitation_id)}
          disabled={isActionLoading}
        >
          {isActionLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  mainContent: {
    flexDirection: 'row',
    gap: 14,
  },
  imageWrapper: {
    width: 108,
    height: 128,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  privacyBadgePrivate: {
    backgroundColor: '#EDE9FE',
  },
  privacyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  privacyBadgeTextPrivate: {
    color: '#5B21B6',
  },
  hostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hostPillText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 70,
  },
  title: {
    marginTop: 10,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  metaGroup: {
    marginTop: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metaText: {
    flex: 1,
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  messageBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  declineButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  acceptButton: {
    backgroundColor: '#111827',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
