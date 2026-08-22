from typing import Optional
from fastapi import APIRouter, Query

from app.schemas.amenities import WashroomFacility
from app.services.risk.segment_lookup_service import get_segment_lookup_service

router = APIRouter()


@router.get("/washrooms", response_model=list[WashroomFacility], summary="List washroom facilities with verification and recency data")
def list_washrooms(
    lat: Optional[float] = Query(None, description="Optional user/origin latitude for dynamic distance calculation"),
    lon: Optional[float] = Query(None, description="Optional user/origin longitude for dynamic distance calculation"),
    origin_lat: Optional[float] = Query(None, description="Alias for latitude"),
    origin_lon: Optional[float] = Query(None, description="Alias for longitude"),
):
    """
    Expose verified public washrooms with real-time verification count,
    cleanliness & safety ratings, accessibility status, and recency timestamps.
    """
    target_lat = lat if lat is not None else origin_lat
    target_lon = lon if lon is not None else origin_lon
    return get_segment_lookup_service().get_washroom_facilities(
        origin_lat=target_lat,
        origin_lon=target_lon,
    )


@router.get("/public-toilets", response_model=list[WashroomFacility], summary="List public toilet / washroom locations")
def list_public_toilets(
    lat: Optional[float] = Query(None, description="Optional user/origin latitude"),
    lon: Optional[float] = Query(None, description="Optional user/origin longitude"),
    origin_lat: Optional[float] = Query(None, description="Alias for latitude"),
    origin_lon: Optional[float] = Query(None, description="Alias for longitude"),
):
    """Expose verified public toilet/washroom coordinates and ratings for the mobile map."""
    target_lat = lat if lat is not None else origin_lat
    target_lon = lon if lon is not None else origin_lon
    return get_segment_lookup_service().get_public_toilets(
        origin_lat=target_lat,
        origin_lon=target_lon,
    )
