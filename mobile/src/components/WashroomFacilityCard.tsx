import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { WashroomFacility } from '../types/api';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface WashroomFacilityCardProps {
  facility: WashroomFacility;
  onPress?: (facility: WashroomFacility) => void;
  selected?: boolean;
}

interface RecencyInfo {
  isStale: boolean;
  text: string;
  daysAgo: number;
}

/**
 * Dynamically computes recency status by comparing last_verified_timestamp with current time.
 */
export function calculateRecency(timestampStr: string): RecencyInfo {
  if (!timestampStr) {
    return { isStale: true, text: 'No verification date recorded', daysAgo: 999 };
  }

  const verifiedDate = new Date(timestampStr);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - verifiedDate.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If older than 48 hours, mark as stale / not recently verified
  const isStale = diffHours >= 48 || diffDays >= 2;

  let text = '';
  if (diffMinutes < 1) {
    text = 'just now';
  } else if (diffMinutes < 60) {
    text = `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    text = `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffHours < 48) {
    text = `1 day ago (${diffHours} hours ago)`;
  } else if (diffDays < 30) {
    text = `${diffDays} days ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    text = `${months} month${months === 1 ? '' : 's'} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    text = `${years} year${years === 1 ? '' : 's'} ago`;
  }

  return {
    isStale,
    text,
    daysAgo: diffDays,
  };
}

/**
 * Format distance in meters or kilometers.
 */
export function formatDistance(distanceM: number): string {
  if (distanceM === undefined || distanceM === null || isNaN(distanceM)) {
    return 'Nearby';
  }
  if (distanceM < 1000) {
    return `${Math.round(distanceM)} m`;
  }
  return `${(distanceM / 1000).toFixed(1)} km`;
}

export default function WashroomFacilityCard({
  facility,
  onPress,
  selected = false,
}: WashroomFacilityCardProps) {
  const { isAccessibleMode } = useAccessibility();

  const recency = useMemo(
    () => calculateRecency(facility.last_verified_timestamp),
    [facility.last_verified_timestamp]
  );

  const formattedDistance = useMemo(
    () => formatDistance(facility.distance_m),
    [facility.distance_m]
  );

  const openInMaps = async () => {
    const label = encodeURIComponent(facility.name || 'Washroom');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}&travelmode=walking`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Directions', `Location: ${facility.latitude}, ${facility.longitude}`);
      }
    } catch {
      Alert.alert('Directions', `Location: ${facility.latitude}, ${facility.longitude}`);
    }
  };

  const currentStyles = isAccessibleMode ? accessibleStyles : styles;

  // Cleanliness badge config
  const cleanlinessConfig = useMemo(() => {
    switch (facility.cleanliness_rating) {
      case 'CLEAN':
        return { label: 'Clean', icon: '🟢', style: currentStyles.badgeGreen, textStyle: currentStyles.badgeTextGreen };
      case 'AVERAGE':
        return { label: 'Average', icon: '🟡', style: currentStyles.badgeYellow, textStyle: currentStyles.badgeTextYellow };
      case 'DIRTY':
        return { label: 'Dirty', icon: '🔴', style: currentStyles.badgeRed, textStyle: currentStyles.badgeTextRed };
      default:
        return { label: 'Unknown', icon: '⚪', style: currentStyles.badgeNeutral, textStyle: currentStyles.badgeTextNeutral };
    }
  }, [facility.cleanliness_rating, currentStyles]);

  // Safety badge config
  const safetyConfig = useMemo(() => {
    switch (facility.safety_rating) {
      case 'SAFE':
        return { label: 'Safe', icon: '🟢', style: currentStyles.badgeGreen, textStyle: currentStyles.badgeTextGreen };
      case 'CONCERN':
        return { label: 'Concern', icon: '🟡', style: currentStyles.badgeYellow, textStyle: currentStyles.badgeTextYellow };
      case 'UNSAFE':
        return { label: 'Unsafe', icon: '🔴', style: currentStyles.badgeRed, textStyle: currentStyles.badgeTextRed };
      default:
        return { label: 'Unknown', icon: '⚪', style: currentStyles.badgeNeutral, textStyle: currentStyles.badgeTextNeutral };
    }
  }, [facility.safety_rating, currentStyles]);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Washroom at ${formattedDistance}, ${facility.name}, ${facility.is_open ? 'Open' : 'Closed'}`}
      activeOpacity={0.88}
      onPress={() => (onPress ? onPress(facility) : openInMaps())}
      style={[
        currentStyles.card,
        selected && currentStyles.cardSelected,
      ]}
    >
      {/* 1. Header */}
      <View style={currentStyles.headerRow}>
        <View style={currentStyles.headerTextContainer}>
          <Text style={currentStyles.headerTitle}>
            🚻 Washroom — {formattedDistance}
          </Text>
          {facility.name ? (
            <Text style={currentStyles.facilityName} numberOfLines={1}>
              {facility.name}
            </Text>
          ) : null}
          {(facility.address || facility.district) ? (
            <Text style={currentStyles.facilityLocation} numberOfLines={1}>
              {[facility.address, facility.district].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={openInMaps}
          style={currentStyles.navigateIconBtn}
          accessibilityRole="button"
          accessibilityLabel="Get walking directions"
        >
          <Text style={currentStyles.navigateIconText}>➔</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Status Attribute Badges */}
      <View style={currentStyles.badgeContainer}>
        {/* Open Status Badge */}
        <View style={[currentStyles.badge, facility.is_open ? currentStyles.badgeGreen : currentStyles.badgeRed]}>
          <Text style={facility.is_open ? currentStyles.badgeTextGreen : currentStyles.badgeTextRed}>
            {facility.is_open ? '🟢 Open' : '🔴 Closed'}
          </Text>
        </View>

        {/* Cleanliness Badge */}
        <View style={[currentStyles.badge, cleanlinessConfig.style]}>
          <Text style={cleanlinessConfig.textStyle}>
            {cleanlinessConfig.icon} {cleanlinessConfig.label}
          </Text>
        </View>

        {/* Safety Badge */}
        <View style={[currentStyles.badge, safetyConfig.style]}>
          <Text style={safetyConfig.textStyle}>
            {safetyConfig.icon} {safetyConfig.label}
          </Text>
        </View>

        {/* Accessibility Badge */}
        <View
          style={[
            currentStyles.badge,
            facility.is_accessible ? currentStyles.badgeGreen : currentStyles.badgeYellow,
          ]}
        >
          <Text
            style={
              facility.is_accessible
                ? currentStyles.badgeTextGreen
                : currentStyles.badgeTextYellow
            }
          >
            {facility.is_accessible ? '🟢 Accessible' : '🟡 Not Accessible'}
          </Text>
        </View>
      </View>

      {/* 3. User Verification & Recency Section */}
      <View style={currentStyles.verificationSection}>
        {/* Social Proof */}
        <View style={currentStyles.socialProofRow}>
          <Text style={currentStyles.socialProofText}>
            ✓ Verified by {facility.verification_count || 1} user{(facility.verification_count || 1) === 1 ? '' : 's'}
          </Text>
        </View>

        {/* Recency Logic & Display */}
        {recency.isStale ? (
          <View style={currentStyles.warningBanner}>
            <Text style={currentStyles.warningBannerTitle}>
              ⚠️ Status not recently verified
            </Text>
            <Text style={currentStyles.warningBannerSubtext}>
              Last verified: {recency.text}
            </Text>
          </View>
        ) : (
          <View style={currentStyles.freshRecencyRow}>
            <Text style={currentStyles.freshRecencyText}>
              Last reported: {recency.text}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#7c3aed',
    borderWidth: 2,
    backgroundColor: '#faf5ff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  facilityName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 2,
  },
  facilityLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  navigateIconBtn: {
    backgroundColor: '#ede9fe',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  navigateIconText: {
    color: '#6d28d9',
    fontSize: 16,
    fontWeight: 'bold',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGreen: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  badgeTextGreen: {
    color: '#065f46',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeYellow: {
    backgroundColor: '#fefce8',
    borderColor: '#fde047',
  },
  badgeTextYellow: {
    color: '#854d0e',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeRed: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  badgeTextRed: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeNeutral: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  badgeTextNeutral: {
    color: '#4b5563',
    fontSize: 11,
    fontWeight: '600',
  },
  verificationSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  socialProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  socialProofText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  freshRecencyRow: {
    marginTop: 2,
  },
  freshRecencyText: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  warningBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  warningBannerTitle: {
    color: '#b45309',
    fontWeight: '700',
    fontSize: 12,
  },
  warningBannerSubtext: {
    color: '#92400e',
    fontSize: 11,
    marginTop: 1,
  },
});

const accessibleStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: '#000000',
  },
  cardSelected: {
    borderColor: '#1e3a8a',
    borderWidth: 4,
    backgroundColor: '#eff6ff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  facilityName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 4,
  },
  facilityLocation: {
    fontSize: 14,
    color: '#000000',
    marginTop: 2,
  },
  navigateIconBtn: {
    backgroundColor: '#1e3a8a',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  navigateIconText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGreen: {
    backgroundColor: '#dcfce7',
    borderColor: '#15803d',
  },
  badgeTextGreen: {
    color: '#14532d',
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeYellow: {
    backgroundColor: '#fef9c3',
    borderColor: '#a16207',
  },
  badgeTextYellow: {
    color: '#713f12',
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeRed: {
    backgroundColor: '#fee2e2',
    borderColor: '#b91c1c',
  },
  badgeTextRed: {
    color: '#7f1d1d',
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeNeutral: {
    backgroundColor: '#e5e7eb',
    borderColor: '#374151',
  },
  badgeTextNeutral: {
    color: '#111827',
    fontSize: 14,
    fontWeight: 'bold',
  },
  verificationSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#000000',
  },
  socialProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  socialProofText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#065f46',
  },
  freshRecencyRow: {
    marginTop: 4,
  },
  freshRecencyText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#b45309',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  warningBannerTitle: {
    color: '#78350f',
    fontWeight: 'bold',
    fontSize: 15,
  },
  warningBannerSubtext: {
    color: '#78350f',
    fontSize: 14,
    marginTop: 2,
  },
});
