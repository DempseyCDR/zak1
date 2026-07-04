export type VenueMapInput = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Build a location-map URL for a venue (FR-009). Pure — no external call.
 * - If a static-maps API key is configured (MAPS_STATIC_KEY), returns a static-map image URL
 *   (rendered as an <img>).
 * - Otherwise returns a plain Google Maps link (rendered as an <a>), so the site degrades
 *   gracefully with no key in dev/test.
 * Coordinates are preferred over the address string when present.
 */
export function venueMapUrl(venue: VenueMapInput): string {
  const hasCoords = venue.latitude !== null && venue.longitude !== null;
  const query = hasCoords ? `${venue.latitude},${venue.longitude}` : venue.address;
  const key = process.env.MAPS_STATIC_KEY;

  if (key) {
    const center = encodeURIComponent(query);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=15&size=600x300&markers=${center}&key=${key}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
