"use client";

import { use, useEffect, useState } from "react";
import { getDeployment } from "../../../../lib/api";
import Link from "next/link";

interface Stat {
  label: string;
  value: string;
  change: string;
}

interface ChartData {
  title: string;
  type: string;
  labels: string[];
  data: number[];
}

interface Activity {
  timestamp: string;
  description: string;
}

interface DemoWidget {
  title: string;
  inputs: { label: string; placeholder: string; type: string }[];
  button_text: string;
  simulated_output_format: string;
  simulated_success_output: string;
}

interface Schema {
  dashboard_title: string;
  navigation_links: string[];
  stats: Stat[];
  charts: ChartData[];
  recent_activity: Activity[];
  interactive_demo_widget: DemoWidget;
}

export default function LivePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [deployment, setDeployment] = useState<any>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tab state inside the mock dashboard
  const [activeTab, setActiveTab] = useState("");

  // Demo Console state
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);
  const [runningConsole, setRunningConsole] = useState(false);

  useEffect(() => {
    const fetchDep = async () => {
      try {
        const dep = await getDeployment(id);
        setDeployment(dep);
        if (dep.preview_schema) {
          setSchema(dep.preview_schema);
          if (dep.preview_schema.navigation_links?.length > 0) {
            setActiveTab(dep.preview_schema.navigation_links[0]);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load live preview dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchDep();
  }, [id]);

  const handleRunDemo = (e: React.FormEvent) => {
    e.preventDefault();
    setRunningConsole(true);
    setConsoleOutput(null);
    setTimeout(() => {
      setRunningConsole(false);
      if (schema?.interactive_demo_widget?.simulated_success_output) {
        const rawOut = schema.interactive_demo_widget.simulated_success_output;
        try {
          // If it is JSON, format it nicely
          const parsed = typeof rawOut === "string" ? JSON.parse(rawOut) : rawOut;
          setConsoleOutput(JSON.stringify(parsed, null, 2));
        } catch {
          setConsoleOutput(String(rawOut));
        }
      } else {
        setConsoleOutput('{"status": "success"}');
      }
    }, 900);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0c", color: "#fff", justifyContent: "center", alignItems: "center", fontFamily: "sans-serif" }}>
        <div style={{ border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #10b981", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite" }}></div>
        <p style={{ marginTop: "1rem", color: "#888", letterSpacing: "1px" }}>INITIALIZING SAASIFY INSTANCE...</p>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0c", color: "#fff", justifyContent: "center", alignItems: "center", fontFamily: "sans-serif", padding: "20px", textAlign: "center" }}>
        <h2 style={{ color: "#ef4444" }}>Deployment Offline</h2>
        <p style={{ color: "#888", maxWidth: "450px" }}>{error || "Could not retrieve the SaaSify preview configuration schema."}</p>
        <Link href="/deploy" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "0.8rem 1.5rem", borderRadius: "6px", textDecoration: "none", marginTop: "1rem" }}>
          Return to Deploy Setup
        </Link>
      </div>
    );
  }

  // Calculate highest data point in charts to scale CSS bars
  const chart = schema.charts?.[0];
  const maxVal = chart ? Math.max(...chart.data, 10) : 100;

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#f4f4f5", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      
      {/* Top Banner showing this is a live deployment preview */}
      <div style={{ background: "linear-gradient(90deg, #1e1b4b, #311042)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0.8rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ background: "#10b981", width: "8px", height: "8px", borderRadius: "50%", display: "inline-block" }}></span>
          <span style={{ fontSize: "0.85rem", fontWeight: "600", letterSpacing: "0.5px" }}>
            LIVE PREVIEW: <span style={{ color: "var(--accent-gold)" }}>{deployment.subdomain}.ideora.app</span> ({deployment.pricing_tier} Tier)
          </span>
        </div>
        <div style={{ display: "flex", gap: "15px" }}>
          <Link href="/dashboard" style={{ fontSize: "0.8rem", color: "#a1a1aa", textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: "4px", background: "rgba(255,255,255,0.03)" }}>
            Go to Command Center
          </Link>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 45px)" }}>
        
        {/* Mock Sidebar */}
        <aside style={{ width: "240px", borderRight: "1px solid rgba(255,255,255,0.06)", background: "#0d0d11", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "#fff", width: "24px", height: "24px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "800" }}>🚀</span>
            {schema.dashboard_title?.split("-")[0]?.trim() || "Console"}
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {schema.navigation_links?.map(link => (
              <button
                key={link}
                onClick={() => setActiveTab(link)}
                style={{
                  textAlign: "left", padding: "0.6rem 0.9rem", border: "none", borderRadius: "6px",
                  background: activeTab === link ? "rgba(255,255,255,0.06)" : "transparent",
                  color: activeTab === link ? "#fff" : "#9a9a87", fontWeight: activeTab === link ? "600" : "400",
                  cursor: "pointer", transition: "all 0.15s", fontSize: "0.9rem"
                }}
              >
                {link}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mock Main Content Area */}
        <main style={{ flex: 1, padding: "2.5rem 3rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.8rem", fontWeight: "700", margin: "0 0 4px 0" }}>{activeTab} Overview</h2>
              <p style={{ color: "#71717a", fontSize: "0.9rem", margin: 0 }}>Real-time service indicators and API analytics node.</p>
            </div>
            <div style={{ color: "#71717a", fontSize: "0.85rem" }}>
              Last synchronized: Just now
            </div>
          </div>

          {/* Stats Cards */}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {schema.stats?.map(stat => (
              <div key={stat.label} style={{ flex: "1 1 220px", background: "#18181b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "1.5rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</div>
                <div style={{ fontSize: "2rem", fontWeight: "700", margin: "0.5rem 0 0.2rem 0", color: "#fff" }}>{stat.value}</div>
                <div style={{ fontSize: "0.78rem", color: stat.change.includes("-") ? "#f87171" : "#34d399" }}>{stat.change}</div>
              </div>
            ))}
          </div>

          {/* Middle Row (Chart + Activity) */}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            
            {/* Chart Widget */}
            {chart && (
              <div style={{ flex: "2 1 450px", minWidth: "320px", background: "#18181b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "1.5rem" }}>
                <h4 style={{ margin: "0 0 1.5rem 0", fontSize: "1rem", color: "#fff" }}>{chart.title}</h4>
                <div style={{ display: "flex", height: "180px", alignItems: "flex-end", gap: "15px", padding: "0 10px" }}>
                  {chart.data.map((val, idx) => (
                    <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", height: "100%", justifyContent: "flex-end" }}>
                      <div 
                        style={{ 
                          width: "100%", 
                          height: `${(val / maxVal) * 80}%`, 
                          background: "linear-gradient(to top, #3b82f6, #60a5fa)",
                          borderRadius: "4px 4px 0 0",
                          minHeight: "4px"
                        }}
                      />
                      <span style={{ fontSize: "0.75rem", color: "#71717a" }}>{chart.labels[idx]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity Timeline */}
            <div style={{ flex: "1 1 280px", background: "#18181b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "1.5rem" }}>
              <h4 style={{ margin: "0 0 1.5rem 0", fontSize: "1rem", color: "#fff" }}>Recent Logs</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                {schema.recent_activity?.map((act, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "12px", fontSize: "0.85rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#60a5fa", marginTop: "4px" }} />
                      {idx !== schema.recent_activity.length - 1 && (
                        <div style={{ width: "1px", flex: 1, background: "rgba(255,255,255,0.1)", marginTop: "4px" }} />
                      )}
                    </div>
                    <div>
                      <div style={{ color: "#fff", marginBottom: "2px" }}>{act.description}</div>
                      <div style={{ color: "#71717a", fontSize: "0.78rem" }}>{act.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Interactive Demo Console Widget */}
          {schema.interactive_demo_widget && (
            <div style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "2rem" }}>
              <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.2rem", color: "#fff" }}>💻 {schema.interactive_demo_widget.title}</h3>
              <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginBottom: "1.5rem" }}>Test live triggers on the active virtual sandbox node environment.</p>

              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                
                {/* Form Inputs */}
                <form onSubmit={handleRunDemo} style={{ flex: 1, minWidth: "280px", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  {schema.interactive_demo_widget.inputs?.map(input => (
                    <div key={input.label}>
                      <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.8rem", color: "#a1a1aa", fontWeight: "600" }}>{input.label}</label>
                      {input.type === "textarea" ? (
                        <textarea
                          required
                          placeholder={input.placeholder}
                          value={formInputs[input.label] || ""}
                          onChange={e => setFormInputs(prev => ({ ...prev, [input.label]: e.target.value }))}
                          rows={3}
                          style={{ width: "100%", padding: "0.8rem", background: "#09090b", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: "6px", fontSize: "0.9rem", resize: "none" }}
                        />
                      ) : (
                        <input
                          type={input.type}
                          required
                          placeholder={input.placeholder}
                          value={formInputs[input.label] || ""}
                          onChange={e => setFormInputs(prev => ({ ...prev, [input.label]: e.target.value }))}
                          style={{ width: "100%", padding: "0.8rem", background: "#09090b", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: "6px", fontSize: "0.9rem" }}
                        />
                      )}
                    </div>
                  ))}
                  <button type="submit" disabled={runningConsole} className="btn-primary" style={{ padding: "0.9rem", fontWeight: "700" }}>
                    {runningConsole ? "Executing API Handlers..." : schema.interactive_demo_widget.button_text || "Execute"}
                  </button>
                </form>

                {/* Console Output Screen */}
                <div style={{ flex: 1.2, minWidth: "300px", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: "0.8rem", color: "#a1a1aa", fontWeight: "600", marginBottom: "0.4rem" }}>Simulated Response Console</div>
                  <div style={{ flex: 1, background: "#000", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "1.2rem", fontFamily: "monospace", minHeight: "220px", position: "relative" }}>
                    {runningConsole && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent-gold)", fontSize: "0.9rem" }}>
                        <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-gold)", animation: "blink 1s infinite" }}></span>
                        POSTING CLIENT REQUEST DATA...
                      </div>
                    )}
                    {!runningConsole && consoleOutput && (
                      <pre style={{ margin: 0, color: "#34d399", fontSize: "0.85rem", overflowX: "auto", whiteSpace: "pre-wrap" }}>{consoleOutput}</pre>
                    )}
                    {!runningConsole && !consoleOutput && (
                      <span style={{ color: "#71717a", fontSize: "0.85rem" }}>Console idle. Submit the form to check response logs.</span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blink { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
      `}} />
    </div>
  );
}
