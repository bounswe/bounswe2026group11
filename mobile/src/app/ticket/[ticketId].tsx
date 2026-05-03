import { useLocalSearchParams } from 'expo-router';
import TicketView from '@/views/ticket/TicketView';

export default function TicketRoute() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  return <TicketView ticketId={ticketId} />;
}
