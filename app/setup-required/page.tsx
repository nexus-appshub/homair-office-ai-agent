import Link from "next/link";
import { AlertTriangle, ArrowLeft, LockKeyhole } from "lucide-react";

export default function SetupRequiredPage() {
  return (
    <main className="login-page">
      <section className="login-card setup-required-card">
        <div className="login-lock warning-lock"><AlertTriangle size={22}/></div>
        <h1>Workspace setup required</h1>
        <p className="login-description">This deployment is not configured for production access. The private workspace remains locked until authentication and database migrations are ready.</p>
        <div className="setup-required-list">
          <p><LockKeyhole size={15}/> Configure Supabase URL and publishable key.</p>
          <p><LockKeyhole size={15}/> Apply database migrations and role policies.</p>
          <p><LockKeyhole size={15}/> Create and activate the first authorized owner profile.</p>
        </div>
        <Link className="button button-secondary login-submit" href="/login"><ArrowLeft size={15}/> Go to sign in</Link>
      </section>
    </main>
  );
}
