export type EventLifecycleVariant = 'upcoming' | 'in_progress';
export type EventCardBadgeVariant = EventLifecycleVariant | 'canceled' | 'completed';

export interface EventLifecyclePresentation {
  label: string;
  variant: EventLifecycleVariant;
}

export interface EventCardBadgePresentation {
  label: string;
  variant: EventCardBadgeVariant;
}

/** Labels and styling for ACTIVE (shown as UPCOMING) and IN_PROGRESS on cards and detail. */
export function getEventLifecyclePresentation(status: string): EventLifecyclePresentation | null {
  if (status === 'ACTIVE') {
    return { label: 'UPCOMING', variant: 'upcoming' };
  }
  if (status === 'IN_PROGRESS') {
    return { label: 'IN PROGRESS', variant: 'in_progress' };
  }
  return null;
}

export function getEventCardBadgePresentation(status: string): EventCardBadgePresentation | null {
  if (status === 'ACTIVE') {
    return { label: 'UPCOMING', variant: 'upcoming' };
  }
  if (status === 'IN_PROGRESS') {
    return { label: 'IN PROGRESS', variant: 'in_progress' };
  }
  if (status === 'CANCELED') {
    return { label: 'CANCELED', variant: 'canceled' };
  }
  if (status === 'COMPLETED') {
    return { label: 'COMPLETED', variant: 'completed' };
  }
  return null;
}

export interface EventStatusPresentation {
  label: string;
  tone: 'active' | 'canceled' | 'completed';
}

export function getEventStatusPresentation(status: string): EventStatusPresentation {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', tone: 'active' };
    case 'IN_PROGRESS':
      return { label: 'In Progress', tone: 'active' };
    case 'CANCELED':
      return { label: 'Canceled', tone: 'canceled' };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'completed' };
    default:
      return {
        label: status
          .toLowerCase()
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        tone: 'completed',
      };
  }
}

export function shouldShowProfileEvent(status: string): boolean {
  return status !== 'ACTIVE';
}
