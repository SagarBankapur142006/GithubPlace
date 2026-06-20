"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackgroundElements } from "@/components/BackgroundElements";
import { ListingCard, ListingDetailView } from "@/components/ListingCard";
import { Navbar } from "@/components/Navbar";
import { TiltImage } from "@/components/TiltImage";
import {
  fetchAutocomplete,
  fetchListings,
  fetchStats,
  type Listing,
} from "@/lib/api";
import { preprocessQuery } from "@/lib/search";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Listing[]>([]);
  const [resultsTitle, setResultsTitle] = useState("Search Results");
  const [showResults, setShowResults] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<{ title: string; category: string; slug: string }[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [spellSuggestion, setSpellSuggestion] = useState<string | null>(null);
  const [relatedTags, setRelatedTags] = useState<string[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [stats, setStats] = useState({ active_listings: 0, total_volume_cents: 0 });
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
    fetchListings({ sort: "score", limit: "6" })
      .then((data) => setFeaturedListings(data.items))
      .catch(() => {});
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("active")),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [showResults]);

  const handleSearch = useCallback(
    async (overrideQuery?: string, isExact = false) => {
      const q = (overrideQuery ?? query).trim();
      if (q.length < 2) return;

      setShowAutocomplete(false);
      setShowResults(true);

      const params: Record<string, string> = isExact ? { exact_title: q } : { q };
      const data = await fetchListings(params);
      setResults(data.items);
      setResultsTitle(`Found ${data.total} curated acquisitions for "${q}"`);

      if (data.suggested_query) {
        setSpellSuggestion(data.suggested_query);
      } else {
        setSpellSuggestion(null);
      }

      const tags = [...new Set(data.items.slice(0, 15).map((p) => p.category))].slice(0, 6);
      setRelatedTags(tags);

      setTimeout(() => {
        document.getElementById("searchResultsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
    [query]
  );

  const handleAutocomplete = useCallback(async (value: string) => {
    setQuery(value);
    if (value.length < 2) {
      setShowAutocomplete(false);
      setSpellSuggestion(null);
      return;
    }

    const { suggestedQuery } = preprocessQuery(value);
    setSpellSuggestion(suggestedQuery);

    try {
      const data = await fetchAutocomplete(value);
      setAutocompleteItems(data.items);
      setShowAutocomplete(data.items.length > 0);
    } catch {
      setShowAutocomplete(false);
    }
  }, []);

  const clearSearch = () => {
    setQuery("");
    setShowResults(false);
    setShowAutocomplete(false);
    setSpellSuggestion(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openModal = async (listing: Listing) => {
    const full = await fetch(`/api/listings/${listing.slug}`, { credentials: "include" }).then((r) => r.json());
    setSelectedListing(full);
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setSelectedListing(null);
    document.body.style.overflow = "auto";
  };

  const proceedToAcquire = (listing: Listing) => {
    sessionStorage.setItem("selectedListing", JSON.stringify(listing));
    router.push(`/checkout?listing=${listing.slug}`);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const volumeDisplay =
    stats.total_volume_cents > 0
      ? `$${Math.round(stats.total_volume_cents / 100 / 1_000_000)}M+`
      : "$15M+";

  return (
    <>
      <BackgroundElements />
      <Navbar />

      <header className="hero" style={{ position: "relative" }}>
        {/* Floating 3D Interactive Images */}
        <div style={{ position: "absolute", top: "10%", left: "5%", zIndex: 0 }}>
           <TiltImage src="/hero_laptop.png" alt="Code Editor" speed={-0.15} />
        </div>
        <div style={{ position: "absolute", bottom: "-5%", right: "5%", zIndex: 0 }}>
           <TiltImage src="/hero_rocket.png" alt="Launch Startup" speed={0.12} />
        </div>

        <div className="hero-content reveal">
          <div className="hero-badge">Premium Digital Assets</div>
          <h1>
            Discover. Validate. <span className="highlight">Acquire.</span>
          </h1>
          <p>
            The exclusive marketplace for visionary entrepreneurs to acquire high-potential tech projects,
            validated MVPs, and scalable startup architectures.
          </p>
          <div className="search-wrapper" ref={searchWrapperRef}>
            <div className="search-container">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                id="searchInput"
                placeholder="Search AI, Climatetech, Agritech, Fintech..."
                autoComplete="off"
                value={query}
                onChange={(e) => handleAutocomplete(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button id="searchBtn" className="btn-primary" onClick={() => handleSearch()}>
                Search
              </button>
            </div>
            {showAutocomplete && (
              <div id="autocompleteDropdown" className="autocomplete-dropdown">
                {autocompleteItems.map((item) => (
                  <div
                    key={item.slug}
                    className="suggestion-item"
                    onClick={() => {
                      setQuery(item.title);
                      setShowAutocomplete(false);
                      handleSearch(item.title, true);
                    }}
                  >
                    <span>{item.title}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{item.category}</span>
                  </div>
                ))}
              </div>
            )}
            {spellSuggestion && !showAutocomplete && (
              <div id="spellCheckSuggestion" className="spellcheck-suggestion">
                Did you mean:{" "}
                <span onClick={() => { setQuery(spellSuggestion); handleSearch(spellSuggestion); }}>
                  {spellSuggestion}
                </span>
              </div>
            )}
          </div>

          <div className="trust-banner">
            <div className="trust-stat">
              <span className="trust-num">{stats.active_listings || "200"}+</span>
              <span className="trust-label">Verified Projects</span>
            </div>
            <div className="trust-stat">
              <span className="trust-num">{volumeDisplay}</span>
              <span className="trust-label">Acquisition Volume</span>
            </div>
            <div className="trust-stat">
              <span className="trust-num">100%</span>
              <span className="trust-label">Secure Delivery</span>
            </div>
          </div>
        </div>
      </header>

      <main id="searchResultsSection" className={showResults ? "" : "hidden"}>
        <div className="results-header reveal">
          <h2 id="resultsTitle">{resultsTitle}</h2>
          <button id="clearSearchBtn" className="btn-ghost" onClick={clearSearch}>
            Clear Search
          </button>
        </div>
        <div className="grid-container" id="projectGrid">
          {results.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "4rem 0" }} className="scale-in">
              <h3 style={{ fontSize: "2.2rem", color: "var(--accent-green)", marginBottom: "1rem", fontFamily: "'Playfair Display', serif" }}>
                No exact matches found
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
                Try adjusting your terminology or exploring a broader sector.
              </p>
            </div>
          ) : (
            results.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} index={i} onOpenModal={openModal} />
            ))
          )}
        </div>

        {relatedTags.length > 0 && (
          <div id="relatedSearchesSection" className="related-searches reveal">
            <h3>Explore Categories</h3>
            <div className="related-tags" id="relatedTags">
              {relatedTags.map((tag) => (
                <span
                  key={tag}
                  className="related-tag"
                  onClick={() => {
                    setQuery(tag);
                    handleSearch(tag);
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      <div id="homePageContent" className={showResults ? "hidden" : ""}>

        {featuredListings.length > 0 && (
          <section style={{ padding: "6rem 2rem 4rem", maxWidth: "1400px", margin: "0 auto" }}>
            <div className="section-title" style={{ marginBottom: "3rem" }}>
              <h2 style={{ fontSize: "2.8rem", fontFamily: "'Playfair Display', serif" }}>
                🏆 Top-Rated Projects
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "1.15rem" }}>
                AI-evaluated, creator-verified codebases ready for acquisition.
              </p>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "2rem",
            }}>
              {featuredListings.map((listing, i) => (
                <div
                  key={listing.id}
                  className="glass-panel"
                  style={{
                    padding: "2rem",
                    cursor: "pointer",
                    transition: "transform 0.3s, box-shadow 0.3s",
                    borderTop: "3px solid var(--accent-gold)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onClick={() => openModal(listing)}
                  onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-6px)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
                >
                  {/* Score badge */}
                  <div style={{
                    position: "absolute", top: "1.2rem", right: "1.2rem",
                    background: "linear-gradient(135deg, var(--accent-gold), #f97316)",
                    color: "#000", fontWeight: "800", fontSize: "0.85rem",
                    padding: "0.3rem 0.7rem", borderRadius: "20px",
                  }}>
                    ⭐ {listing.growth_potential_score}/100
                  </div>

                  {/* Category chip */}
                  <div style={{
                    display: "inline-block",
                    background: "rgba(16,185,129,0.1)", color: "var(--accent-green)",
                    padding: "0.2rem 0.75rem", borderRadius: "20px",
                    fontSize: "0.8rem", fontWeight: "600", marginBottom: "1rem", textTransform: "uppercase",
                  }}>
                    {listing.category}
                  </div>

                  <h3 style={{
                    fontSize: "1.45rem", fontFamily: "'Playfair Display', serif",
                    color: "var(--text-dark)", marginBottom: "0.6rem", lineHeight: "1.3",
                    paddingRight: "4rem",
                  }}>
                    {listing.title}
                  </h3>

                  <p style={{
                    color: "var(--text-muted)", fontSize: "0.95rem",
                    lineHeight: "1.6", marginBottom: "1.5rem",
                    display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {listing.short_description}
                  </p>

                  {/* Tech stack pills */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.5rem" }}>
                    {listing.tech_stack.slice(0, 3).map((t) => (
                      <span key={t} style={{
                        background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)",
                        color: "var(--text-muted)", padding: "0.2rem 0.6rem",
                        borderRadius: "6px", fontSize: "0.78rem",
                      }}>{t}</span>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{
                      fontSize: "1.6rem", fontWeight: "800",
                      background: "linear-gradient(135deg, var(--accent-green), var(--accent-gold))",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>
                      ${(listing.price_cents / 100).toFixed(0)}
                    </span>
                    <button
                      className="btn-primary"
                      style={{ padding: "0.6rem 1.4rem", fontSize: "0.9rem" }}
                      onClick={(e) => { e.stopPropagation(); openModal(listing); }}
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="features" id="whyUs">
          <div className="section-title reveal">
            <h2>The Ideora Advantage</h2>
            <p>Accelerate your entrepreneurial journey with premium, production-ready assets.</p>
          </div>
          <div className="feature-grid">
            <div className="feature-card reveal" style={{ transitionDelay: "0.1s" }}>
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
              </div>
              <h3>Launch Faster</h3>
              <p>Bypass months of costly development. Acquire fully validated MVPs and enter your target market instantly with a competitive edge.</p>
            </div>
            <div className="feature-card reveal" style={{ transitionDelay: "0.2s" }}>
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              </div>
              <h3>Verified Codebases</h3>
              <p>Every listed project undergoes rigorous automated and manual code quality checks, ensuring robust, scalable, and secure architectures.</p>
            </div>
            <div className="feature-card reveal" style={{ transitionDelay: "0.3s" }}>
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <h3>Packaged Delivery</h3>
              <p>Receive complete source code packages with usage rights documentation. Verify license terms for your commercial deployment needs.</p>
            </div>
          </div>
        </section>

        <section className="how-it-works" id="howItWorks">
          <div className="section-title reveal">
            <h2>The Acquisition Process</h2>
          </div>
          <div className="steps-container">
            <div className="step reveal" style={{ transitionDelay: "0.1s" }}>
              <div className="step-number">01</div>
              <h3>Discover</h3>
              <p>Search our curated database of premium projects across high-growth tech sectors.</p>
            </div>
            <div className="step-line reveal" style={{ transitionDelay: "0.2s" }}></div>
            <div className="step reveal" style={{ transitionDelay: "0.3s" }}>
              <div className="step-number">02</div>
              <h3>Validate</h3>
              <p>Review comprehensive expert analysis, potential scaling percentages, and core tech stacks.</p>
            </div>
            <div className="step-line reveal" style={{ transitionDelay: "0.4s" }}></div>
            <div className="step reveal" style={{ transitionDelay: "0.5s" }}>
              <div className="step-number">03</div>
              <h3>Acquire</h3>
              <p>Create your account during checkout to securely purchase and download your packaged codebase.</p>
            </div>
          </div>
        </section>

        <footer className="main-footer">
          <div className="footer-content reveal">
            <div className="footer-brand">
              <h2>Ideora.</h2>
              <p>Empowering the next generation of visionary founders with elite digital assets.</p>
            </div>
            <div className="footer-links">
              <div className="link-column">
                <h4>Platform</h4>
                <a href="#">Browse Projects</a>
                <a href="#">Pricing Structure</a>
              </div>
              <div className="link-column">
                <h4>Legal</h4>
                <a href="#">Terms of Service</a>
                <a href="#">Privacy Policy</a>
                <a href="#">Usage Rights</a>
              </div>
              <div className="link-column">
                <h4>Contact Us</h4>
                <a href="mailto:support@ideora.com">Email: support@ideora.com</a>
                <p>Tel: 9449364062</p>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 Ideora Marketplace. All rights reserved.</p>
          </div>
        </footer>
      </div>

      {selectedListing && (
        <div id="projectModal" className="modal">
          <div className="modal-backdrop" onClick={closeModal}></div>
          <div className="modal-content">
            <ListingDetailView
              listing={selectedListing}
              showClose
              onClose={closeModal}
              onAcquire={() => proceedToAcquire(selectedListing)}
            />
          </div>
        </div>
      )}
    </>
  );
}
