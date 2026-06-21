"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { detectFramework, createDeployment } from "../../lib/api";
import { Navbar } from "../../components/Navbar";

export default function DeployPage() {
  const router = useRouter();

  // Config parameters
  const [repoUrl, setRepoUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [pricingTier, setPricingTier] = useState("Pro");
  const [detectedStack, setDetectedStack] = useState("");

  const [step, setStep] = useState(1); // 1: Config, 2: Deploying Logs
  const [detecting, setDetecting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deploymentId, setDeploymentId] = useState("");
  const [error, setError] = useState("");

  // Auto detect framework when repoUrl looks complete
  useEffect(() => {
    if (repoUrl.startsWith("https://github.com/") && repoUrl.split("/").length >= 5) {
      const handleDetect = async () => {
        setDetecting(true);
        try {
          const res = await detectFramework(repoUrl);
          setDetectedStack(res.framework);
          // Suggest app name from repo name
          const segments = repoUrl.split("/");
          const repoName = segments[segments.length - 1].replace(".git", "");
          setAppName(repoName.charAt(0).toUpperCase() + repoName.slice(1));
          setSubdomain(repoName.toLowerCase().replace(/[^a-z0-9]/g, ""));
        } catch {
          setDetectedStack("Generic Service");
        } finally {
          setDetecting(false);
        }
      };
      handleDetect();
    } else {
      setDetectedStack("");
    }
  }, [repoUrl]);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl || !appName || !subdomain) return;
    setError("");
    setStep(2);
    setDeploying(true);
    setLogs(["Initializing secure container...", "Cloning repository " + repoUrl]);

    // Backend deployment logic
    let deployId = "";
    try {
      const dep = await createDeployment({
        repo_url: repoUrl,
        subdomain: subdomain.toLowerCase().replace(/[^a-z0-9]/g, ""),
        pricing_tier: pricingTier,
        app_name: appName
      });
      deployId = dep.id;
      setDeploymentId(dep.id);
    } catch (err: any) {
      setError(err.message || "Failed to create deployment. Subdomain might be taken.");
      setDeploying(false);
      setStep(1);
      return;
    }

    const messages = [
      `Detected environment stack: ${detectedStack || "Generic"}`,
      "Analyzing project dependencies...",
      "Installing packages (optimizing node_modules cache)...",
      "Running production build pipeline...",
      "Building static optimization maps...",
      "Generating AI preview dashboard layout...",
      "Configuring container reverse-proxy and SSL certificates...",
      "Deployment successful! Container is healthy."
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        setLogs(prev => [...prev, messages[i]]);
        i++;
      } else {
        clearInterval(interval);
        setDeploying(false);
        // Auto-redirect to live dashboard after a short delay
        setTimeout(() => {
          router.push(`/deploy/live/${deployId}`);
        }, 1200);
      }
    }, 700);
  };

  return (
    <>
      <Navbar />
      <div style={{ minHeight: "100vh", padding: "8rem 2rem 4rem", maxWidth: "900px", margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent-gold)", fontSize: "0.85rem", fontWeight: "700", textAlign: "center", marginBottom: "0.5rem" }}>
          Instant SaaSification
        </div>
        <h1 style={{ fontSize: "3rem", marginBottom: "10px", textAlign: "center", fontFamily: "'Playfair Display', serif" }}>Launch Any Repository</h1>
        <p style={{ fontSize: "1.15rem", color: "var(--text-muted)", marginBottom: "3rem", textAlign: "center", maxWidth: "600px", margin: "0 auto 3rem auto" }}>
          Deploy your codebase into a fully operational SaaS simulation with AI-powered dashboards and user analytics.
        </p>

        {step === 1 ? (
          <form onSubmit={handleDeploy} className="glass-panel" style={{ padding: "3rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
            
            {/* Repo Input */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                GitHub Repository URL
              </label>
              <input 
                type="url" 
                required 
                placeholder="https://github.com/your/opensource-repo" 
                value={repoUrl} 
                onChange={e => setRepoUrl(e.target.value)} 
                style={{ width: "100%", padding: "1rem", boxSizing: "border-box", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", color: "#fff", borderRadius: "8px", fontSize: "1rem" }} 
              />
              {detecting && <p style={{ fontSize: "0.85rem", color: "var(--accent-gold)", marginTop: "0.5rem" }}>Scanning repository files...</p>}
              {!detecting && detectedStack && (
                <p style={{ fontSize: "0.85rem", color: "var(--accent-green)", marginTop: "0.5rem" }}>
                  ✔ Framework detected: <strong>{detectedStack}</strong>
                </p>
              )}
            </div>

            {/* Custom App Name & Subdomain */}
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 280px" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  SaaS Application Name
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Stripe Clone" 
                  value={appName} 
                  onChange={e => setAppName(e.target.value)} 
                  style={{ width: "100%", padding: "1rem", boxSizing: "border-box", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", color: "#fff", borderRadius: "8px", fontSize: "1rem" }} 
                />
              </div>

              <div style={{ flex: "1 1 280px" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Target Subdomain
                </label>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input 
                    type="text" 
                    required 
                    placeholder="subdomain" 
                    value={subdomain} 
                    onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} 
                    style={{ flex: 1, padding: "1rem", boxSizing: "border-box", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", borderRight: "none", color: "#fff", borderRadius: "8px 0 0 8px", fontSize: "1rem", textAlign: "right" }} 
                  />
                  <span style={{ padding: "1rem 1.2rem", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "var(--text-muted)", borderRadius: "0 8px 8px 0", fontSize: "1rem" }}>
                    .ideora.app
                  </span>
                </div>
              </div>
            </div>

            {/* Pricing Tier Select */}
            <div>
              <label style={{ display: "block", marginBottom: "0.8rem", fontWeight: "600", fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Select Monetization Tier
              </label>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                {[
                  { name: "Free", price: "$0", desc: "Basic functionality, limited API calls" },
                  { name: "Pro", price: "$29/mo", desc: "Core SaaS dashboards, premium widgets" },
                  { name: "Enterprise", price: "$149/mo", desc: "Full white-labeled, dedicated server node" }
                ].map(tier => (
                  <div 
                    key={tier.name}
                    onClick={() => setPricingTier(tier.name)}
                    style={{
                      flex: "1 1 200px", padding: "1.5rem", borderRadius: "10px", border: `1px solid ${pricingTier === tier.name ? "var(--accent-gold)" : "var(--border-color)"}`,
                      background: pricingTier === tier.name ? "rgba(212, 175, 55, 0.05)" : "rgba(0,0,0,0.2)", cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", alignItems: "center" }}>
                      <strong style={{ fontSize: "1.1rem" }}>{tier.name}</strong>
                      <span style={{ color: "var(--accent-green)", fontWeight: "700" }}>{tier.price}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: "1.4" }}>{tier.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ padding: "0.8rem 1.2rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: "6px", fontSize: "0.9rem" }}>
                ⚠ {error}
              </div>
            )}

            <button 
              type="submit" 
              className="btn-primary btn-large"
              style={{ width: "100%", padding: "1.1rem", fontSize: "1.1rem", fontWeight: "700" }}
            >
              Start Deployment Node →
            </button>
          </form>
        ) : (
          <div style={{ background: "#000", border: "1px solid #333", borderRadius: "8px", padding: "20px", fontFamily: "monospace", minHeight: "300px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }}></div>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }}></div>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }}></div>
            </div>
            
            {logs.map((log, index) => (
              <div key={index} style={{ color: index === logs.length - 1 && !deploying ? "#10b981" : "#a1a1aa", marginBottom: "8px" }}>
                <span style={{ color: "#3b82f6", marginRight: "10px" }}>{">"}</span> {log}
              </div>
            ))}

            {!deploying && (
              <div style={{ marginTop: "30px", padding: "20px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", textAlign: "center" }}>
                <h3 style={{ color: "#10b981", margin: "0 0 10px 0" }}>Node Registered successfully!</h3>
                <p style={{ color: "var(--text-muted)", margin: "0 0 15px 0", fontSize: "0.9rem" }}>Redirecting to your live dashboard application...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
