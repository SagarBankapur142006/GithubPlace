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
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        {fulfillment === "delivered"
          ? "Your packaged codebase is ready for download."
          : fulfillment === "failed"
            ? "Fulfillment encountered an issue. Contact support@ideora.com."
            : "Preparing your codebase package..."}
      </p>
      {amount > 0 && (
        <p style={{ fontSize: "1.5rem", fontFamily: "'Playfair Display', serif", color: "var(--accent-green)", marginBottom: "2rem" }}>
          {formatPrice(amount)}
        </p>
      )}
      {fulfillment === "delivered" && transactionId && (
        <a href={downloadUrl} className="btn-primary btn-large" style={{ display: "inline-block", marginBottom: "1.5rem" }}>
          Download Codebase Package
        </a>
      )}
      <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "2rem" }}>
        Package includes source code archive and usage rights notice. Verify license terms before commercial deployment.
      </p>
      <Link href="/" className="btn-ghost">
        Return to Discover
      </Link>
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
