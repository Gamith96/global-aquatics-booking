"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Room = {
  id: string;
  room_code: string;
  room_type: string;
  capacity: string;
  price: number;
  status: "AVAILABLE" | "HELD" | "BOOKED";
};

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);

  // Slip Upload State
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [slipUploaded, setSlipUploaded] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    team_name: "",
    manager_name: "",
    manager_email: "",
    manager_phone: "",
  });

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("room_code", { ascending: true });

      if (error) throw error;
      if (data) setRooms(data as Room[]);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (room: Room) => {
    setSelectedRoom(room);
    setErrorMessage(null);
    setBookingSuccess(null);
    setSlipFile(null);
    setSlipUploaded(false);
    setFormData({
      team_name: "",
      manager_name: "",
      manager_email: "",
      manager_phone: "",
    });
  };

  const handleCloseModal = () => {
    setSelectedRoom(null);
    setErrorMessage(null);
    setBookingSuccess(null);
    setSlipFile(null);
    setSlipUploaded(false);
    fetchRooms();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;

    setSubmitting(true);
    setErrorMessage(null);
    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await fetch("/api/book-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: selectedRoom.id,
          room_code: selectedRoom.room_code,
          team_name: formData.team_name,
          manager_name: formData.manager_name,
          manager_email: formData.manager_email,
          manager_phone: formData.manager_phone,
          idempotency_key: idempotencyKey,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to reserve the room.");
      }

      setBookingSuccess(data.booking);
      fetchRooms();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Payment Slip Upload Logic
  const handleSlipUpload = async () => {
    if (!slipFile || !bookingSuccess) return;

    setUploadingSlip(true);
    try {
      const fileExt = slipFile.name.split(".").pop();
      const fileName = `${bookingSuccess.booking_ref}-${Date.now()}.${fileExt}`;
      const filePath = `slips/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("payment-slips")
        .upload(filePath, slipFile);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: urlData } = supabase.storage
        .from("payment-slips")
        .getPublicUrl(filePath);

      // 3. Update Bookings Table with URL
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ payment_proof_url: urlData.publicUrl })
        .eq("id", bookingSuccess.id);

      if (updateError) throw updateError;

      setSlipUploaded(true);
    } catch (err: any) {
      alert("Error uploading slip: " + err.message);
    } finally {
      setUploadingSlip(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-3 tracking-tight">
            Global Aquatics
          </h1>
          <h2 className="text-xl md:text-2xl font-semibold text-blue-600 mb-2">
            AOSI 2026 - Bangkok
          </h2>
          <p className="text-slate-500 text-lg">
            Team Holding Room Booking Portal (First-Come, First-Served)
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64 flex-col">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium text-lg">Loading Inventory...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={`border rounded-2xl p-6 transition-all duration-300 ${
                  room.status === "AVAILABLE"
                    ? "bg-white border-slate-200 hover:border-blue-300 hover:shadow-xl hover:-translate-y-1"
                    : room.status === "HELD"
                    ? "bg-amber-50 border-amber-200 opacity-90"
                    : "bg-slate-100 border-slate-200 opacity-60 grayscale-[50%]"
                }`}
              >
                <div className="flex justify-between items-start mb-5">
                  <h3 className="text-2xl font-bold text-slate-800">
                    {room.room_code}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                      room.status === "AVAILABLE"
                        ? "bg-green-100 text-green-700"
                        : room.status === "HELD"
                        ? "bg-amber-200 text-amber-800"
                        : "bg-slate-300 text-slate-700"
                    }`}
                  >
                    {room.status}
                  </span>
                </div>

                <div className="text-slate-600 text-sm mb-6 space-y-3">
                  <p className="flex justify-between border-b pb-2">
                    <span className="font-medium text-slate-500">Type</span>
                    <span className="font-semibold text-right">{room.room_type}</span>
                  </p>
                  <p className="flex justify-between border-b pb-2">
                    <span className="font-medium text-slate-500">Capacity</span>
                    <span className="font-semibold">{room.capacity}</span>
                  </p>
                  <p className="text-xl font-extrabold text-blue-700 mt-4 text-center">
                    THB {room.price.toLocaleString()}
                  </p>
                </div>

                <button
                  disabled={room.status !== "AVAILABLE"}
                  onClick={() => handleOpenModal(room)}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all ${
                    room.status === "AVAILABLE"
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {room.status === "AVAILABLE"
                    ? "BOOK NOW"
                    : room.status === "HELD"
                    ? "LOCKED (PAYMENT PENDING)"
                    : "SOLD OUT"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Booking Form Modal */}
        {selectedRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              {!bookingSuccess ? (
                <>
                  <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">
                        Reserve {selectedRoom.room_code}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Price: THB {selectedRoom.price.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={handleCloseModal}
                      className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {errorMessage && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                      ⚠️ {errorMessage}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Team / Club Name *
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Bangkok Aquatics Club"
                        value={formData.team_name}
                        onChange={(e) =>
                          setFormData({ ...formData, team_name: e.target.value })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Team Manager Name *
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. John Doe"
                        value={formData.manager_name}
                        onChange={(e) =>
                          setFormData({ ...formData, manager_name: e.target.value })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Manager Email *
                        </label>
                        <input
                          required
                          type="email"
                          placeholder="manager@team.com"
                          value={formData.manager_email}
                          onChange={(e) =>
                            setFormData({ ...formData, manager_email: e.target.value })
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Manager Phone *
                        </label>
                        <input
                          required
                          type="tel"
                          placeholder="+66 81 234 5678"
                          value={formData.manager_phone}
                          onChange={(e) =>
                            setFormData({ ...formData, manager_phone: e.target.value })
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="w-1/3 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 transition-all text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-2/3 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Locking Room...
                          </>
                        ) : (
                          "Confirm & Hold (10 Min)"
                        )}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="text-center py-2 space-y-4">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
                    ✓
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">
                    Room Locked Successfully!
                  </h3>
                  <p className="text-slate-600 text-sm">
                    {selectedRoom.room_code} is temporarily reserved for{" "}
                    <span className="font-bold text-slate-800">
                      {bookingSuccess.team_name}
                    </span>{" "}
                    for <span className="text-amber-600 font-bold">10 minutes</span>.
                  </p>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left">
                    <p className="text-xs text-slate-400 uppercase font-bold">
                      Booking Reference
                    </p>
                    <p className="text-lg font-mono font-bold text-blue-600">
                      {bookingSuccess.booking_ref}
                    </p>
                  </div>

                  {/* Bank Slip Upload Box */}
                  <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-5 text-left space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      📤 Upload Bank Transfer Slip
                    </h4>
                    <p className="text-xs text-slate-500">
                      Upload your payment confirmation image (PNG, JPG) or PDF to complete your verification.
                    </p>

                    {!slipUploaded ? (
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                          className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                        />
                        <button
                          disabled={!slipFile || uploadingSlip}
                          onClick={handleSlipUpload}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          {uploadingSlip ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Uploading Slip...
                            </>
                          ) : (
                            "Submit Payment Receipt"
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-100/70 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <span>✓</span> Payment proof uploaded! Pending committee review.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleCloseModal}
                    className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-sm transition-all"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}