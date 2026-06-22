"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sellerEvaluate, sellerPublishListing, getMe } from "../../lib/api";
import { Navbar } from "../../components/Navbar";

function SellForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [readme, setReadme] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [pitchDeck, setPitchDeck] = useState<any>(null);
  const [priceCents, setPriceCents] = useState(15000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setCheckingUser(false);
      })
      .catch(() => {
        setCheckingUser(false);
        router.push("/signin?redirect=sell");
      });
  }, [router]);

  useEffect(() => {
    const url = searchParams.get("github_url");
    if (url) {
      setGithubUrl(url);
    }
  }, [searchParams]);

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await sellerEvaluate(readme);
      setPitchDeck(res.pitch_deck);
      if (res.pitch_deck.suggested_price_cents) {
        setPriceCents(res.pitch_deck.suggested_price_cents);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    setError("");
    try {
      await sellerPublishListing({
        github_repo_url: githubUrl,
        pitch_deck: pitchDeck,
        price_cents: priceCents,
        visibility: "private",
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (checkingUser) {
    return (
      <>
        <Navbar />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", color: "var(--text-muted)", fontSize: "1.2rem" }}>
          Authenticating access...
        </div>
      </>
    );
  }

  if (!user || !user.github_username) {
    return (
      <>
        <Navbar />
        <div style={{ maxWidth: "600px", margin: "10rem auto 6rem auto", padding: "0 20px" }}>
          <div className="glass-panel" style={{ padding: "4rem", textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "1.5rem" }}>🔒</div>
            <h2 style={{ fontSize: "2.2rem", color: "var(--accent-green)", marginBottom: "1.5rem", fontFamily: "'Playfair Display', serif" }}>Creator Account Required</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", marginBottom: "2.5rem", lineHeight: "1.6" }}>
              To list private repositories and generate AI pitch decks, you must sign in as a **Creator** using GitHub.
            </p>
            <button onClick={() => router.push("/signin?redirect=sell")} className="premium-btn">
              Sign In as Creator
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: "850px", margin: "8rem auto 6rem auto", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: "4rem" }}>
        <h1 className="gradient-text" style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>List a Private Codebase</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>Turn your hard work into an acquisition target in minutes using AI.</p>
      </div>

      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "15px 20px", borderRadius: "10px", marginBottom: "2rem", border: "1px solid rgba(239, 68, 68, 0.2)", animation: "fadeIn 0.3s" }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {step === 1 && (
        <form onSubmit={handleEvaluate} className="glass-panel" style={{ padding: "3rem", animation: "fadeIn 0.5s" }}>
          <div style={{ marginBottom: "2rem" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "700", color: "var(--text-dark)", textTransform: "uppercase", letterSpacing: "1px", fontSize: "0.9rem" }}>GitHub Repository URL</label>
            <input type="url" placeholder="https://github.com/you/repo" required className="premium-input" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
          </div>
          
          <div style={{ marginBottom: "3rem" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "700", color: "var(--text-dark)", textTransform: "uppercase", letterSpacing: "1px", fontSize: "0.9rem" }}>README.md Content</label>
            <textarea placeholder="Paste your entire README here. Our AI will automatically extract the problem, solution, and tech stack to generate an investor pitch deck..." required rows={10} className="premium-input" style={{ fontFamily: "monospace", resize: "vertical" }} value={readme} onChange={(e) => setReadme(e.target.value)} />
          </div>
          
          <button type="submit" disabled={loading} className="premium-btn" style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
            {loading ? "✨ AI is Analyzing Codebase..." : "✨ Generate AI Pitch Deck"}
          </button>
        </form>
      )}

      {step === 2 && pitchDeck && (
        <div style={{ animation: "fadeIn 0.6s ease-out" }}>
          <div className="glass-panel" style={{ padding: "3rem", marginBottom: "3rem", background: "var(--bg-white)" }}>
            <span style={{ color: "var(--accent-gold)", fontWeight: "800", letterSpacing: "2px", textTransform: "uppercase", fontSize: "0.85rem" }}>Step 2: Review Generated Pitch</span>
            <h2 style={{ fontSize: "2.5rem", color: "var(--accent-green)", marginTop: "1rem", marginBottom: "1.5rem", fontFamily: "'Playfair Display', serif" }}>{pitchDeck.title}</h2>
            <p style={{ fontSize: "1.2rem", color: "var(--text-muted)", marginBottom: "2.5rem", lineHeight: "1.7" }}>{pitchDeck.short_description}</p>
            
            <div style={{ borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", padding: "2.5rem 0", marginBottom: "2.5rem", display: "grid", gap: "2rem" }}>
              <div>
                <h4 style={{ color: "var(--text-dark)", fontWeight: "700", marginBottom: "0.8rem", textTransform: "uppercase", fontSize: "0.9rem", letterSpacing: "1px" }}>Problem</h4>
                <p style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>{pitchDeck.problem}</p>
              </div>
              <div>
                <h4 style={{ color: "var(--text-dark)", fontWeight: "700", marginBottom: "0.8rem", textTransform: "uppercase", fontSize: "0.9rem", letterSpacing: "1px" }}>Solution</h4>
                <p style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>{pitchDeck.solution}</p>
              </div>
              <div>
                <h4 style={{ color: "var(--text-dark)", fontWeight: "700", marginBottom: "0.8rem", textTransform: "uppercase", fontSize: "0.9rem", letterSpacing: "1px" }}>Target Audience</h4>
                <p style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>{pitchDeck.target_audience}</p>
              </div>
            </div>

            {/* Growth Potential Score Showcase */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "2rem",
              background: "linear-gradient(135deg, var(--accent-green), #07170e)",
              color: "var(--bg-cream)",
              padding: "2rem",
              borderRadius: "var(--radius-md)",
              marginBottom: "2.5rem",
              boxShadow: "0 10px 30px rgba(13, 40, 24, 0.15)",
              border: "1px solid rgba(212, 175, 55, 0.2)",
              flexWrap: "wrap"
            }}>
              <div style={{
                position: "relative",
                width: "90px",
                height: "90px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent-gold), #f97316)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                fontWeight: "900",
                color: "#000",
                boxShadow: "0 0 20px rgba(212, 175, 55, 0.4)",
                flexShrink: 0
              }}>
                {pitchDeck.growth_potential_score}
              </div>
              <div style={{ flex: 1, minWidth: "250px" }}>
                <h3 style={{
                  fontSize: "1.4rem",
                  fontFamily: "'Playfair Display', serif",
                  color: "var(--accent-gold)",
                  marginBottom: "0.4rem"
                }}>
                  Growth Potential: {pitchDeck.growth_potential_score}/100
                </h3>
                <p style={{
                  fontSize: "0.95rem",
                  color: "#9ab0a2",
                  lineHeight: "1.5"
                }}>
                  {pitchDeck.growth_potential_score >= 90 ? (
                    "Elite Tier: Exceptional codebase architecture and market alignment. Positioned for rapid scaling and high-margin monetization."
                  ) : pitchDeck.growth_potential_score >= 70 ? (
                    "Strong Tier: High-quality structure with verified workflows. Solid foundation ready for immediate product launching and customer acquisition."
                  ) : pitchDeck.growth_potential_score >= 50 ? (
                    "Moderate Tier: Functional codebase that presents a solid MVP. Needs targeted marketing and feature expansion to unlock its full valuation."
                  ) : (
                    "Fixer-Upper Tier: Early-stage prototype. Represents a blank canvas with significant customization requirements to achieve market viability."
                  )}
                </p>
              </div>
            </div>

            <div style={{ background: "rgba(212, 175, 55, 0.05)", padding: "2rem", borderRadius: "var(--radius-sm)", border: "1px solid rgba(212, 175, 55, 0.2)", marginBottom: "3rem" }}>
              <h4 style={{ color: "var(--accent-gold)", fontWeight: "800", marginBottom: "0.8rem", textTransform: "uppercase", fontSize: "0.85rem", letterSpacing: "1px" }}>Expert Analysis</h4>
              <p style={{ color: "var(--text-dark)", fontStyle: "italic", lineHeight: "1.7" }}>"{pitchDeck.expert_analysis}"</p>
            </div>
          
            <div style={{ marginBottom: "2rem" }}>
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "700", color: "var(--text-dark)", textTransform: "uppercase", letterSpacing: "1px", fontSize: "0.9rem" }}>Final Listing Price (USD)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "1.2rem", top: "50%", transform: "translateY(-50%)", fontSize: "1.2rem", color: "var(--text-muted)", fontWeight: "bold" }}>$</span>
                <input 
                  type="number" 
                  className="premium-input"
                  style={{ paddingLeft: "2.5rem", fontSize: "1.3rem", fontWeight: "bold", color: "var(--accent-green)" }}
                  value={priceCents / 100} 
                  onChange={(e) => setPriceCents(Math.round(parseFloat(e.target.value) * 100))} 
                />
              </div>
            </div>
            
            <button onClick={handlePublish} disabled={loading} className="premium-btn" style={{ width: "100%", padding: "1.4rem" }}>
              {loading ? "Publishing to Marketplace..." : "Publish to Marketplace"}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default function SellPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "6rem auto" }}>Loading form...</div>}>
      <SellForm />
    </Suspense>
  );
}
