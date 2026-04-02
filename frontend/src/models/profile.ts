export interface EventSummary {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  status: string;
  category?: string;
  image_url?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  phone_number?: string;
  gender?: string;
  birth_date?: string;
  email_verified: boolean;
  status: string;
  default_location_address?: string;
  default_location_lat?: number;
  default_location_lon?: number;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  created_events?: EventSummary[];
  attended_events?: EventSummary[];
}

export interface UpdateProfileRequest {
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}
