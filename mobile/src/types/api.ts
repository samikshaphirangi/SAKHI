export interface Location {
  latitude: number;
  longitude: number;
}

export type CleanlinessRating = 'CLEAN' | 'AVERAGE' | 'DIRTY';
export type SafetyRating = 'SAFE' | 'CONCERN' | 'UNSAFE';

export interface WashroomFacility {
  facility_id: string;
  facility_type: string; // 'washroom'
  id?: string;
  name: string;
  type?: string;
  address?: string;
  district?: string;
  latitude: number;
  longitude: number;
  distance_m: number;
  is_open: boolean;
  cleanliness_rating: CleanlinessRating;
  safety_rating: SafetyRating;
  is_accessible: boolean;
  verification_count: number;
  last_verified_timestamp: string;
}

// Alias for backward compatibility
export type PublicToilet = WashroomFacility;

export interface JourneySegment {
  segment_id: string;
  journey_id: string;
  sequence: number;
  mode: string;
  start_location: Location;
  end_location: Location;
  distance_m: number;
  duration_s: number;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  risk_score: number | null;
  confidence_score: number | null;
  explanation: any | null;
}

export interface RouteOption {
  route_id: string;
  mode: string;
  rank: number;
  distance_m: number;
  duration_s: number;
  risk_score: number;
  confidence: number;
  max_segment_risk: number;
  uncertainty_penalty: number;
  route_cost: number;
  segments: JourneySegment[];
}

export interface RouteRankingResponse {
  journey_id: string;
  safest_route: RouteOption | null;
  balanced_route: RouteOption | null;
  fastest_route: RouteOption | null;
  all_candidates: any[];
}

export interface JourneyResponse {
  journey_id: string;
  origin: Location;
  destination: Location;
  distance_m: number;
  duration_s: number;
  segments: JourneySegment[];
  ranking: RouteRankingResponse | null;
}

export interface ContextUpdateEvent {
  segment_id: string;
  event_type: string;
  severity: number;
  source: string;
  timestamp: string;
  active: boolean;
  description?: string;
}

export interface ContextUpdateResponse {
  journey_id: string;
  updated_segment_id: string;
  event: ContextUpdateEvent;
  before: {
    risk: number;
    confidence: number;
    safest_route_id: string | null;
  };
  after: {
    risk: number;
    confidence: number;
    safest_route_id: string | null;
  };
  rerouted: boolean;
  reason: string;
  updated_ranking?: RouteRankingResponse | null;
}
