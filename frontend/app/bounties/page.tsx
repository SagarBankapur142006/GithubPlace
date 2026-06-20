"use client";

import { useEffect, useState } from "react";
import { getBounties, createBounty, resolveBounty } from "../../lib/api";
import { Navbar } from "../../components/Navbar";

export default function BountiesPage() {
  const [bounties, setBounties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueUrl, setIssueUrl] = useState("");
  const [amountDollars, setAmountDollars] = useState(50);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchBounties = async () => {
    setLoading(true);
    try {
      const b = await getBounties();
      setBounties(b);
    } catch {
      setBounties([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchBounties(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await createBounty({ github_issue_url: issueUrl, amount_cents: amountDollars * 100 });
      setIssueUrl("");
      setAmountDollars(50);
      await fetchBounties();
    } catch (err: any) {
      setError(err.message || "Failed to create bounty. Please sign in first.");
    }
    setCreating(false);
  };

  const handleResolve = async (id: string) => {
    await resolveBounty(id);
    await fetchBounties();
  };

  const openCount = bounties.filter(b => b.status === "open").length;
  const totalPool = bounties.filter(b => b.status === "open").reduce((s, b) => s + b.amount_cents, 0);

  return (
    <>
      <Navbar />
      <div style={{ minHeight: "100vh", padding: "8rem 2rem 4rem", maxWidth: "1100px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <div style={{
            display: "inline-block", background: "rgba(59,130,246,0.12)", color: "#60a5fa",
            padding: "0.3rem 1rem", borderRadius: "20px", fontSize: "0.85rem",
            fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.2rem"
          }}>
            Open Source Rewards
          </div>
          <h1 style={{ fontSize: "3.2rem", fontFamily: "'Playfair Display', serif", color: "var(--text-dark)", marginBottom: "1rem", lineHeight: 1.15 }}>
            Bounties
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1.15rem", maxWidth: "600px", lineHeight: 1.7 }}>
            Fund any public GitHub issue. When a contributor merges a fixing PR, they claim the reward automatically.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "1.5rem", marginBottom: "3rem", flexWrap: "wrap" }}>
          {[
            { label: "Open Bounties", value: openCount },
            { label: "Total Pool", value: `$${(totalPool / 100).toFixed(0)}` },
            { label: "Resolved", value: bounties.filter(b => b.status === "resolved").length },
          ].map(stat => (
            <div key={stat.label} className="glass-panel" style={{ padding: "1.5rem 2rem", flex: "1 1 160px", minWidth: "140px" }}>
              <div style={{ fontSize: "2rem", fontWeight: "800", color: "var(--accent-green)", fontFamily: "'Playfair Display', serif" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.3rem" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Create form */}
        <div className="glass-panel" style={{ padding: "2.5rem", marginBottom: "3rem", borderTop: "3px solid #3b82f6" }}>
          <h2 style={{ fontSize: "1.6rem", fontFamily: "'Playfair Display', serif", marginBottom: "0.4rem", color: "var(--text-dark)" }}>
            💰 Fund a New Bounty
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: "2rem" }}>
            Paste any public GitHub issue link and set your reward amount.
          </p>
          <form onSubmit={handleCreate} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 360px" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                GitHub Issue URL
              </label>
              <input
                type="url"
                required
                placeholder="https://github.com/owner/repo/issues/123"
                value={issueUrl}
                onChange={e => setIssueUrl(e.target.value)}
                style={{
                  width: "100%", padding: "0.9rem 1.1rem", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)",
                  color: "var(--text-dark)", borderRadius: "var(--radius-sm)", fontSize: "1rem",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ width: "160px" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Reward (USD)
              </label>
              <input
                type="number"
                required
                min="10"
                value={amountDollars}
                onChange={e => setAmountDollars(parseFloat(e.target.value))}
                style={{
                  width: "100%", padding: "0.9rem 1.1rem", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)",
                  color: "var(--text-dark)", borderRadius: "var(--radius-sm)", fontSize: "1rem",
                  outline: "none",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="btn-primary"
              style={{ padding: "0.9rem 2rem", height: "50px", whiteSpace: "nowrap" }}
            >
              {creating ? "Funding..." : "Fund Bounty →"}
            </button>
          </form>
          {error && (
            <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#f87171", fontSize: "0.9rem" }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Bounties list */}
        <h2 style={{ fontSize: "1.8rem", fontFamily: "'Playfair Display', serif", marginBottom: "1.5rem", color: "var(--text-dark)" }}>
          Active Bounties
        </h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>Loading bounties...</div>
        ) : bounties.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎯</div>
            <p style={{ fontSize: "1.1rem" }}>No bounties yet. Be the first to fund one!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {bounties.map(b => (
              <div
                key={b.id}
                className="glass-panel"
                style={{
                  padding: "1.8rem 2rem",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  flexWrap: "wrap", gap: "1rem",
                  borderLeft: `4px solid ${b.status === "open" ? "#3b82f6" : "#10b981"}`,
                  opacity: b.status === "resolved" ? 0.7 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: "260px" }}>
                  <a
                    href={b.github_issue_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "1.1rem", color: "#60a5fa", textDecoration: "none", fontWeight: "600", display: "block", marginBottom: "0.5rem" }}
                  >
                    🔗 {b.github_issue_url.replace("https://github.com/", "")}
                  </a>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <span style={{ fontSize: "1.6rem", fontWeight: "800", color: "var(--accent-green)" }}>
                      ${(b.amount_cents / 100).toFixed(0)}
                    </span>
                    <span style={{
                      padding: "0.2rem 0.7rem", borderRadius: "20px", fontSize: "0.78rem",
                      fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em",
                      background: b.status === "open" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)",
                      color: b.status === "open" ? "#60a5fa" : "#10b981",
                    }}>
                      {b.status}
                    </span>
                  </div>
                </div>

                {b.status === "open" && (
                  <button
                    onClick={() => handleResolve(b.id)}
                    style={{
                      background: "transparent", color: "#10b981",
                      border: "1px solid #10b981", padding: "0.65rem 1.4rem",
                      borderRadius: "var(--radius-sm)", cursor: "pointer",
                      fontWeight: "700", fontSize: "0.9rem",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.12)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    ✅ Simulate PR Merge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
