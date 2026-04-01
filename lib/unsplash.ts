type UnsplashResult = {
  imageUrl: string
  credit: { name: string; link: string }
} | null

export async function fetchHeroImage(destination: string): Promise<UnsplashResult> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return null

  try {
    const query = encodeURIComponent(`${destination} travel`)
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&client_id=${key}`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return null

    const data = await res.json()
    return {
      imageUrl: data.urls.regular,
      credit: {
        name: data.user.name,
        link: `${data.user.links.html}?utm_source=lulgo&utm_medium=referral`,
      },
    }
  } catch {
    return null
  }
}
