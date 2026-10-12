import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json(
      { error: "Could not end the current session. Please try again." },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
