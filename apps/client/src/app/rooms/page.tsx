"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRooms, createRoom, logout } from "@/lib/api";

type Room = { id: string; name: string; created_at: string };

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [roomName, setRoomName] = useState("");

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    getRooms()
      .then(setRooms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openModal() {
    setRoomName("Untitled Room");
    setModalOpen(true);
  }

  function closeModal() {
    if (creating) return;
    setModalOpen(false);
    setRoomName("");
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    const name = roomName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const room = await createRoom(name);
      setRooms((prev) => [room, ...prev]);
      setModalOpen(false);
      setRoomName("");
    } catch (err) {
      console.error(err);
    }
    setCreating(false);
  }

  async function handleSignOut() {
    await logout();
    router.push("/");
  }

  return (
    <main className="flex h-screen flex-col bg-white">
      <header className="shrink-0 flex items-center justify-between border-b border-gray-200 px-8 py-5">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Scribrrr</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={openModal}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
          >
            + New Room
          </button>
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 md:p-10">
        <div className="mb-6 flex items-center gap-4">
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-gray-500">
              {search ? "No rooms match your search" : "No rooms yet"}
            </p>
            {!search && (
              <button
                onClick={openModal}
                className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Create your first room
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="flex min-h-[140px] items-center justify-center rounded-2xl border border-gray-300 bg-white px-6 py-10 text-center shadow-sm transition-colors hover:bg-gray-50"
              >
                <span className="text-lg font-medium text-gray-900">{room.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900">New Room</h2>
            <p className="mt-1 text-sm text-gray-500">Give your room a name</p>

            <form onSubmit={handleCreate} className="mt-4">
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room name"
                autoFocus
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={creating}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
