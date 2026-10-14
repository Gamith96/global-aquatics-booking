"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Booking = {
  id: string;
  booking_ref: string;
  team_name: string;
  manager_name: string;
  manager_email: string;
  manager_phone: string;
  payment_proof_url: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  created_at: string;
  rooms: {
    id: string;
    room_code: string;
    price: number;
    status: string;
  };
};

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_ref,
          team_name,
          manager_name,
          manager_email,
          manager_phone,
          payment_proof_url,
          status,
          created_at,
          rooms (
            id,
            room_code,
            price,
            status
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setBookings(data as any[]);
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (bookingId: string, roomId: string) => {
    setActionLoading(bookingId);
    try {
      await supabase
        .from("bookings")
        .update({ status: "CONFIRMED" })
        .eq("id", bookingId);

      await supabase
        .from("rooms")
        .update({ status: "BOOKED", held_until: null })
        .eq("id", roomId);

      fetchBookings();
    } catch (err) {
      alert("Error confirming booking");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (bookingId: string, roomId: string) => {
    if (!confirm("Are you sure you want to release this room back to inventory?")) return;
    setActionLoading(bookingId);
    try {
      await supabase
        .from("bookings")
        .update({ status: "CANCELLED" })
        .eq("id", bookingId);

      await supabase
        .from("rooms")
        .update({ status: "AVAILABLE", held_until: null })
        .eq("id", roomId);

      fetchBookings();
    } catch (err) {
      alert("Error releasing room");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Global Aquatics - Committee Admin
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              AOSI 2024 Team Holding Rooms Live Allocation Manager
            </p>
          </div>
          <button
            onClick={fetchBookings}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-700"
          >
            ↻ Refresh Data
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 font-medium">Loading requests...</div>
        ) : bookings.length === 0 ? (
          <div className="py-20 text-center text-slate-500">No booking requests found yet.</div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-4">Reference</th>
                    <th className="p-4">Room</th>
                    <th className="p-4">Team & Manager</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Payment Proof</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-mono font-bold text-blue-400">
                        {b.booking_ref}
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-white">{b.rooms?.room_code}</span>
                        <div className="text-xs text-slate-400">THB {b.rooms?.price.toLocaleString()}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white">{b.team_name}</div>
                        <div className="text-xs text-slate-400">{b.manager_name}</div>
                      </td>
                      <td className="p-4 text-xs space-y-1">
                        <div>{b.manager_email}</div>
                        <div className="text-slate-400">{b.manager_phone}</div>
                      </td>
                      <td className="p-4">
                        {b.payment_proof_url ? (
                          <a
                            href={b.payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-xs font-bold transition-all"
                          >
                            <span>📎</span> View Receipt
                          </a>
                        ) : (
                          <span className="text-slate-500 text-xs italic">Not Uploaded</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                            b.status === "CONFIRMED"
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : b.status === "PENDING"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {b.status === "PENDING" ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              disabled={actionLoading === b.id}
                              onClick={() => handleConfirm(b.id, b.rooms.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              disabled={actionLoading === b.id}
                              onClick={() => handleCancel(b.id, b.rooms.id)}
                              className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            >
                              Release
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-xs text-slate-500 font-medium italic">
                            Completed
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}