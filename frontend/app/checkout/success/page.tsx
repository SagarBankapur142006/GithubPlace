"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BackgroundElements } from "@/components/BackgroundElements";
import { Navbar } from "@/components/Navbar";
import { formatPrice, getTransaction } from "@/lib/api";

function SuccessContent() {
  const searchParams = useSearchParams();
  const transactionId = searchParams.get("transaction_id");
  const [status, setStatus] = useState<string>("pending");
  const [fulfillment, setFulfillment] = useState<string>("pending");
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (!transactionId) return;

    const devConfirm = searchParams.get("dev_confirm");
    if (devConfirm) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/checkout/dev-confirm/${transactionId}`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }

    let attempts = 0;
    const poll = async () => {
      try {
        const tx = await getTransaction(transactionId);
        setStatus(tx.status);
        setFulfillment(tx.fulfillment_status);
        setAmount(tx.amount_cents);
        if (tx.fulfillment_status !== "pending" || attempts > 20) return;
      } catch {
        /* retry */
      }
      attempts++;
      setTimeout(poll, 2000);
    };
    poll();
  }, [transactionId]);

  const downloadUrl = transactionId
    ? `${process.env.NEXT_PUBLIC_API_URL || ""}/api/transactions/${transactionId}/download`
    : "#";

  return (
    <div className="success-page scale-in">
      <h2>Acquisition Successful</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem", fontSize: "1.1rem" }}>
        {status === "succeeded"
          ? "Your payment has been successfully secured in escrow!"
          : "Securing your payment in escrow..."}
      </p>
      {amount > 0 && (
        <p style={{ fontSize: "2rem", fontFamily: "'Playfair Display', serif", color: "var(--accent-green)", marginBottom: "1.5rem" }}>
          {formatPrice(amount)}
        </p>
      )}
      <div style={{ background: "rgba(212, 175, 55, 0.05)", padding: "1.5rem 2rem", borderRadius: "10px", border: "1px solid rgba(212, 175, 55, 0.2)", marginBottom: "2.5rem", textAlign: "left" }}>
        <h4 style={{ color: "var(--accent-gold)", fontWeight: "700", marginBottom: "0.5rem", textTransform: "uppercase", fontSize: "0.85rem", letterSpacing: "1px" }}>Escrow Hold Active</h4>
        <p style={{ color: "var(--text-dark)", fontSize: "0.95rem", lineHeight: "1.6", margin: 0 }}>
          The seller has been notified to deliver repository access. You can monitor the transfer progress, access the repository, and release the funds from your dashboard.
        </p>
      </div>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "2rem" }}>
        <Link href="/dashboard" className="btn-primary btn-large" style={{ textDecoration: "none", display: "inline-block" }}>
          Go to Command Center
        </Link>
        <Link href="/" className="btn-ghost" style={{ padding: "0.9rem 2rem" }}>
          Return to Discover
        </Link>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "500px", margin: "0 auto" }}>
        Transactions on Ideora are protected by our escrow framework. Funds are only released to the seller after you confirm receipt of the repository.
      </p>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <>
      <BackgroundElements />
      <Navbar />
      <Suspense>
        <SuccessContent />
      </Suspense>
    </>
  );
}
