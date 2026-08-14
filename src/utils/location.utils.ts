import * as https from 'https';

export async function extractLocationFromMapsUrl(url: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!url || typeof url !== 'string') return null;
  
  // If it's already a full google maps url with coordinates, we can extract it directly
  let locationUrl = url;

  if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
    try {
      const redirectUrl = await new Promise<string>((resolve, reject) => {
        https.get(url, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            resolve(res.headers.location);
          } else {
            resolve(url); // Not a redirect, or failed
          }
        }).on('error', (err) => {
          reject(err);
        });
      });
      locationUrl = redirectUrl;
    } catch (error) {
      console.error('Failed to resolve short Google Maps link:', error);
      return null;
    }
  }

  // Attempt to match exact pin location: !3d[lat]!4d[lng]
  const bangMatch = locationUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    return {
      latitude: parseFloat(bangMatch[1]),
      longitude: parseFloat(bangMatch[2]),
    };
  }

  // Fallback: match center of the map: @[lat],[lng]
  const atMatch = locationUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return {
      latitude: parseFloat(atMatch[1]),
      longitude: parseFloat(atMatch[2]),
    };
  }

  return null;
}
