"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGithub } from "@/lib/api";
import { BackgroundElements } from "@/components/BackgroundElements";
import { Navbar } from "@/components/Navbar";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code returned from GitHub.");
      return;
    }

    const redirectUri = `${window.location.protocol}//${window.location.host}/auth/github/callback`;

    signInWithGithub(code, redirectUri)
      .then(() => {
        router.push("/dashboard");
      })
      .catch((err) => {
        console.error("GitHub Login Error:", err);
        setError(err instanceof Error ? err.message : "GitHub authentication failed.");
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="auth-card scale-in" style={{ textAlign: "center", padding: "3rem 2rem" }}>
        <h2 style={{ color: "crimson", marginBottom: "1rem" }}>Authentication Failed</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>{error}</p>
        <button onClick={() => router.push("/signin")} className="btn-primary w-100">
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card scale-in" style={{ textAlign: "center", padding: "3rem 2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <div className="spinner" style={{
          width: "50px",
          height: "50px",
          border: "4px solid rgba(212, 175, 55, 0.1)",
          borderTop: "4px solid var(--accent-gold)",
          borderRadius: "50%",
          margin: "0 auto",
          animation: "spin 1s linear infinite"
        }}></div>
      </div>
      <h2>Authenticating with GitHub</h2>
      <p style={{ color: "var(--text-muted)" }}>Setting up your session. Please wait...</p>
      
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function GitHubCallbackPage() {
  return (
    <div className="auth-page">
      <BackgroundElements variant="signin" />
      <Navbar authOnly />
      <div className="auth-wrapper">
        <Suspense fallback={
          <div className="auth-card" style={{ textAlign: "center", padding: "3rem" }}>
            <p>Loading callback handler...</p>
          </div>
        }>
          <CallbackHandler />
        </Suspense>
      </div>
    </div>
  );
}
