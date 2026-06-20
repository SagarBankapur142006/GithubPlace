export interface Listing {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  expert_analysis?: string;
  category: string;
  tech_stack: string[];
  complexity: string;
  revenue_model: string;
  growth_potential_score: number;
  price_cents: number;
  currency: string;
  status: string;
  github_stars?: number;
  github_forks?: number;
  license?: string | null;
  meta_title?: string;
  meta_description?: string;
  json_ld?: Record<string, unknown>;
  github_repo_url?: string | null;
  live_demo_url?: string | null;
  demo_video_url?: string | null;
  pitch_deck?: Record<string, unknown>;
}

export interface ListingsResponse {
  items: Listing[];
  total: number;
  query?: string | null;
  suggested_query?: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
}

// On the server (SSR) we need the full URL to hit the backend directly.
// On the browser we ALWAYS use a relative path so requests go through
// Next.js's rewrite proxy — this avoids CORS issues entirely.
const API_BASE =
  typeof window === "undefined"
    ? process.env.BACKEND_URL || "http://localhost:8000"
    : "";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (err: any) {
    console.error("Fetch exception details:", err);
    throw new Error(`Network error: Could not reach the backend API. Details: ${err.message || String(err)}`);
  }
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export function formatPrice(priceCents: number, currency = "USD"): string {
  if (currency === "INR") {
    return `₹${Math.round((priceCents / 100) * 83).toLocaleString("en-IN")}`;
  }
  return `$${(priceCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export async function fetchListings(params: Record<string, string> = {}): Promise<ListingsResponse> {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/api/listings?${qs}`);
}

export async function fetchListing(slug: string): Promise<Listing> {
  return apiFetch(`/api/listings/${slug}`);
}

export async function fetchAutocomplete(q: string) {
  return apiFetch<{ items: { title: string; category: string; slug: string }[] }>(
    `/api/listings/autocomplete?q=${encodeURIComponent(q)}`
  );
}

export async function fetchStats() {
  return apiFetch<{ active_listings: number; total_volume_cents: number }>("/api/listings/stats");
}

export async function signUp(email: string, password: string, fullName?: string) {
  return apiFetch<User>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
}

export async function signIn(email: string, password: string) {
  return apiFetch<User>("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signOut() {
  return apiFetch("/api/auth/signout", { method: "POST" });
}

export async function getMe(): Promise<User | null> {
  try {
    return await apiFetch<User>("/api/auth/me");
  } catch {
    return null;
  }
}

export async function createRazorpayOrder(listingId: string) {
  return apiFetch<{ order_id: string; amount: number; currency: string; transaction_id: string }>("/api/checkout/create-order", {
    method: "POST",
    body: JSON.stringify({ listing_id: listingId }),
  });
}

export async function verifyRazorpayPayment(orderId: string, paymentId: string, signature: string) {
  return apiFetch<{ ok: boolean }>("/api/checkout/verify", {
    method: "POST",
    body: JSON.stringify({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    }),
  });
}

export async function getTransaction(id: string) {
  return apiFetch<{
    id: string;
    status: string;
    fulfillment_status: string;
    escrow_status: string;
    amount_cents: number;
    listing: Listing | null;
    fulfillment_assets: { delivery_method: string; delivery_url_or_reference: string }[];
  }>(`/api/transactions/${id}`);
}

export async function sellerEvaluate(readmeText: string) {
  return apiFetch<{ pitch_deck: Record<string, any> }>("/api/seller/evaluate", {
    method: "POST",
    body: JSON.stringify({ readme_text: readmeText }),
  });
}

export async function sellerPublishListing(payload: {
  github_repo_url?: string;
  live_demo_url?: string;
  demo_video_url?: string;
  pitch_deck: Record<string, any>;
  price_cents: number;
  visibility?: string;
}) {
  return apiFetch<Listing>("/api/seller/listings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function markDelivered(transactionId: string) {
  return apiFetch<{ ok: boolean }>(`/api/transactions/${transactionId}/deliver`, {
    method: "POST",
  });
}

export async function confirmReceipt(transactionId: string) {
  return apiFetch<{ ok: boolean }>(`/api/transactions/${transactionId}/confirm-receipt`, {
    method: "POST",
  });
}

export async function getSales() {
  return apiFetch<any[]>("/api/dashboard/sales");
}

export async function getMyListings() {
  return apiFetch<any[]>("/api/dashboard/listings");
}

export async function updateListing(id: string, payload: {
  price_cents?: number;
  demo_video_url?: string;
  live_demo_url?: string;
  extra_description?: string;
}) {
  return apiFetch<any>(`/api/seller/listings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getPurchases() {
  return apiFetch<any[]>("/api/dashboard/purchases");
}

export async function getBounties() {
  return apiFetch<any[]>("/api/bounties");
}

export async function createBounty(payload: { github_issue_url: string; amount_cents: number }) {
  return apiFetch<{ ok: boolean; bounty_id: string }>("/api/bounties", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resolveBounty(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/bounties/${id}/resolve`, {
    method: "POST",
  });
}
