"use client";

import { useEffect, useState } from "react";
import { getPurchases, getSales, getMyListings, updateListing, markDelivered, confirmReceipt, fetchGithubRepos, getDeployments, getMe } from "../../lib/api";
import Link from "next/link";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("listings");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ price: "", videoUrl: "", demoUrl: "", extraDesc: "" });
  const [saving, setSaving] = useState(false);

  // GitHub Import State
  const [githubUsername, setGithubUsername] = useState("");
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [publishingRepo, setPublishingRepo] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    Promise.all([getMe(), getPurchases(), getSales(), getMyListings(), getDeployments()])
      .then(([me, p, s, ml, d]) => {
        setUser(me);
        setPurchases(p);
        setSales(s);
        setMyListings(ml);
        setDeployments(d);

        // Auto-fetch repositories if logged-in user has linked github account
        if (me?.github_username) {
          setGithubUsername(me.github_username);
          setFetchingRepos(true);
          fetchGithubRepos()
            .then((repos) => {
              if (Array.isArray(repos)) {
                setGithubRepos(repos);
              }
            })
            .catch((err) => {
              console.error("Auto-fetching repositories failed:", err);
            })
            .finally(() => {
              setFetchingRepos(false);
            });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const draftRepos = githubRepos
    .filter(repo => !myListings.find(l => l.github_repo_url === repo.html_url))
    .filter(repo => repo.name.toLowerCase().includes(filterQuery.toLowerCase()));

  const handleFetchRepos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUsername) return;
    setFetchingRepos(true);
    try {
      const data = await fetchGithubRepos(githubUsername);
      setGithubRepos(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to fetch repositories. Please make sure the username is correct.");
    } finally {
      setFetchingRepos(false);
    }
  };

  const handleAutoPublish = async (repo: any) => {
    setPublishingRepo(repo.name);
    try {
      const readmeRes = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/README.md`);
      const readmeText = readmeRes.ok ? await readmeRes.text() : repo.description || "No README found.";
      
      const { sellerEvaluate, sellerPublishListing } = await import("../../lib/api");
      const evalRes = await sellerEvaluate(readmeText);
      
      let pitchDeck = evalRes.pitch_deck;
      if (pitchDeck.title === "Generated Pitch (Fallback)") {
         pitchDeck.title = repo.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
         pitchDeck.short_description = repo.description || "A powerful open-source tool automatically evaluated by Ideora AI.";
         pitchDeck.suggested_price_cents = Math.floor(Math.random() * 50000) + 10000;
      }

      await sellerPublishListing({
        github_repo_url: repo.html_url,
        pitch_deck: pitchDeck,
        price_cents: pitchDeck.suggested_price_cents || 15000,
        visibility: "public"
      });

      const ml = await getMyListings();
      setMyListings(ml);
      setActiveTab("listings");
    } catch (err: any) {
      console.error(err);
      alert("Failed to auto-publish " + repo.name + ".\nReason: " + (err.message || String(err)));
    } finally {
      setPublishingRepo(null);
    }
  };

  const handleDeliver = async (id: string) => {
    await markDelivered(id);
    const s = await getSales();
    setSales(s);
  };

  const handleStartEdit = (l: any) => {
    setEditingId(l.id);
    setEditForm({
      price: (l.price_cents / 100).toFixed(2),
      videoUrl: l.demo_video_url || "",
      demoUrl: l.live_demo_url || "",
      extraDesc: l.pitch_deck?.extra_description || "",
    });
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      await updateListing(id, {
        price_cents: Math.round(parseFloat(editForm.price) * 100),
        demo_video_url: editForm.videoUrl || undefined,
        live_demo_url: editForm.demoUrl || undefined,
        extra_description: editForm.extraDesc || undefined,
      });
      const ml = await getMyListings();
      setMyListings(ml);
      setEditingId(null);
    } catch (err: any) {
      alert("Save failed: " + (err.message || String(err)));
    }
    setSaving(false);
  };

  const handleConfirm = async (id: string) => {
    await confirmReceipt(id);
    const p = await getPurchases();
    setPurchases(p);
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "5rem auto", padding: "0 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4rem" }}>
        <h1 className="gradient-text" style={{ fontSize: "3.5rem", margin: 0, fontFamily: "'Playfair Display', serif" }}>Command Center</h1>
        <Link href="/sell" className="premium-btn" style={{ textDecoration: "none", fontSize: "1rem", padding: "1rem 2rem" }}>
          Sell Codebase
        </Link>
      </div>

      <div style={{ display: "flex", gap: "3rem", marginBottom: "4rem", borderBottom: "2px solid var(--border-color)" }}>
        <button 
          onClick={() => setActiveTab("purchases")} 
          style={{ 
            background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "0 0 1rem 0", 
            fontWeight: activeTab === "purchases" ? "800" : "600", 
            color: activeTab === "purchases" ? "var(--accent-green)" : "var(--text-muted)",
            borderBottom: activeTab === "purchases" ? "3px solid var(--accent-gold)" : "3px solid transparent",
            transform: "translateY(2px)", transition: "all 0.3s"
          }}
        >
          My Acquisitions
        </button>
        <button 
          onClick={() => setActiveTab("listings")} 
          style={{ 
            background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "0 0 1rem 0", 
            fontWeight: activeTab === "listings" ? "800" : "600", 
            color: activeTab === "listings" ? "var(--accent-green)" : "var(--text-muted)",
            borderBottom: activeTab === "listings" ? "3px solid var(--accent-gold)" : "3px solid transparent",
            transform: "translateY(2px)", transition: "all 0.3s"
          }}
        >
          My Listings
        </button>
        <button 
          onClick={() => setActiveTab("sales")} 
          style={{ 
            background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "0 0 1rem 0", 
            fontWeight: activeTab === "sales" ? "800" : "600", 
            color: activeTab === "sales" ? "var(--accent-green)" : "var(--text-muted)",
            borderBottom: activeTab === "sales" ? "3px solid var(--accent-gold)" : "3px solid transparent",
            transform: "translateY(2px)", transition: "all 0.3s"
          }}
        >
          Escrow Sales
        </button>
        <button 
          onClick={() => setActiveTab("drafts")} 
          style={{ 
            background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "0 0 1rem 0", 
            fontWeight: activeTab === "drafts" ? "800" : "600", 
            color: activeTab === "drafts" ? "var(--accent-green)" : "var(--text-muted)",
            borderBottom: activeTab === "drafts" ? "3px solid var(--accent-gold)" : "3px solid transparent",
            transform: "translateY(2px)", transition: "all 0.3s"
          }}
        >
          Public Drafts
        </button>
        <button 
          onClick={() => setActiveTab("deployments")} 
          style={{ 
            background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "0 0 1rem 0", 
            fontWeight: activeTab === "deployments" ? "800" : "600", 
            color: activeTab === "deployments" ? "var(--accent-green)" : "var(--text-muted)",
            borderBottom: activeTab === "deployments" ? "3px solid var(--accent-gold)" : "3px solid transparent",
            transform: "translateY(2px)", transition: "all 0.3s"
          }}
        >
          My Deployments
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "5rem", color: "var(--text-muted)", fontSize: "1.2rem", animation: "fadeIn 0.5s" }}>
          Syncing escrow data...
        </div>
      ) : activeTab === "purchases" ? (
        <div style={{ animation: "fadeIn 0.4s" }}>
          {purchases.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: "center", padding: "5rem", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>You haven't acquired any tech yet.</p>
              <Link href="/" className="premium-btn" style={{ textDecoration: "none" }}>Browse Marketplace</Link>
            </div>
          ) : purchases.map((p) => (
            <div key={p.id} className="glass-panel" style={{ padding: "2.5rem", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "1.8rem", color: "var(--text-dark)", marginBottom: "0.5rem", fontFamily: "'Playfair Display', serif" }}>{p.listing?.title}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", marginBottom: "1rem" }}>Escrow Amount: <strong style={{ color: "var(--accent-green)" }}>${(p.amount_cents / 100).toFixed(2)}</strong></p>
                <div className={`status-badge status-${p.escrow_status}`}>
                  {p.escrow_status}
                </div>
              </div>
              {p.escrow_status === "delivered" && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem", maxWidth: "250px" }}>The seller has transferred the repo. Verify access and release funds.</p>
                  <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                    {p.github_repo_url && (
                      <a href={p.github_repo_url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: "0.8rem 1.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent-green)", color: "var(--accent-green)", textDecoration: "none" }}>
                        Access Codebase
                      </a>
                    )}
                    <button onClick={() => handleConfirm(p.id)} className="premium-btn" style={{ background: "linear-gradient(135deg, #047857, #10b981)" }}>
                      Confirm Receipt
                    </button>
                  </div>
                </div>
              )}
              {p.escrow_status === "released" && p.github_repo_url && (
                <div style={{ textAlign: "right" }}>
                  <a href={p.github_repo_url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: "0.8rem 1.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent-green)", color: "var(--accent-green)", textDecoration: "none" }}>
                    Access Codebase
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : activeTab === "listings" ? (
        <div style={{ animation: "fadeIn 0.4s" }}>
          {myListings.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: "center", padding: "5rem", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>You haven't listed any codebases yet.</p>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                <Link href="/sell" className="premium-btn" style={{ textDecoration: "none" }}>List Private Repo</Link>
                <button onClick={() => setActiveTab("drafts")} className="btn-ghost" style={{ padding: "0.8rem 1.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>Import Public Repos</button>
              </div>
            </div>
          ) : myListings.map((l) => (
            <div key={l.id} className="glass-panel" style={{ padding: "2.5rem", marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <h3 style={{ fontSize: "1.8rem", color: "var(--text-dark)", margin: 0, fontFamily: "'Playfair Display', serif" }}>{l.title}</h3>
                    <span style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem", borderRadius: "20px", background: l.visibility === "public" ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)", color: l.visibility === "public" ? "#10b981" : "#f59e0b", fontWeight: "bold", textTransform: "uppercase" }}>
                      {l.visibility || "private"}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", marginBottom: "0.5rem" }}>Price: <strong style={{ color: "var(--accent-green)" }}>${(l.price_cents / 100).toFixed(2)}</strong></p>
                  {l.demo_video_url && <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.3rem" }}>🎬 <a href={l.demo_video_url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>Demo Video</a></p>}
                  {l.live_demo_url && <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.3rem" }}>🌐 <a href={l.live_demo_url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>Live Demo</a></p>}
                  {l.pitch_deck?.extra_description && <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "0.5rem", fontStyle: "italic" }}>&ldquo;{l.pitch_deck.extra_description}&rdquo;</p>}
                  <div className={`status-badge status-${l.status}`} style={{ marginTop: "0.8rem" }}>{l.status}</div>
                </div>
                <button
                  onClick={() => editingId === l.id ? setEditingId(null) : handleStartEdit(l)}
                  style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-muted)", padding: "0.5rem 1.2rem", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", whiteSpace: "nowrap" }}
                >
                  {editingId === l.id ? "✕ Cancel" : "✏ Edit"}
                </button>
              </div>

              {editingId === l.id && (
                <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid var(--border-color)" }}>
                  <h4 style={{ fontSize: "1.05rem", color: "var(--text-dark)", marginBottom: "1.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Edit Listing</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem", marginBottom: "1.2rem" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Price (USD)</label>
                      <input type="number" step="0.01" min="1" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} style={{ width: "100%", padding: "0.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-dark)", borderRadius: "var(--radius-sm)", fontSize: "1rem", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Demo Video URL</label>
                      <input type="url" placeholder="https://youtube.com/watch?v=..." value={editForm.videoUrl} onChange={e => setEditForm(f => ({ ...f, videoUrl: e.target.value }))} style={{ width: "100%", padding: "0.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-dark)", borderRadius: "var(--radius-sm)", fontSize: "1rem", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Live Demo URL</label>
                      <input type="url" placeholder="https://myproject.vercel.app" value={editForm.demoUrl} onChange={e => setEditForm(f => ({ ...f, demoUrl: e.target.value }))} style={{ width: "100%", padding: "0.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-dark)", borderRadius: "var(--radius-sm)", fontSize: "1rem", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Extra Description / Seller Note</label>
                      <textarea rows={4} placeholder="Add extra context, selling points, or a personal note to buyers..." value={editForm.extraDesc} onChange={e => setEditForm(f => ({ ...f, extraDesc: e.target.value }))} style={{ width: "100%", padding: "0.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-dark)", borderRadius: "var(--radius-sm)", fontSize: "1rem", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                    <button onClick={() => setEditingId(null)} style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-muted)", padding: "0.7rem 1.5rem", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => handleSaveEdit(l.id)} disabled={saving} className="premium-btn" style={{ padding: "0.7rem 2rem" }}>
                      {saving ? "Saving..." : "💾 Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : activeTab === "sales" ? (
        <div style={{ animation: "fadeIn 0.4s" }}>
          {sales.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: "center", padding: "5rem", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>You don't have any escrow sales requiring delivery.</p>
            </div>
          ) : sales.map((s) => (
            <div key={s.id} className="glass-panel" style={{ padding: "2.5rem", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.8rem", color: "var(--text-dark)", margin: 0, fontFamily: "'Playfair Display', serif" }}>{s.listing?.title}</h3>
                  <span style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem", borderRadius: "20px", background: s.listing?.visibility === "public" ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)", color: s.listing?.visibility === "public" ? "#10b981" : "#f59e0b", fontWeight: "bold", textTransform: "uppercase" }}>
                    {s.listing?.visibility || "private"}
                  </span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", marginBottom: "1rem" }}>Earnings: <strong style={{ color: "var(--accent-green)" }}>${(s.amount_cents / 100).toFixed(2)}</strong></p>
                <div className={`status-badge status-${s.escrow_status}`}>
                  {s.escrow_status}
                </div>
              </div>
              {s.escrow_status === "held" && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem", maxWidth: "250px" }}>Send Codebase Link to Buyer.</p>
                  <button onClick={() => handleDeliver(s.id)} className="premium-btn" style={{ background: "linear-gradient(135deg, #1d4ed8, #3b82f6)" }}>
                    Mark as Transferred
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : activeTab === "deployments" ? (
        <div style={{ animation: "fadeIn 0.4s" }}>
          {deployments.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: "center", padding: "5rem", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>You haven't deployed any codebases to SaaSify yet.</p>
              <Link href="/deploy" className="premium-btn" style={{ textDecoration: "none" }}>SaaSify a Repo</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {deployments.map((d) => (
                <div key={d.id} className="glass-panel" style={{ padding: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.5rem", color: "var(--text-dark)", margin: "0 0 0.5rem 0", fontFamily: "'Playfair Display', serif" }}>
                      {d.subdomain}.ideora.app
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                      Source Repo: <a href={d.repo_url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>{d.repo_url}</a>
                    </p>
                    <span style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem", borderRadius: "20px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", fontWeight: "bold", textTransform: "uppercase" }}>
                      {d.pricing_tier} Tier
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <Link href={`/deploy/live/${d.id}`} className="btn-ghost" style={{ padding: "0.7rem 1.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent-gold)", color: "var(--accent-gold)", textDecoration: "none" }}>
                      Launch Live Console
                    </Link>
                    <a href={d.live_url} target="_blank" rel="noreferrer" className="premium-btn" style={{ textDecoration: "none", fontSize: "0.9rem", padding: "0.7rem 1.5rem" }}>
                      Open App URL
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ animation: "fadeIn 0.4s" }}>
          <div className="glass-panel" style={{ padding: "2.5rem", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "1.5rem", color: "var(--text-dark)", marginBottom: "1rem" }}>GitHub Importer</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>Search any public GitHub username to import their open-source repositories and evaluate them using AI.</p>
            <form onSubmit={handleFetchRepos} style={{ display: "flex", gap: "1rem" }}>
              <input 
                type="text" 
                placeholder="Enter GitHub Username (e.g. SagarBankapur142006 or any other user)..." 
                className="premium-input" 
                value={githubUsername} 
                onChange={(e) => setGithubUsername(e.target.value)} 
                required 
                style={{ flex: 1 }}
              />
              <button type="submit" disabled={fetchingRepos} className="premium-btn">
                {fetchingRepos ? "Searching..." : "Search User Repos"}
              </button>
            </form>
          </div>

          {githubRepos.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <h3 style={{ fontSize: "1.2rem", color: "var(--text-dark)", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>Public Repositories</h3>
                <input
                  type="text"
                  placeholder="Filter repositories by name..."
                  className="premium-input"
                  style={{ maxWidth: "300px", padding: "0.5rem 1rem", fontSize: "0.9rem" }}
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                />
              </div>

              {draftRepos.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No matching repositories found.</p>
              ) : (
                <div style={{ display: "grid", gap: "1.5rem" }}>
                  {draftRepos.map(repo => (
                    <div key={repo.id} className="glass-panel" style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h4 style={{ fontSize: "1.2rem", color: "var(--text-dark)", marginBottom: "0.3rem" }}>{repo.name}</h4>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: "500px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {repo.description || "No description provided."}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleAutoPublish(repo)} 
                        disabled={publishingRepo === repo.name}
                        className="btn-ghost" 
                        style={{ padding: "0.6rem 1.2rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent-gold)", color: "var(--accent-gold)" }}
                      >
                        {publishingRepo === repo.name ? "AI Analyzing..." : "✨ Auto-Publish"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
