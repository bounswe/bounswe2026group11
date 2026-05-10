import { isActiveEventParticipantStatus, type PrivacyLevel } from '@/models/event';

interface ApproximateLocationContext {
  privacyLevel: PrivacyLevel;
  isLocationApproximate: boolean;
  isHost: boolean;
  participationStatus: string;
}

export const APPROXIMATE_LOCATION_RADIUS_METERS = 250;

export function shouldShowApproximateLocationIndicator({
  privacyLevel,
  isLocationApproximate,
  isHost,
  participationStatus,
}: ApproximateLocationContext): boolean {
  if (!isLocationApproximate) return false;
  if (privacyLevel !== 'PROTECTED') return false;
  if (isHost) return false;
  return !isActiveEventParticipantStatus(participationStatus);
}

export function getApproximateLocationText(hasAddress: boolean): string {
  return hasAddress
    ? 'Approximate location'
    : 'Approximate area shown. Exact address is visible after approval.';
}
