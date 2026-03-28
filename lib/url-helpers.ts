export function buildGoogleMapsUrl(name: string, city: string): string {
  const query = encodeURIComponent(`${name} ${city}`)
  return `https://www.google.com/maps/search/${query}`
}

export function buildYelpUrl(name: string, city: string): string {
  const slug = (s: string) =>
    s.toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
  return `https://www.yelp.com/biz/${slug(name)}-${slug(city)}`
}
