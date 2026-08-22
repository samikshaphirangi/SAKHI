import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';

import { JourneySegment, Location, PublicToilet } from '../types/api';

interface JourneyMapProps {
  origin: Location | null;
  destination: Location | null;
  segments: JourneySegment[];
  selectedSegmentId: string | null;
  onSegmentPress: (segment: JourneySegment) => void;
  publicToilets: PublicToilet[];
  showPublicToilets: boolean;
  selectedToiletId?: string | null;
  onToiletPress?: (toilet: PublicToilet) => void;
  onNavigateRequest: () => void;
}

function riskColor(risk: number | null): string {
  if ((risk ?? 0) > 65) return '#ef4444';
  if ((risk ?? 0) >= 35) return '#f59e0b';
  return '#10b981';
}

function mapRegion(origin: Location | null, destination: Location | null): Region {
  const centerLatitude = ((origin?.latitude ?? 28.6139) + (destination?.latitude ?? 28.6139)) / 2;
  const centerLongitude = ((origin?.longitude ?? 77.2090) + (destination?.longitude ?? 77.2090)) / 2;
  const latitudeDelta = Math.max(Math.abs((origin?.latitude ?? centerLatitude) - (destination?.latitude ?? centerLatitude)) * 1.8, 0.02);
  const longitudeDelta = Math.max(Math.abs((origin?.longitude ?? centerLongitude) - (destination?.longitude ?? centerLongitude)) * 1.8, 0.02);

  return { latitude: centerLatitude, longitude: centerLongitude, latitudeDelta, longitudeDelta };
}

export default function JourneyMap({
  origin,
  destination,
  segments,
  selectedSegmentId,
  onSegmentPress,
  publicToilets,
  showPublicToilets,
  selectedToiletId,
  onToiletPress,
  onNavigateRequest,
}: JourneyMapProps) {
  const initialRegion = useMemo(() => mapRegion(origin, destination), [origin, destination]);
  const mapKey = `${origin?.latitude ?? 'none'}-${origin?.longitude ?? 'none'}-${destination?.latitude ?? 'none'}-${destination?.longitude ?? 'none'}`;

  return (
    <View style={styles.container}>
      <MapView
        key={mapKey}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onPress={onNavigateRequest}
        showsUserLocation
        showsMyLocationButton
        loadingEnabled
      >
        {segments.map((segment) => {
          const coordinates = (segment.geometry.coordinates || [])
            .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2)
            .map(([longitude, latitude]) => ({ latitude, longitude }));

          if (coordinates.length < 2) return null;

          const isSelected = segment.segment_id === selectedSegmentId;
          return (
            <Polyline
              key={segment.segment_id}
              coordinates={coordinates}
              strokeColor={isSelected ? '#2563eb' : riskColor(segment.risk_score)}
              strokeWidth={isSelected ? 7 : 5}
              tappable
              onPress={() => onSegmentPress(segment)}
            />
          );
        })}

        {origin && <Marker coordinate={origin} pinColor="#16a34a" title="Origin" />}
        {destination && <Marker coordinate={destination} pinColor="#dc2626" title="Destination" />}

        {showPublicToilets && publicToilets.map((toilet) => {
          const toiletId = toilet.facility_id || toilet.id || `${toilet.latitude}-${toilet.longitude}`;
          const isSelected = selectedToiletId === toiletId;
          return (
            <Marker
              key={toiletId}
              coordinate={{ latitude: toilet.latitude, longitude: toilet.longitude }}
              pinColor={isSelected ? '#ec4899' : '#7c3aed'}
              title={`🚻 ${toilet.name || 'Washroom'}`}
              description={[
                toilet.is_open ? '🟢 Open' : '🔴 Closed',
                `Cleanliness: ${toilet.cleanliness_rating || 'Clean'}`,
                `Safety: ${toilet.safety_rating || 'Safe'}`,
                toilet.address || toilet.district,
              ].filter(Boolean).join(' · ')}
              onPress={() => onToiletPress && onToiletPress(toilet)}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 10,
    backgroundColor: '#e5e7eb',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
