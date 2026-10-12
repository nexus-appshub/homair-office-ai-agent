import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Minimal public liveness endpoint. Never return configuration values, secrets,
// internal hostnames, database details, or stack traces from a public health route.
export function GET() {
  return NextResponse.json(
    { service: "home-air-ai-office", status: "alive", timestamp: new Date().toISOString() },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
