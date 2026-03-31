import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocationSuggestion } from '@/models/event';
import { formatEventLocation } from '@/utils/eventLocation';

interface LocationPickerPanelProps {
  visible: boolean;
  query: string;
  suggestions: LocationSuggestion[];
  isSearching: boolean;
  selectedLocation: LocationSuggestion | null;
  anchorTop: number;
  onClose: () => void;
  onReset: () => void;
  onChangeQuery: (value: string) => void;
  onSelectSuggestion: (suggestion: LocationSuggestion) => void;
  onApply: () => void;
}

export default function LocationPickerPanel({
  visible,
  query,
  suggestions,
  isSearching,
  selectedLocation,
  anchorTop,
  onClose,
  onReset,
  onChangeQuery,
  onSelectSuggestion,
  onApply,
}: LocationPickerPanelProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.popup, { top: anchorTop }]}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Choose Location</Text>

            <View style={styles.headerActions}>
              <TouchableOpacity onPress={onReset} activeOpacity={0.8}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.8}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#6B7280" />
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Search for a location"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              autoCorrect={false}
            />
          </View>

          <View style={styles.listWrapper}>
            {isSearching ? (
              <View style={styles.centered}>
                <ActivityIndicator size="small" color="#111827" />
              </View>
            ) : (
              <FlatList
                data={suggestions}
                keyExtractor={(item, index) => `${item.lat}-${item.lon}-${index}`}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected =
                    selectedLocation?.lat === item.lat &&
                    selectedLocation?.lon === item.lon;

                  return (
                    <TouchableOpacity
                      style={[styles.item, isSelected && styles.itemSelected]}
                      onPress={() => onSelectSuggestion(item)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'location-outline'}
                        size={18}
                        color={isSelected ? '#111827' : '#6B7280'}
                      />
                      <Text style={styles.itemText} numberOfLines={2}>
                        {formatEventLocation(item.display_name)}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  selectedLocation ? null : query.trim().length >= 2 ? (
                    <Text style={styles.emptyText}>No locations found.</Text>
                  ) : (
                    <Text style={styles.emptyText}>Type at least 2 characters.</Text>
                  )
                }
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={onApply}
            activeOpacity={0.85}
          >
            <Text style={styles.applyButtonText}>
              {selectedLocation ? 'Choose Location' : 'Use Default Location'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  popup: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  headerRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  searchBox: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  listWrapper: {
    maxHeight: 220,
    minHeight: 80,
  },
  centered: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 4,
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemSelected: {
    borderColor: '#111827',
    backgroundColor: '#F9FAFB',
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    marginTop: 20,
  },
  applyButton: {
    marginTop: 12,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});