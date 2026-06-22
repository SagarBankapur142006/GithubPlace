"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMe, signOut, type User } from "@/lib/api";

export function Navbar({ authOnly = false }: { authOnly?: boolean }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getMe().then(setUser).catch(() => {/* not logged in */});
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <nav className={`navbar ${authOnly ? "auth-nav" : ""}`}>
      <Link href="/" className="logo">
        Ideora.
      </Link>
      <div className="nav-links">
        <Link href="/" className="nav-link">Discover</Link>
        {user && (
          <>
            {user.github_username && <Link href="/sell" className="nav-link">List Codebase</Link>}
            <Link href="/bounties" className="nav-link">Bounties</Link>
            {user.github_username && <Link href="/deploy" className="nav-link">SaaSify</Link>}
            <Link href="/dashboard" className="nav-link" style={{ color: "var(--accent-green)" }}>Dashboard</Link>
          </>
        )}
      </div>
      <div className="nav-actions" id="navAuthContainer">
        {user ? (
          <>
            <span className="user-greeting">
              Welcome back{user.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
            </span>
            <button className="btn-ghost" onClick={handleSignOut} style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem" }}>
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href="/signin" className="btn-primary" style={{ padding: "0.8rem 1.8rem", fontSize: "0.95rem" }}>
              Sign In
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
