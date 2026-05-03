import { useLocalSearchParams } from 'expo-router';
import EventActionsView from '@/views/ticket/EventActionsView';

export default function EventActionsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventActionsView eventId={id} />;
}
