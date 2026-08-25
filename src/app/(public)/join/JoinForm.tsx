"use client";

import { useState } from "react";
import styles from "./join.module.css";

// Feature 019 US3 (FR-010/FR-016): capture the member's name + email, then hand off to the club's existing
// PayPal HOSTED button. The button is fully PayPal-hosted and gives the site NO callback, so this must NOT
// claim the membership is active — it activates once PayPal's server-side notification confirms and matches.
// Feature 055 (P7-R12): extracted unchanged from the /join page so that page can be a server component.
const PAYPAL_BUTTON_ID = "Z5FUDMVGE6CVQ";

export default function JoinForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [captured, setCaptured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/public/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (res.status === 429) return setError("Too many requests — please try again in a minute.");
    if (!res.ok)
      return setError("Could not save your details. Please check your email and try again.");
    setCaptured(true);
  }

  if (!captured) {
    return (
      <>
        <p>Enter your details, then pay your dues with PayPal to complete your membership.</p>
        <form onSubmit={submit} className={styles.form}>
          <label>
            Name
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Email (use the same address as your PayPal account)
            <br />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button type="submit">Continue to payment</button>
          {error && <p role="alert">{error}</p>}
        </form>
      </>
    );
  }

  return (
    <>
      <p>
        Thanks, {name}. Please complete your dues payment with PayPal below. Your membership will be
        activated once your payment is confirmed — you don&rsquo;t need to do anything else here.
      </p>
      {/* PayPal-hosted no-code button; opens on PayPal, which notifies us server-side (no callback). */}
      <form
        action={`https://www.paypal.com/ncp/payment/${PAYPAL_BUTTON_ID}`}
        method="post"
        target="_blank"
        rel="noopener noreferrer"
      >
        <button type="submit">Pay dues with PayPal</button>
      </form>
    </>
  );
}
