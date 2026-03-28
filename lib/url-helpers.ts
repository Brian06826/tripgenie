function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function buildGoogleMapsUrl(name: string, city: string): string {
  const query = encodeURIComponent(`${name} ${city}`)
  return `https://www.google.com/maps/search/${query}`
}

export function buildGoogleReviewsUrl(name: string, city: string): string {
  const query = encodeURIComponent(`${name} ${city} reviews`)
  return `https://www.google.com/search?q=${query}`
}

export function buildYelpUrl(name: string, city: string): string {
  const nameSlug = slugify(name)
  const citySlug = slugify(city)

  // Fall back to search if slug is unreliable — e.g. name is mostly non-ASCII
  // (Chinese characters strip out entirely, leaving a slug too short to be trustworthy)
  const asciiChars = name.replace(/[^a-zA-Z0-9\s]/g, '').trim()
  const reliable = nameSlug.length >= 2 && asciiChars.length >= name.trim().length * 0.4

  if (!reliable) {
    return `https://www.yelp.com/search?find_desc=${encodeURIComponent(name)}&find_loc=${encodeURIComponent(city)}`
  }

  return `https://www.yelp.com/biz/${nameSlug}-${citySlug}`
}
