import { describe, expect, it } from 'vitest';
import { shouldShowApproximateLocationIndicator } from './locationApproximation';

describe('shouldShowApproximateLocationIndicator', () => {
  it.each([
    {
      name: 'public non-participant with exact backend location',
      privacyLevel: 'PUBLIC' as const,
      isLocationApproximate: false,
      isHost: false,
      participationStatus: 'NONE',
      expected: false,
    },
    {
      name: 'public non-participant with unexpected approximate flag',
      privacyLevel: 'PUBLIC' as const,
      isLocationApproximate: true,
      isHost: false,
      participationStatus: 'NONE',
      expected: false,
    },
    {
      name: 'protected non-participant with approximate backend location',
      privacyLevel: 'PROTECTED' as const,
      isLocationApproximate: true,
      isHost: false,
      participationStatus: 'NONE',
      expected: true,
    },
    {
      name: 'protected approved participant with exact backend location',
      privacyLevel: 'PROTECTED' as const,
      isLocationApproximate: false,
      isHost: false,
      participationStatus: 'JOINED',
      expected: false,
    },
    {
      name: 'protected host with exact backend location',
      privacyLevel: 'PROTECTED' as const,
      isLocationApproximate: false,
      isHost: true,
      participationStatus: 'NONE',
      expected: false,
    },
    {
      name: 'private invited viewer with exact backend location',
      privacyLevel: 'PRIVATE' as const,
      isLocationApproximate: false,
      isHost: false,
      participationStatus: 'INVITED',
      expected: false,
    },
  ])('$name', ({ expected, ...context }) => {
    expect(shouldShowApproximateLocationIndicator(context)).toBe(expected);
  });
});
