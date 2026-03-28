export type PrivacyLevel = 'PUBLIC' | 'PROTECTED' | 'PRIVATE';

export type LocationType = 'POINT' | 'ROUTE';

export type PreferredGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface EventConstraint {
  type: string;
  info: string;
}

export interface CreateEventRequest {
  title: string;
  description: string;
  image_url?: string;
  category_id: number;
  address?: string;
  lat?: number;
  lon?: number;
  location_type: LocationType;
  start_time: string;
  end_time?: string;
  capacity?: number;
  privacy_level: PrivacyLevel;
  tags?: string[];
  constraints?: EventConstraint[];
  minimum_age?: number;
  preferred_gender?: PreferredGender;
}

export interface CreateEventResponse {
  id: string;
  title: string;
  privacy_level: PrivacyLevel;
  status: string;
  start_time: string;
  end_time?: string;
  created_at: string;
}

export interface EventCategory {
  id: number;
  name: string;
}

export interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}
