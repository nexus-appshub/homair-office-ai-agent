"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isConfigured) {
      setError("Authentication is not configured. Add the Supabase project URL and publishable key to your environment.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError("Sign-in failed. Check your credentials or ask the workspace owner to verify your account.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to sign in right now. Check the authentication configuration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><div className="brand-mark"><span className="brand-play"/></div><div className="brand-copy"><strong>Home Air</strong><span>AI OFFICE</span></div></div>
        <div className="login-lock"><LockKeyhole size={22}/></div>
        <h1>Welcome back</h1>
        <p className="login-description">Sign in to the private Home Air operations workspace.</p>
        {!isConfigured && <div className="login-warning">Setup required: Supabase authentication is not connected yet.</div>}
        <form onSubmit={submit} className="login-form">
          <label>Email address<input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="button button-primary login-submit" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in securely"} <ArrowRight size={16}/></button>
        </form>
        <p className="login-foot">Access is limited to invited accounts. Public admin registration is disabled.</p>
      </section>
    </main>
  );
}
