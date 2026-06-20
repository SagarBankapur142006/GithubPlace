import Link from "next/link";
import { BackgroundElements } from "@/components/BackgroundElements";
import { Navbar } from "@/components/Navbar";

export default function NotFound() {
  return (
    <>
      <BackgroundElements />
      <Navbar />
      <div className="success-page scale-in" style={{ marginTop: "6rem" }}>
        <h2>Listing Not Found</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
          This acquisition may have been sold or removed from the marketplace.
        </p>
        <Link href="/" className="btn-primary btn-large">
          Return to Discover
        </Link>
      </div>
    </>
  );
}
