import { API_BASE_URL } from '@/config/apiBaseUrl';
import { ErrorResponse } from '@/models/auth';

export const BASE_URL = API_BASE_URL;

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, string>;

  constructor(status: number, body: ErrorResponse) {
    super(body.error.message);
    this.name = 'ApiError';
    this.code = body.error.code;
    this.status = status;
    this.details = body.error.details;
  }
}

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody: ErrorResponse = await response.json();
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
