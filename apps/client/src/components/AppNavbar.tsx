"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";

export function AppNavbar() {
  const router = useRouter();

  async function handleSignOut() {
    await logout();
    router.push("/");
  }

  return (
    <header className="app-surface shrink-0 flex items-center justify-between border-b px-8 py-5">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Scribrrr</h1>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="text-sm font-medium text-muted transition-colors hover:text-text"
      >
        Sign Out
      </button>
    </header>
  );
}
