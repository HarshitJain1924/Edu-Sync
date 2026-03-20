// Unsplash API service — uses /search/photos endpoint (same as your PHP project)
// Only the Access Key is used here (safe for frontend, read-only, rate-limited)

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

/**
 * Search Unsplash for topic-relevant images.
 * Uses the same /search/photos endpoint as your PFP project.
 *
 * Returns the first result's regular URL, or null if not found.
 * Call this once during course creation, then save the URL in Supabase.
 */
export async function getUnsplashImage(topic: string): Promise<string | null> {
  if (!ACCESS_KEY) {
    console.warn("[Unsplash] No access key. Set VITE_UNSPLASH_ACCESS_KEY in .env");
    return null;
  }

  try {
    const query = encodeURIComponent(topic);
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&per_page=1&client_id=${ACCESS_KEY}`,
      { headers: { "Accept-Version": "v1" } }
    );

    if (!res.ok) {
      console.warn(`[Unsplash] API returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const results = data.results || [];

    if (results.length > 0) {
      return results[0].urls?.regular || results[0].urls?.small || null;
    }

    return null;
  } catch (err) {
    console.error("[Unsplash] Fetch error:", err);
    return null;
  }
}
