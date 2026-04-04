export interface FavoriteEventItem {
  id: string;
  title: string;
  category?: string | null;
  image_url?: string | null;
  status: string;
  start_time: string;
  end_time?: string | null;
  favorited_at: string;
}

export interface FavoriteEventsResponse {
  items: FavoriteEventItem[];
}

export interface FavoriteLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
}
