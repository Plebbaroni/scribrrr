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
    <main className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-gray-500">Creating session…</p>
      </div>
    </main>
  );
}
