"use client";

import Link from "next/link";
import { formatPrice, type Listing } from "@/lib/api";

interface ListingCardProps {
  listing: Listing;
  index: number;
  onOpenModal: (listing: Listing) => void;
}

export function ListingCard({ listing, index, onOpenModal }: ListingCardProps) {
  return (
    <div className="card scale-in" style={{ animationDelay: `${(index % 10) * 0.08}s` }}>
      <div className="card-header">
        <span className="card-cat">{listing.category}</span>
        <span className="card-potential">Growth Potential: {listing.growth_potential_score}%</span>
      </div>
      <h3 className="card-title">{listing.title}</h3>
      <p className="card-desc">{listing.short_description}</p>
      <div className="card-footer">
        <span className="card-price">{formatPrice(listing.price_cents, listing.currency)}</span>
        <button className="btn-ghost" onClick={() => onOpenModal(listing)}>
          More Details
        </button>
      </div>
    </div>
  );
}

export function ListingDetailView({
  listing,
  onAcquire,
  showClose = false,
  onClose,
}: {
  listing: Listing;
  onAcquire: () => void;
  showClose?: boolean;
  onClose?: () => void;
}) {
  const techList = listing.tech_stack.map((t) => (
    <span key={t} className="tech-pill">
      {t}
    </span>
  ));

  return (
    <>
      {showClose && onClose && (
        <button className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
      <span className="modal-cat">{listing.category}</span>
      <h2 className="modal-title">{listing.title}</h2>
      <div className="modal-tech">{techList}</div>

      <div className="modal-analysis">
        <strong style={{ color: "var(--accent-green)", fontFamily: "sans-serif", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "1rem" }}>
          Expert Analysis
        </strong>
        {listing.expert_analysis}
      </div>

      <div className="legal-notice">
        This acquisition includes a packaged codebase snapshot and usage rights as sold by Ideora Marketplace.
        It is not a verified legal IP transfer from the original repository author(s). Verify license compatibility
        for your intended commercial use.
      </div>

      <div className="modal-data-grid">
        <div className="modal-data-item">
          <h4>Validated Potential</h4>
          <p style={{ color: "var(--accent-gold)" }}>{listing.growth_potential_score}% ROI Scale</p>
        </div>
        <div className="modal-data-item">
          <h4>Architecture Complexity</h4>
          <p>{listing.complexity}</p>
        </div>
        <div className="modal-data-item">
          <h4>Revenue Model Strategy</h4>
          <p>{listing.revenue_model}</p>
        </div>
        <div className="modal-data-item">
          <h4>Delivery Status</h4>
          <p style={{ color: "#2c6e49" }}>Packaged Codebase Ready</p>
        </div>
      </div>

      <div className="modal-action">
        <div>
          <span style={{ fontFamily: "sans-serif", color: "var(--text-muted)", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "1.5px", display: "block", marginBottom: "0.5rem" }}>
            Acquisition Price
          </span>
          <div className="modal-price">{formatPrice(listing.price_cents, listing.currency)}</div>
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link href={`/listing/${listing.slug}`} className="btn-ghost btn-large">
            Full Page
          </Link>
          <button className="btn-primary btn-large" onClick={onAcquire}>
            Acquire Asset Now
          </button>
        </div>
      </div>
    </>
  );
}
