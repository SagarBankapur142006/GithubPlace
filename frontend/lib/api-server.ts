/**
 * Server-side API helpers (SSR / generateMetadata / sitemap).
 * Uses BACKEND_URL directly — browser client uses same-origin /api rewrite.
 */

const SERVER_API = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchListingServer(slug: string) {
  const res = await fetch(`${SERVER_API}/api/listings/${slug}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error("Listing not found");
  return res.json();
}

export async function fetchListingsServer(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SERVER_API}/api/listings?${qs}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return { items: [], total: 0 };
  return res.json();
}

export async function fetchStatsServer() {
  const res = await fetch(`${SERVER_API}/api/listings/stats`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) return { active_listings: 0, total_volume_cents: 0 };
  return res.json();
}
