from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class CleanlinessRating(str, Enum):
    CLEAN = "CLEAN"
    AVERAGE = "AVERAGE"
    DIRTY = "DIRTY"


class SafetyRating(str, Enum):
    SAFE = "SAFE"
    CONCERN = "CONCERN"
    UNSAFE = "UNSAFE"


class WashroomFacility(BaseModel):
    facility_id: str = Field(..., description="Unique washroom facility identifier")
    facility_type: str = Field("washroom", description="Type of facility, e.g. washroom")
    name: str = Field("Public Washroom", description="Name or title of facility")
    address: str = Field("", description="Street address or location landmark")
    district: str = Field("", description="Administrative district in Delhi")
    latitude: float = Field(..., description="GPS Latitude coordinate")
    longitude: float = Field(..., description="GPS Longitude coordinate")
    distance_m: float = Field(0.0, description="Distance from origin in metres")
    is_open: bool = Field(True, description="Whether washroom is currently open")
    cleanliness_rating: CleanlinessRating = Field(CleanlinessRating.CLEAN, description="Community cleanliness rating")
    safety_rating: SafetyRating = Field(SafetyRating.SAFE, description="Safety assessment score")
    is_accessible: bool = Field(True, description="Wheelchair / disability accessibility status")
    verification_count: int = Field(1, description="Number of user verifications")
    last_verified_timestamp: str = Field(..., description="ISO 8601 timestamp or epoch of last verification")


# Alias for backward compatibility
PublicToilet = WashroomFacility
