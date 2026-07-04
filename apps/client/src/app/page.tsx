import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <h1 className="text-5xl font-bold tracking-tight text-gray-900">
        Scribrrr
      </h1>
      <p className="mt-4 text-lg text-gray-500">
        Real-time AI transcription for meetings
      </p>
      <Link
        href="/session/new"
        className="mt-8 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
      >
        New Session
      </Link>
    </main>
  );
}
