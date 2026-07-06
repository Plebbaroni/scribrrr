"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setSessionToken } from "@/lib/session";

function AuthCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Missing session token. Try signing in again.");
      return;
    }

    setSessionToken(token);
    router.replace("/");
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-text" />
    </main>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-bg">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-text" />
        </main>
      }
    >
      <AuthCompleteInner />
    </Suspense>
  );
}
