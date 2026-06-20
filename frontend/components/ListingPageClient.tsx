"use client";

import { useRouter } from "next/navigation";
import { ListingDetailView } from "@/components/ListingCard";
import type { Listing } from "@/lib/api";

export function ListingPageClient({ listing }: { listing: Listing }) {
  const router = useRouter();

  const proceedToAcquire = () => {
    sessionStorage.setItem("selectedListing", JSON.stringify(listing));
    router.push(`/checkout?listing=${listing.slug}`);
  };

  return (
    <ListingDetailView listing={listing} onAcquire={proceedToAcquire} />
  );
}
