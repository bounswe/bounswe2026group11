import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import BottomTabBar from '@/components/common/BottomTabBar';
import MyEventCard from '@/components/events/MyEventCard';
import { useMyEventsViewModel } from '@/viewmodels/event/useMyEventsViewModel';

interface StatePanelProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

function StatePanel({
  icon,
  title,
  subtitle,
  actionLabel,
  onPressAction,
}: StatePanelProps) {
  return (
    <View style={styles.statePanel}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={24} color="#2563EB" />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateSubtitle}>{subtitle}</Text>

      {actionLabel && onPressAction ? (
        <TouchableOpacity
          accessibilityLabel={actionLabel}
          activeOpacity={0.85}
          onPress={onPressAction}
          style={styles.stateAction}
        >
          <Text style={styles.stateActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function MyEventsView() {
  const vm = useMyEventsViewModel();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>My Events</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{vm.hostedCount}</Text>
              <Text style={styles.summaryLabel}>Hosting</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{vm.attendedCount}</Text>
              <Text style={styles.summaryLabel}>Attending</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsRow}>
          {vm.statusTabs.map((tab) => {
            const active = tab.value === vm.activeStatus;

            return (
              <TouchableOpacity
                key={tab.value}
                accessibilityLabel={`Show ${tab.label} events`}
                activeOpacity={0.9}
                onPress={() => vm.setActiveStatus(tab.value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                <Text style={[styles.tabCount, active && styles.tabCountActive]}>
                  {tab.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.content}>
          {vm.isLoading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading your events...</Text>
            </View>
          ) : vm.errorMessage ? (
            <StatePanel
              icon="alert-circle"
              title="Unable to load your events"
              subtitle={vm.errorMessage}
              actionLabel={vm.canRetry ? 'Try again' : undefined}
              onPressAction={vm.canRetry ? () => void vm.reload() : undefined}
            />
          ) : vm.visibleEvents.length === 0 ? (
            <StatePanel
              icon="calendar"
              title={vm.emptyTitle}
              subtitle={vm.emptySubtitle}
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            >
              {vm.visibleEvents.map((event) => (
                <MyEventCard
                  key={event.id}
                  event={event}
                  onPress={(eventId) => router.push(`/event/${eventId}` as Href)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerSection: {
    paddingTop: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 8,
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 18,
    padding: 5,
    marginTop: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    gap: 4,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
  },
  tabCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabCountActive: {
    color: '#2563EB',
  },
  content: {
    flex: 1,
    marginTop: 18,
  },
  listContent: {
    paddingBottom: 24,
  },
  loadingPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 15,
  },
  statePanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  stateSubtitle: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  stateAction: {
    marginTop: 20,
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  stateActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
