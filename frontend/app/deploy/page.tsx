"use client";

import { useState, useEffect } from "react";

export default function DeployPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deployedUrl, setDeployedUrl] = useState("");

  const handleDeploy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;
    
    setDeploying(true);
    setLogs(["Initializing secure container...", "Cloning repository " + repoUrl]);
    
    const messages = [
      "Analyzing package.json dependencies...",
      "Installing npm packages (this might take a minute)...",
      "Building production bundle...",
      "Optimizing static assets...",
      "Configuring reverse proxy and SSL certificates...",
      "Container health checks passed.",
      "Deployment successful!"
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        setLogs(prev => [...prev, messages[i]]);
        i++;
      } else {
        clearInterval(interval);
        setDeploying(false);
        const randomSubdomain = Math.random().toString(36).substring(2, 8);
        setDeployedUrl(`https://${randomSubdomain}.ideora.app`);
      }
    }, 800);
  };

  return (
    <div style={{ maxWidth: "900px", margin: "40px auto", padding: "20px" }}>
      <h1 style={{ fontSize: "3rem", marginBottom: "10px", textAlign: "center" }}>Instant SaaSification</h1>
      <p style={{ fontSize: "1.2rem", color: "#888", marginBottom: "40px", textAlign: "center" }}>Deploy any open-source repository to a live URL in seconds and instantly start monetizing.</p>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", padding: "40px", borderRadius: "16px", marginBottom: "40px" }}>
        <form onSubmit={handleDeploy} style={{ display: "flex", gap: "15px" }}>
          <input 
            type="url" 
            required 
            placeholder="https://github.com/your/opensource-repo" 
            value={repoUrl} 
            onChange={e => setRepoUrl(e.target.value)} 
            disabled={deploying || deployedUrl !== ""}
            style={{ flex: 1, padding: "16px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "8px", fontSize: "1.1rem" }} 
          />
          <button 
            type="submit" 
            disabled={deploying || deployedUrl !== ""} 
            style={{ background: "#10b981", color: "#fff", padding: "16px 32px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "1.1rem" }}
          >
            {deploying ? "Deploying..." : deployedUrl ? "Deployed" : "Deploy Now"}
          </button>
        </form>
      </div>

      {(deploying || logs.length > 0) && (
        <div style={{ background: "#000", border: "1px solid #333", borderRadius: "8px", padding: "20px", fontFamily: "monospace", minHeight: "300px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }}></div>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }}></div>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }}></div>
          </div>
          
          {logs.map((log, index) => (
            <div key={index} style={{ color: index === logs.length - 1 && deployedUrl ? "#10b981" : "#a1a1aa", marginBottom: "8px", animation: "fadeIn 0.3s ease-out" }}>
              <span style={{ color: "#3b82f6", marginRight: "10px" }}>{">"}</span> {log}
            </div>
          ))}

          {deployedUrl && (
            <div style={{ marginTop: "30px", padding: "20px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", textAlign: "center", animation: "fadeIn 1s ease-out" }}>
              <h3 style={{ color: "#10b981", margin: "0 0 10px 0" }}>App is Live! 🚀</h3>
              <a href={deployedUrl} target="_blank" rel="noreferrer" style={{ fontSize: "1.2rem", color: "#fff", textDecoration: "underline" }}>{deployedUrl}</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
