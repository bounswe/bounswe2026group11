import { useLocalSearchParams } from 'expo-router';
import TicketScanView from '@/views/ticket/TicketScanView';

export default function TicketScanRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketScanView eventId={id} />;
}
