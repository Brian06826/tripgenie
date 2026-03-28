export function buildGoogleMapsUrl(name: string, city: string): string {
  const query = encodeURIComponent(`${name} ${city}`)
  return `https://www.google.com/maps/search/${query}`
}

export function buildGoogleReviewsUrl(name: string, city: string): string {
  const query = encodeURIComponent(`${name} ${city} reviews`)
  return `https://www.google.com/search?q=${query}`
}

export function buildYelpUrl(name: string, city: string): string {
  return `https://www.yelp.com/search?find_desc=${encodeURIComponent(name)}&find_loc=${encodeURIComponent(city)}`
}
