import type { LocationSuggestion } from '@/models/event';

export type HomeLocationSelectionMode = 'DEFAULT' | 'CUSTOM';

export interface HomeLocationSelectionState {
  mode: HomeLocationSelectionMode;
  location: LocationSuggestion | null;
}

const DEFAULT_SELECTION_STATE: HomeLocationSelectionState = {
  mode: 'DEFAULT',
  location: null,
};

const selectionsByScope = new Map<string, HomeLocationSelectionState>();

export function getHomeLocationSelection(
  scope: string,
): HomeLocationSelectionState {
  return selectionsByScope.get(scope) ?? DEFAULT_SELECTION_STATE;
}

export function setHomeLocationSelection(
  scope: string,
  selection: HomeLocationSelectionState,
): void {
  selectionsByScope.set(scope, selection);
}

export function clearHomeLocationSelection(scope: string): void {
  selectionsByScope.delete(scope);
}

export function __resetHomeLocationSelectionStoreForTests(): void {
  selectionsByScope.clear();
}
