import type { MetadataRoute } from "next";
import { fetchListingsServer } from "@/lib/api-server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const data = await fetchListingsServer();
    const listings = data.items || [];

    return [
      { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
      ...listings.map((l: { slug: string; updated_at?: string }) => ({
        url: `${SITE_URL}/listing/${l.slug}`,
        lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return [{ url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 }];
  }
}
