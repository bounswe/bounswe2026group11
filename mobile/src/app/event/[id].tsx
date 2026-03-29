import { useLocalSearchParams } from 'expo-router';
import EventDetailView from '@/views/event/EventDetailView';

export default function EventDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventDetailView eventId={id} />;
}
