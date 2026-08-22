import axios from 'axios';
import {
  JourneyResponse,
  ContextUpdateEvent,
  ContextUpdateResponse,
  Location,
  PublicToilet,
  WashroomFacility,
} from '../types/api';

// Use Expo environment variable or fallback to localhost
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const sakhiApi = {
  getPublicToilets: async (origin?: Location | null): Promise<PublicToilet[]> => {
    const params = origin
      ? { lat: origin.latitude, lon: origin.longitude }
      : undefined;
    const response = await apiClient.get<PublicToilet[]>('/amenities/public-toilets', { params });
    return response.data;
  },

  getWashroomFacilities: async (origin?: Location | null): Promise<WashroomFacility[]> => {
    const params = origin
      ? { lat: origin.latitude, lon: origin.longitude }
      : undefined;
    const response = await apiClient.get<WashroomFacility[]>('/amenities/washrooms', { params });
    return response.data;
  },

  createJourney: async (origin: Location, destination: Location, departureTime?: string): Promise<JourneyResponse> => {
    const response = await apiClient.post<JourneyResponse>('/journeys/', {
      origin,
      destination,
      departure_time: departureTime,
    });
    return response.data;
  },

  updateContext: async (journeyId: string, event: ContextUpdateEvent): Promise<ContextUpdateResponse> => {
    const response = await apiClient.post<ContextUpdateResponse>(`/journeys/${journeyId}/context-update`, event);
    return response.data;
  },

  triggerSos: async (journeyId: string | null, location: Location): Promise<any> => {
    const response = await axios.post(`${BASE_URL}/emergency/sos`, {
      journey_id: journeyId,
      latitude: location.latitude,
      longitude: location.longitude,
      trigger_source: 'manual',
    });
    return response.data;
  },
};
