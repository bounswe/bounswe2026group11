import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { EquipmentItem } from '@/models/profile';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface EquipmentListProps {
  equipment: EquipmentItem[];
  onEdit?: (item: EquipmentItem) => void;
  onDelete?: (id: string) => void;
  isOwner?: boolean;
}

export default function EquipmentList({ equipment, onEdit, onDelete, isOwner }: EquipmentListProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  if (equipment.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('publicProfile.empty.equipment')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {equipment.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={styles.iconBox}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.image} />
              ) : (
                <Ionicons name="construct-outline" size={24} color={theme.primaryAlt} />
              )}
            </View>
            <View style={styles.itemTextContent}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
              ) : null}
            </View>
            {isOwner && (
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => onEdit?.(item)} style={styles.actionButton}>
                  <Ionicons name="pencil" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete?.(item.id)} style={styles.actionButton}>
                  <Ionicons name="trash-outline" size={18} color={theme.errorText} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    gap: 12,
    paddingVertical: 8,
  },
  itemCard: {
    backgroundColor: t.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    padding: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemTextContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: t.text,
  },
  itemDescription: {
    fontSize: 13,
    color: t.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 8,
  },
  actionButton: {
    padding: 4,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    color: t.textSecondary,
    fontWeight: '500',
  },
});
