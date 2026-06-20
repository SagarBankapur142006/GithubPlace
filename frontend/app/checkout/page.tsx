"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { createRazorpayOrder, verifyRazorpayPayment, fetchListing, formatPrice, getMe, type Listing } from "@/lib/api";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("listing");
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const user = await getMe();
      if (!user) {
        router.replace("/signin?redirect=checkout");
        return;
      }

      let data: Listing | null = null;
      if (slug) {
        try {
          data = await fetchListing(slug);
        } catch {
          /* fall through */
        }
      }
      if (!data) {
        const stored = sessionStorage.getItem("selectedListing");
        if (stored) data = JSON.parse(stored);
      }
      setListing(data);
      setLoading(false);
    }
    init();
  }, [slug, router]);

  const handleCheckout = async () => {
    if (!listing) return;
    setPaying(true);
    setError("");
    try {
      // 1. Create Order on Backend
      const { order_id, amount, currency, transaction_id } = await createRazorpayOrder(listing.id);

      // If dev mode fallback triggers (no keys configured)
      if (order_id.startsWith("dev_")) {
        router.push(`/checkout/success?transaction_id=${transaction_id}&dev_confirm=1`);
        return;
      }

      // 2. Load Razorpay Script
      const res = await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      if (!res) {
        throw new Error("Razorpay SDK failed to load. Are you online?");
      }

      // 3. Initialize Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
        amount: amount,
        currency: currency,
        name: "Ideora Marketplace",
        description: `Acquiring: ${listing.title}`,
        order_id: order_id,
        handler: async function (response: any) {
          try {
            await verifyRazorpayPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            router.push(`/checkout/success?transaction_id=${transaction_id}`);
          } catch (err: any) {
            setError(err.message || "Payment verification failed");
            setPaying(false);
          }
        },
        prefill: {
          name: "Ideora Customer",
          email: "customer@example.com",
        },
        theme: {
          color: "#D4AF37", // Ideora Gold
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setError(response.error.description);
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="checkout-wrapper"><p>Loading...</p></div>;
  }

  if (!listing) {
    return (
      <div className="checkout-wrapper">
        <div className="checkout-details-pane scale-in">
          <h2>Asset Unavailable</h2>
          <p className="checkout-desc">The specific project you are trying to acquire has either been sold or removed from the marketplace.</p>
          <button className="btn-primary mt-2" onClick={() => router.push("/")}>Return to Discover</button>
        </div>
      </div>
    );
  }

  const techList = listing.tech_stack.join(", ");
  const price = formatPrice(listing.price_cents, listing.currency);

  return (
    <div className="checkout-wrapper">
      <div className="checkout-grid">
        <div className="checkout-details-pane scale-in">
          <div className="step-indicator">Acquisition Summary</div>
          <div className="checkout-project-title">{listing.title}</div>
          <p className="checkout-desc">{listing.short_description}</p>

          <div style={{ background: "var(--bg-cream)", padding: "2rem", borderRadius: "var(--radius-sm)", marginBottom: "2.5rem", borderLeft: "5px solid var(--accent-gold)" }}>
            <h4 style={{ color: "var(--accent-green)", marginBottom: "1rem", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: "1.5px", fontSize: "0.9rem" }}>
              Market Analysis & Potential
            </h4>
            <p style={{ fontSize: "1.05rem", color: "var(--text-dark)", lineHeight: 1.8, marginBottom: "1.5rem" }}>
              {listing.expert_analysis}
            </p>
            <div style={{ display: "inline-block", background: "rgba(212, 175, 55, 0.1)", color: "var(--accent-gold-hover)", padding: "0.5rem 1.2rem", borderRadius: "30px", fontWeight: 700, fontSize: "0.95rem", border: "1px solid rgba(212, 175, 55, 0.2)" }}>
              Validated Growth Potential: {listing.growth_potential_score}%
            </div>
          </div>

          <div className="checkout-summary-box">
            <div className="summary-row">
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Sector</span>
              <span style={{ fontWeight: 700, color: "var(--text-dark)" }}>{listing.category}</span>
            </div>
            <div className="summary-row">
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Architecture Stack</span>
              <span style={{ fontWeight: 700, color: "var(--text-dark)", textAlign: "right" }}>{techList}</span>
            </div>
            <div className="summary-row">
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Implementation</span>
              <span style={{ fontWeight: 700, color: "var(--text-dark)" }}>{listing.complexity}</span>
            </div>
            <div className="summary-row" style={{ marginTop: "2rem", borderTop: "2px solid var(--border-color)", paddingTop: "2rem" }}>
              <span style={{ fontFamily: "sans-serif" }}>Total Acquisition Cost</span>
              <span style={{ color: "var(--accent-green)" }}>{price}</span>
            </div>
          </div>
        </div>

        <div className="checkout-payment-pane scale-in" style={{ animationDelay: "0.1s" }}>
          <div className="step-indicator">Secure Payment</div>
          <h2>Payment Details</h2>
          <p className="subtitle">You will be securely redirected to Razorpay to complete your payment.</p>

          <div className="payment-summary-bar">
            <span style={{ fontFamily: "sans-serif", fontWeight: 600, fontSize: "1.1rem" }}>
              Securing Asset: <br />
              <small style={{ fontWeight: 400, fontSize: "1rem", color: "var(--text-muted)" }}>{listing.title}</small>
            </span>
            <span style={{ fontSize: "2rem", fontFamily: "'Playfair Display', serif", color: "var(--accent-green)" }}>{price}</span>
          </div>

          <div className="legal-notice">
            Upon purchase you receive a packaged codebase snapshot plus usage rights documentation from Ideora.
            This is not a verified legal IP transfer from the original author(s).
          </div>

          {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}

          <button className="btn-primary w-100 btn-large mt-2" onClick={handleCheckout} disabled={paying}>
            {paying ? "Initializing Secure Payment..." : "Proceed to Secure Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="checkout-page">
      <Navbar />
      <Suspense fallback={<div className="checkout-wrapper"><p>Loading...</p></div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
