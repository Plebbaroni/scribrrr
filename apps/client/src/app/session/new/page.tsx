"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/api";

export default function NewSessionPage() {
  const router = useRouter();

  useEffect(() => {
    createSession().then((session) => {
      router.replace(`/session/${session.id}`);
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-[#0A0A0A]" />
        <p className="text-sm text-[#737373]">Creating session…</p>
      </div>
    </main>
  );
}
