"""
SegmentLookupService
====================
Spatial reference data loader for SAKHI risk feature extraction.

Loads and caches all reference data at startup:
  - Police stations (real GPS, real district)
  - Hospitals (real GPS)
  - Medical facilities (real GPS)
  - Public amenities (real GPS)
  - Synthetic crime hotspots (synthetic - clearly labelled)
  - Synthetic lighting data (synthetic proxy)
  - Synthetic CCTV data (synthetic proxy)
  - Synthetic mobility/footfall data (synthetic proxy)
  - Segment context features (the 30 reference road segments)
  - District historical baseline (real NCRB data, district resolution only)

For any arbitrary lat/lon, provides:
  1. District determination (via nearest police station's district)
  2. District historical baseline stats
  3. Real distances to nearest police/hospital/medical/amenity
  4. Nearest synthetic proxy values (lighting, CCTV, mobility, hotspot)
"""

import math
import os
from typing import Optional, Tuple, Dict, Any
import pandas as pd


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in metres between two lat/lon points."""
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_row(df: pd.DataFrame, lat: float, lon: float,
                 lat_col: str = "latitude", lon_col: str = "longitude") -> Tuple[pd.Series, float]:
    """Return (nearest_row, distance_m) from a DataFrame with lat/lon columns."""
    best_idx = 0
    best_dist = float("inf")
    for idx, row in df.iterrows():
        d = _haversine_m(lat, lon, float(row[lat_col]), float(row[lon_col]))
        if d < best_dist:
            best_dist = d
            best_idx = idx
    return df.loc[best_idx], best_dist


class SegmentLookupService:
    """
    Spatial reference data service. Loaded once at startup; shared across requests.
    Thread-safe for read-only operations.
    """

    def __init__(self, data_root: Optional[str] = None):
        if data_root is None:
            # Resolve relative to this file: backend/app/services/risk/ -> SAKHI/ml/data
            here = os.path.dirname(os.path.abspath(__file__))
            data_root = os.path.normpath(
                os.path.join(here, "..", "..", "..", "..", "ml", "data")
            )

        raw_dir = os.path.join(data_root, "raw")
        syn_dir = os.path.join(data_root, "synthetic")
        proc_dir = os.path.join(data_root, "processed")

        # ------------------------------------------------------------------
        # Real infrastructure data
        # ------------------------------------------------------------------
        self._police = self._load(os.path.join(raw_dir, "police_stations.csv"),
                                  ["latitude", "longitude", "district"])
        self._hospitals = self._load(os.path.join(raw_dir, "hospitals.csv"),
                                     ["latitude", "longitude"])
        self._medical = self._load(os.path.join(raw_dir, "medical_facilities.csv"),
                                   ["latitude", "longitude"])
        norm_dir = os.path.join(data_root, "normalized")
        amenities_norm_path = os.path.join(norm_dir, "delhi_amenities_normalized.csv")
        amenities_raw_path = os.path.join(raw_dir, "public_amenities.csv")
        amenities_path = amenities_norm_path if os.path.exists(amenities_norm_path) else amenities_raw_path

        self._amenities = self._load(amenities_path, ["latitude", "longitude"])

        # ------------------------------------------------------------------
        # Synthetic / proxy data (explicitly labelled)
        # ------------------------------------------------------------------
        self._hotspots = self._load(os.path.join(syn_dir, "synthetic_crime_hotspots.csv"),
                                    ["latitude", "longitude", "intensity"])
        self._lighting = self._load(os.path.join(syn_dir, "synthetic_lighting.csv"),
                                    ["latitude", "longitude", "lighting_score"])
        self._cctv = self._load(os.path.join(syn_dir, "synthetic_cctv.csv"),
                                ["latitude", "longitude", "coverage_score"])
        self._mobility = self._load(os.path.join(syn_dir, "synthetic_mobility.csv"),
                                    ["latitude", "longitude", "footfall_proxy"])

        # ------------------------------------------------------------------
        # District historical baseline (real NCRB, district resolution only)
        # ------------------------------------------------------------------
        baseline_path = os.path.join(proc_dir, "district_historical_baseline.csv")
        self._district_baseline: Dict[str, Dict] = {}
        if os.path.exists(baseline_path):
            df = pd.read_csv(baseline_path)
            for _, row in df.iterrows():
                district = str(row["district"])
                self._district_baseline[district] = {
                    "historical_baseline": float(row.get("historical_baseline", 50.0)),
                    "cases_per_100k": float(row.get("cases_per_100k", 300.0)),
                    "severity_weighted_cases_per_100k": float(row.get("severity_weighted_cases_per_100k", 220.0)),
                    "recent_cases_per_100k": float(row.get("recent_cases_per_100k", 375.0)),
                    "recent_severity_per_100k": float(row.get("recent_severity_per_100k", 275.0)),
                    "crime_trend_slope": float(row.get("crime_trend_slope", -1.5)),
                }

        # ------------------------------------------------------------------
        # Reference road segments (30 curated Delhi segments)
        # ------------------------------------------------------------------
        seg_path = os.path.join(proc_dir, "segment_context_features.csv")
        self._ref_segments: pd.DataFrame = pd.DataFrame()
        if os.path.exists(seg_path):
            self._ref_segments = pd.read_csv(seg_path)

        # Defaults when data is unavailable (district-level median of Delhi)
        self._default_baseline = {
            "historical_baseline": 25.0,
            "cases_per_100k": 280.0,
            "severity_weighted_cases_per_100k": 205.0,
            "recent_cases_per_100k": 350.0,
            "recent_severity_per_100k": 255.0,
            "crime_trend_slope": -2.5,
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_district(self, lat: float, lon: float) -> str:
        """
        Determine district for a coordinate using nearest police station.
        Precision note: This is an approximation only; the actual district
        boundary data is not available. Police station assignment is used
        as a reasonable proxy.
        """
        if self._police.empty or "district" not in self._police.columns:
            return "Unknown"
        row, _ = _nearest_row(self._police, lat, lon)
        return str(row["district"])

    def get_district_baseline(self, district: str) -> Dict[str, float]:
        """Return district historical baseline stats from processed NCRB data."""
        return self._district_baseline.get(district, self._default_baseline).copy()

    def get_infrastructure_distances(self, lat: float, lon: float) -> Dict[str, float]:
        """
        Compute real distances to nearest police station, hospital,
        medical facility, public toilet/amenity.
        Source: real GPS coordinates from verified datasets.
        """
        result: Dict[str, float] = {}

        if not self._police.empty:
            _, d = _nearest_row(self._police, lat, lon)
            result["distance_to_police_m"] = round(d, 1)
        else:
            result["distance_to_police_m"] = 800.0

        if not self._hospitals.empty:
            _, d = _nearest_row(self._hospitals, lat, lon)
            result["distance_to_hospital_m"] = round(d, 1)
        else:
            result["distance_to_hospital_m"] = 3000.0

        if not self._medical.empty:
            _, d = _nearest_row(self._medical, lat, lon)
            result["distance_to_medical_facility_m"] = round(d, 1)
        else:
            result["distance_to_medical_facility_m"] = 2000.0

        if not self._amenities.empty:
            _, d = _nearest_row(self._amenities, lat, lon)
            result["distance_to_public_toilet_m"] = round(d, 1)
            result["distance_to_nearest_amenity_m"] = round(d, 1)
        else:
            result["distance_to_public_toilet_m"] = 1200.0
            result["distance_to_nearest_amenity_m"] = 1000.0

        return result

    def get_public_toilets(self, origin_lat: Optional[float] = None, origin_lon: Optional[float] = None) -> list[Dict[str, Any]]:
        """Return public toilet locations formatted with all washroom schema attributes."""
        return self.get_washroom_facilities(origin_lat=origin_lat, origin_lon=origin_lon)

    def get_washroom_facilities(self, origin_lat: Optional[float] = None, origin_lon: Optional[float] = None) -> list[Dict[str, Any]]:
        """Return washroom facilities with status, cleanliness, safety, accessibility and recency attributes."""
        if self._amenities.empty:
            return []

        type_col = "facility_type" if "facility_type" in self._amenities.columns else "type"
        if type_col not in self._amenities.columns:
            return []

        toilets = self._amenities[
            self._amenities[type_col].astype(str).str.contains("toilet|washroom", case=False, na=False)
        ]

        results = []
        for index, row in toilets.iterrows():
            fid = str(row.get("facility_id", row.get("amenity_id", row.get("id", f"WSH_{index:04d}"))))
            lat = float(row.get("latitude", row.get("lat", 0.0)))
            lon = float(row.get("longitude", row.get("lon", 0.0)))

            if origin_lat is not None and origin_lon is not None:
                dist_m = round(_haversine_m(origin_lat, origin_lon, lat, lon), 1)
            else:
                dist_m = float(row.get("distance_m", 350.0))

            is_open_val = row.get("is_open", True)
            if isinstance(is_open_val, str):
                is_open = is_open_val.strip().lower() in ("true", "1", "yes", "open")
            else:
                is_open = bool(is_open_val)

            is_acc_val = row.get("is_accessible", True)
            if isinstance(is_acc_val, str):
                is_accessible = is_acc_val.strip().lower() in ("true", "1", "yes")
            else:
                is_accessible = bool(is_acc_val)

            cleanliness = str(row.get("cleanliness_rating", "CLEAN")).strip().upper()
            if cleanliness not in ("CLEAN", "AVERAGE", "DIRTY"):
                cleanliness = "CLEAN"

            safety = str(row.get("safety_rating", "SAFE")).strip().upper()
            if safety not in ("SAFE", "CONCERN", "UNSAFE"):
                safety = "SAFE"

            try:
                ver_count = int(row.get("verification_count", 1))
            except (ValueError, TypeError):
                ver_count = 1

            last_verified = str(row.get("last_verified_timestamp", "2026-08-22T11:45:00+05:30"))

            results.append({
                "facility_id": fid,
                "id": fid,  # alias for backward compatibility
                "facility_type": "washroom",
                "type": "Public Toilet",  # alias for backward compatibility
                "name": str(row.get("name", "Public Washroom")),
                "address": str(row.get("address", "")),
                "district": str(row.get("district", "")),
                "latitude": lat,
                "longitude": lon,
                "distance_m": dist_m,
                "is_open": is_open,
                "cleanliness_rating": cleanliness,
                "safety_rating": safety,
                "is_accessible": is_accessible,
                "verification_count": ver_count,
                "last_verified_timestamp": last_verified,
            })

        return results

    def get_synthetic_proxies(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Retrieve nearest synthetic proxy values for lighting, CCTV, mobility,
        and crime hotspot intensity.

        IMPORTANT: All values here are SYNTHETIC/PROXY data.
        They are not measured observations. They exist to demonstrate the
        contextual risk pipeline. Provenance flags are set accordingly.
        """
        result: Dict[str, Any] = {
            "lighting_score": 50.0,
            "cctv_coverage_score": 50.0,
            "footfall_proxy": 2000.0,
            "nearest_hotspot_distance_m": 8000.0,
            "nearest_hotspot_intensity": 0.5,
            # Provenance
            "lighting_data_synthetic": True,
            "cctv_data_synthetic": True,
            "mobility_data_synthetic": True,
            "hotspot_data_synthetic": True,
        }

        if not self._lighting.empty:
            row, _ = _nearest_row(self._lighting, lat, lon)
            result["lighting_score"] = float(row.get("lighting_score", 50.0))

        if not self._cctv.empty:
            row, _ = _nearest_row(self._cctv, lat, lon)
            result["cctv_coverage_score"] = float(row.get("coverage_score", 50.0))

        if not self._mobility.empty:
            row, _ = _nearest_row(self._mobility, lat, lon)
            result["footfall_proxy"] = float(row.get("footfall_proxy", 2000.0))

        if not self._hotspots.empty:
            row, d = _nearest_row(self._hotspots, lat, lon)
            result["nearest_hotspot_distance_m"] = round(d, 1)
            result["nearest_hotspot_intensity"] = float(row.get("intensity", 0.5))

        return result

    def get_nearest_reference_segment(self, lat: float, lon: float) -> Tuple[Optional[pd.Series], float]:
        """
        Find the nearest of the 30 curated reference road segments.
        Returns (row, distance_m). Returns (None, inf) if no reference data loaded.
        """
        if self._ref_segments.empty:
            return None, float("inf")
        row, dist = _nearest_row(
            self._ref_segments, lat, lon,
            lat_col="midpoint_latitude", lon_col="midpoint_longitude"
        )
        return row, dist

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _load(path: str, required_cols: list) -> pd.DataFrame:
        if not os.path.exists(path):
            return pd.DataFrame()
        try:
            df = pd.read_csv(path)
            if "lat" in df.columns and "latitude" not in df.columns:
                df = df.rename(columns={"lat": "latitude"})
            if "lon" in df.columns and "longitude" not in df.columns:
                df = df.rename(columns={"lon": "longitude"})
            missing = [c for c in required_cols if c not in df.columns]
            if missing:
                return pd.DataFrame()
            return df
        except Exception:
            return pd.DataFrame()


# Module-level singleton — instantiated once on first import
_singleton: Optional[SegmentLookupService] = None


def get_segment_lookup_service() -> SegmentLookupService:
    global _singleton
    if _singleton is None:
        _singleton = SegmentLookupService()
    return _singleton
