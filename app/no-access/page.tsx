import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function NoAccessPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-lock warning-lock"><ShieldAlert size={22}/></div>
        <h1>Access not enabled</h1>
        <p className="login-description">Your account does not have an active Home Air Office profile. Ask the workspace owner to provision the correct role.</p>
        <Link className="button button-secondary login-submit" href="/login">Return to sign in</Link>
      </section>
    </main>
  );
}
