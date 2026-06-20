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
