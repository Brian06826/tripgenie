export function buildGoogleMapsUrl(name: string, city: string): string {
  const query = encodeURIComponent(`${name} ${city}`)
  return `https://www.google.com/maps/search/${query}`
}

export function buildYelpUrl(name: string, city: string): string {
  const desc = encodeURIComponent(name)
  const loc = encodeURIComponent(city)
  return `https://www.yelp.com/search?find_desc=${desc}&find_loc=${loc}`
}
