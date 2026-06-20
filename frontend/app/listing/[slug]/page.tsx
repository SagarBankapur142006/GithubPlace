import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackgroundElements } from "@/components/BackgroundElements";
import { ListingPageClient } from "@/components/ListingPageClient";
import { Navbar } from "@/components/Navbar";
import { fetchListingServer } from "@/lib/api-server";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const listing = await fetchListingServer(slug);
    return {
      title: listing.meta_title || `${listing.title} | Ideora`,
      description: listing.meta_description || listing.short_description,
      openGraph: {
        title: listing.meta_title || listing.title,
        description: listing.meta_description || listing.short_description,
        type: "website",
      },
    };
  } catch {
    return { title: "Listing | Ideora" };
  }
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  let listing;
  try {
    listing = await fetchListingServer(slug);
  } catch {
    notFound();
  }

  const jsonLd = listing.json_ld || {};

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BackgroundElements />
      <Navbar />
      <div className="listing-page-content scale-in">
        <ListingPageClient listing={listing} />
      </div>
    </>
  );
}
