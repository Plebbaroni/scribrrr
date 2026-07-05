"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRooms, createRoom } from "@/lib/api";
import { AppNavbar } from "@/components/AppNavbar";

type Room = { id: string; name: string; created_at: string };

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

export default function RoomsPage() {
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

  return (
    <main className="flex h-screen flex-col bg-bg text-text">
      <AppNavbar />

      <div className="flex-1 overflow-y-auto px-8 py-8 md:px-10">
        <h1 className="text-xl font-semibold text-text">Rooms</h1>

        <div className="mt-6 flex w-full items-end justify-between gap-12">
          <label className="flex min-w-0 flex-1 items-center gap-2 border-b border-border pb-1.5">
            <span className="shrink-0 text-muted">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-text placeholder:text-muted focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={openModal}
            className="shrink-0 pb-1.5 text-sm font-medium text-text transition-colors hover:text-muted"
          >
            + New Room
          </button>
        </div>

        <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-text" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted">
              {search ? "No rooms match your search" : "No rooms yet"}
            </p>
            {!search && (
              <button
                onClick={openModal}
                className="mt-4 text-sm font-medium text-text transition-colors hover:text-muted"
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
                className="app-card flex min-h-[140px] items-center justify-center rounded-2xl px-6 py-10 text-center transition-shadow hover:shadow-md"
              >
                <span className="text-lg font-medium text-text">{room.name}</span>
              </Link>
            ))}
          </div>
        )}
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
          onClick={closeModal}
        >
          <div
            className="app-card w-full max-w-md rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[#0A0A0A]">New Room</h2>
            <p className="mt-1 text-sm text-[#737373]">Give your room a name</p>

            <form onSubmit={handleCreate} className="mt-4">
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room name"
                autoFocus
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#737373] focus:border-[#0A0A0A] focus:outline-none"
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={creating}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[#737373] transition-colors hover:text-[#0A0A0A] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-bg disabled:opacity-50"
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
