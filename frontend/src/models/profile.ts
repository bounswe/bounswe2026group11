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
}

export interface UpdateProfileRequest {
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}

export interface ImageUploadInstruction {
  variant: 'ORIGINAL' | 'SMALL';
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
}

export interface ImageUploadInitResponse {
  base_url: string;
  version: number;
  confirm_token: string;
  uploads: ImageUploadInstruction[];
}

export interface ImageUploadConfirmRequest {
  confirm_token: string;
}
