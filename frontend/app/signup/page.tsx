"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { BackgroundElements } from "@/components/BackgroundElements";
import { Navbar } from "@/components/Navbar";
import { signUp } from "@/lib/api";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signinHref = redirect ? `/signin?redirect=${redirect}` : "/signin";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await signUp(
        form.get("email") as string,
        form.get("password") as string,
        form.get("full_name") as string
      );
      if (redirect === "checkout") router.push("/checkout");
      else router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card scale-in">
      <div className="auth-header">
        <h2>Create Account</h2>
        <p>Join the premier marketplace to secure your next venture.</p>
      </div>
      <form className="auth-form" id="signupForm" onSubmit={handleSubmit}>
        {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}
        <div className="input-group">
          <label>Full Name</label>
          <input type="text" name="full_name" placeholder="John Doe" required />
        </div>
        <div className="input-group">
          <label>Email Address</label>
          <input type="email" name="email" placeholder="name@company.com" required />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" name="password" placeholder="Create a strong password" required minLength={8} />
        </div>
        <button type="submit" className="btn-primary w-100 mt-2" disabled={loading}>
          {loading ? "Creating..." : "Create Account & Continue"}
        </button>
      </form>
      <div className="auth-footer">
        <p>
          Already a member? <Link href={signinHref}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="auth-page">
      <BackgroundElements variant="signup" />
      <Navbar authOnly />
      <div className="auth-wrapper">
        <Suspense>
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  );
}
