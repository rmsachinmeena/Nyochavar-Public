/** True only for a Google Maps link (google.com/maps, maps.google.com, maps.app.goo.gl, goo.gl/maps) over https. */
export const isGoogleMapsLink = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const isGoogleMaps =
      (['google.com', 'www.google.com', 'maps.google.com'].includes(host) && (url.pathname.startsWith('/maps') || host === 'maps.google.com')) ||
      host === 'maps.app.goo.gl' ||
      (host === 'goo.gl' && url.pathname.startsWith('/maps'));
    return url.protocol === 'https:' && isGoogleMaps;
  } catch {
    return false;
  }
};

/** A Google Maps link for a pair of coordinates (used by "Fetch Live"). */
export const googleMapsLinkFor = (latitude: number, longitude: number): string =>
  `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
