import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get('place_id');

  if (!placeId) {
    return NextResponse.json({ error: 'place_id is required' }, { status: 400 });
  }

  // 0. Handle OSM, Photon, Static City, or custom place_id if passed
  if (placeId.startsWith('osm_') || placeId.startsWith('photon_') || placeId.startsWith('static_city_') || placeId.startsWith('sec') || placeId.startsWith('kp') || placeId.startsWith('alpha') || placeId.startsWith('cp_') || placeId.startsWith('lajpat_') || placeId.startsWith('kalu_') || placeId.startsWith('mukherjee_') || placeId.startsWith('laxmi_')) {
    return NextResponse.json({
      result: {
        formatted_address: searchParams.get('address') || 'Selected Location',
        geometry: {
          location: {
            lat: parseFloat(searchParams.get('lat') || '28.6139'),
            lng: parseFloat(searchParams.get('lng') || '77.2090')
          }
        }
      }
    });
  }

  // 1. Handle DB City place_id
  if (placeId.startsWith('city_')) {
    const cityId = placeId.replace('city_', '');
    const city = await prisma.city.findUnique({ where: { id: cityId } });
    if (city) {
      return NextResponse.json({
        result: {
          formatted_address: `${city.name}, ${city.state || 'India'}`,
          geometry: {
            location: {
              lat: city.latitude || 28.6139,
              lng: city.longitude || 77.2090
            }
          }
        }
      });
    }
  }

  // 2. Handle DB Institute location place_id
  if (placeId.startsWith('inst_')) {
    const instId = placeId.replace('inst_', '');
    const inst = await prisma.institute.findUnique({
      where: { id: instId },
      include: { city: true }
    });
    if (inst) {
      return NextResponse.json({
        result: {
          formatted_address: inst.address,
          geometry: {
            location: {
              lat: inst.latitude || 28.6139,
              lng: inst.longitude || 77.2090
            }
          }
        }
      });
    }
  }

  // 3. Google Place Details API (Places API New with Referer support + Photon fallback)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCJVo2m1ic_xT4BLDELw6h63mOjO9PqquE';

  try {
    // 3a. Try Google Places API (New) - supports Referer-restricted keys
    const cleanPlaceId = placeId.startsWith('places/') ? placeId.replace('places/', '') : placeId;
    const newPlacesRes = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(cleanPlaceId)}?fields=id,displayName,location,formattedAddress`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,location,formattedAddress',
          'Referer': 'https://www.academyfind.com'
        }
      }
    );

    if (newPlacesRes.ok) {
      const newPlacesData = await newPlacesRes.json();
      if (newPlacesData.location?.latitude != null && newPlacesData.location?.longitude != null) {
        return NextResponse.json({
          result: {
            formatted_address: newPlacesData.formattedAddress || searchParams.get('address') || 'Selected Location',
            name: newPlacesData.displayName?.text || '',
            geometry: {
              location: {
                lat: newPlacesData.location.latitude,
                lng: newPlacesData.location.longitude
              }
            }
          }
        });
      }
    }

    // 3b. Fallback to Legacy Google Places API
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,formatted_address,name&key=${apiKey}`,
      { headers: { 'Referer': 'https://www.academyfind.com' } }
    );
    const data = await res.json();
    if (data?.result?.geometry?.location) {
      return NextResponse.json(data);
    }

    // 3c. Fallback to Photon geocoding if placeId fails or Google restricts
    const address = searchParams.get('address');
    if (address) {
      const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`);
      if (photonRes.ok) {
        const photonData = await photonRes.json();
        const feat = photonData?.features?.[0];
        if (feat?.geometry?.coordinates?.length >= 2) {
          return NextResponse.json({
            result: {
              formatted_address: address,
              geometry: {
                location: {
                  lat: feat.geometry.coordinates[1],
                  lng: feat.geometry.coordinates[0]
                }
              }
            }
          });
        }
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Location details error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
