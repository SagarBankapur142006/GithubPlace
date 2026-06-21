"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { BackgroundElements } from "@/components/BackgroundElements";
import { Navbar } from "@/components/Navbar";
import { signIn } from "@/lib/api";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signupHref = redirect ? `/signup?redirect=${redirect}` : "/signup";

  const handleGithubLogin = () => {
    const clientId = "Ov23li7kG7OPLsp2hJIg";
    const redirectUri = `${window.location.protocol}//${window.location.host}/auth/github/callback`;
    const scope = "user,repo";
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scope}`;
    router.push(url);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await signIn(form.get("email") as string, form.get("password") as string);
      if (redirect === "checkout") router.push("/checkout");
      else router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card scale-in">
      <div className="auth-header">
        <h2>Welcome Back</h2>
        <p>Sign in to proceed with your acquisition.</p>
      </div>

      <button
        type="button"
        onClick={handleGithubLogin}
        className="premium-btn w-100"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          background: "#24292e",
          color: "#fff",
          border: "none",
          marginBottom: "1.5rem",
        }}
      >
        <svg
          height="20"
          width="20"
          viewBox="0 0 16 16"
          fill="currentColor"
          style={{ verticalAlign: "middle" }}
        >
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        Continue with GitHub
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          margin: "1rem 0 1.5rem 0",
        }}
      >
        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }}></div>
        <span style={{ padding: "0 0.75rem" }}>or continue with email</span>
        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }}></div>
      </div>

      <form className="auth-form" id="signinForm" onSubmit={handleSubmit}>
        {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}
        <div className="input-group">
          <label>Email Address</label>
          <input type="email" name="email" placeholder="name@company.com" required />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" name="password" placeholder="••••••••" required />
        </div>
        <button type="submit" className="btn-primary w-100 mt-2" disabled={loading}>
          {loading ? "Signing in..." : "Sign In & Continue"}
        </button>
      </form>
      <div className="auth-footer">
        <p>
          New to Ideora? <Link href={signupHref}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="auth-page">
      <BackgroundElements variant="signin" />
      <Navbar authOnly />
      <div className="auth-wrapper">
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
