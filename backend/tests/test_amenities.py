import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.amenities import WashroomFacility, CleanlinessRating, SafetyRating


client = TestClient(app)


def test_list_washrooms_endpoint_schema():
    """Verify /api/v1/amenities/washrooms returns required schema fields and valid enums."""
    response = client.get("/api/v1/amenities/washrooms")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

    required_fields = [
        "facility_id",
        "facility_type",
        "distance_m",
        "is_open",
        "cleanliness_rating",
        "safety_rating",
        "is_accessible",
        "verification_count",
        "last_verified_timestamp",
    ]

    for item in data:
        for field in required_fields:
            assert field in item, f"Missing required field: {field}"

        assert item["facility_type"] == "washroom"
        assert isinstance(item["facility_id"], str)
        assert isinstance(item["distance_m"], (int, float))
        assert isinstance(item["is_open"], bool)
        assert item["cleanliness_rating"] in ["CLEAN", "AVERAGE", "DIRTY"]
        assert item["safety_rating"] in ["SAFE", "CONCERN", "UNSAFE"]
        assert isinstance(item["is_accessible"], bool)
        assert isinstance(item["verification_count"], int)
        assert isinstance(item["last_verified_timestamp"], str)


def test_list_public_toilets_endpoint():
    """Verify /api/v1/amenities/public-toilets backward compatibility and schema."""
    response = client.get("/api/v1/amenities/public-toilets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

    first = data[0]
    assert "facility_id" in first
    assert "cleanliness_rating" in first
    assert "safety_rating" in first
    assert "is_accessible" in first
    assert "verification_count" in first
    assert "last_verified_timestamp" in first


def test_washroom_dynamic_distance_calculation():
    """Verify dynamic distance calculation when origin latitude and longitude are supplied."""
    origin_lat = 28.632
    origin_lon = 77.218
    response = client.get(f"/api/v1/amenities/washrooms?lat={origin_lat}&lon={origin_lon}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0

    # CP washroom is located at 28.632, 77.218 so distance should be ~0 meters
    cp_washroom = next((w for w in data if "CP" in w["name"] or w["facility_id"] == "WSH_0001"), None)
    assert cp_washroom is not None
    assert cp_washroom["distance_m"] < 50.0  # within 50m of exact coordinate


def test_washroom_pydantic_model_validation():
    """Verify WashroomFacility Pydantic model validates and serializes correctly."""
    valid_facility = WashroomFacility(
        facility_id="WSH_9999",
        facility_type="washroom",
        name="Community Clean Toilet",
        address="Sector 5, RK Puram",
        district="South",
        latitude=28.560,
        longitude=77.180,
        distance_m=180.5,
        is_open=True,
        cleanliness_rating=CleanlinessRating.CLEAN,
        safety_rating=SafetyRating.SAFE,
        is_accessible=True,
        verification_count=12,
        last_verified_timestamp="2026-08-22T13:00:00+05:30",
    )

    assert valid_facility.facility_id == "WSH_9999"
    assert valid_facility.cleanliness_rating == CleanlinessRating.CLEAN
    assert valid_facility.safety_rating == SafetyRating.SAFE
    assert valid_facility.verification_count == 12

    dump = valid_facility.model_dump()
    assert dump["cleanliness_rating"] == "CLEAN"
    assert dump["safety_rating"] == "SAFE"
