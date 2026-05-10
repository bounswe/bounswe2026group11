import { useLocalSearchParams } from 'expo-router';
import EditEventView from '@/views/event/EditEventView';

export default function EditEventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditEventView eventId={id} />;
}
