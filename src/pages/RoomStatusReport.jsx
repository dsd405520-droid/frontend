import React, { useEffect, useState } from 'react';
import { DoorClosed, LogIn, LogOut, Users, Clock, AlertTriangle, Plus, X } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

// ໜ້າລາຍງານສະຖານະຫ້ອງປະຊຸມ "ຕົວຈິງ" — ບໍ່ແມ່ນແຄ່ອີງ booking (ຄາດເດົາ) ແຕ່ໃຫ້ຄົນທີ່ຢູ່ໃນຫ້ອງແທ້ໆ
// ຢືນຢັນເອງ (check-in / check-out), ບັນທຶກລາຍຊື່ຄົນເຂົ້າຮ່ວມ, ແລະ ຕໍ່ເວລາໄດ້ຖ້າໃກ້ໝົດ (ຜ່ານ endpoint reschedule ທີ່ມີແລ້ວ)
export default function RoomStatusReport() {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState('');

  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState('');

  const [busyId, setBusyId] = useState(null); // booking ທີ່ກຳລັງເຮັດ action ຢູ່ (check-in/out/attendees/extend)
  const [attendeeDrafts, setAttendeeDrafts] = useState({}); // { [bookingId]: 'ຊື່ 1, ຊື່ 2' }
  const [extendModalBooking, setExtendModalBooking] = useState(null);
  const [extendNewEndAt, setExtendNewEndAt] = useState('');
  const [extendError, setExtendError] = useState('');
  const [extendSubmitting, setExtendSubmitting] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchMyBookings();
  }, []);

  function unwrap(body) {
    return body?.data !== undefined ? body.data : body;
  }

  function fetchRooms() {
    setLoadingRooms(true);
    setRoomsError('');
    fetch('http://localhost:3000/api/rooms', { headers })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຫ້ອງໄດ້');
        setRooms(unwrap(body) || []);
      })
      .catch((err) => setRoomsError(err.message))
      .finally(() => setLoadingRooms(false));
  }

  function fetchMyBookings() {
    setLoadingBookings(true);
    setBookingsError('');
    fetch('http://localhost:3000/api/room-bookings/my', { headers })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດໂຫຼດການຈອງຂອງທ່ານໄດ້');
        setMyBookings(unwrap(body) || []);
      })
      .catch((err) => setBookingsError(err.message))
      .finally(() => setLoadingBookings(false));
  }

  const roomStatusInfo = (liveStatus) => {
    switch (liveStatus) {
      case 'BOOKED': return { label: 'ກຳລັງໃຊ້ງານ', className: 'bg-amber-100 text-amber-700' };
      case 'MAINTENANCE': return { label: 'ປິດບຳລຸງ', className: 'bg-red-100 text-red-700' };
      default: return { label: 'ວ່າງ', className: 'bg-green-100 text-green-700' };
    }
  };

  const now = new Date();
  // ການຈອງມື້ນີ້ຂອງຂ້ອຍ ທີ່ຍັງບໍ່ຈົບ (ບໍ່ນັບ CANCELLED/REJECTED) ແລະ ຍັງບໍ່ຫລົ້ນເວລາໄປໝົດ — ໂຊລຽນຕາມເວລາເລີ່ມ
  const relevantBookings = myBookings
    .filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING')
    .filter((b) => new Date(b.endAt) >= new Date(now.getTime() - 60 * 60000)) // ຍັງບໍ່ຈົບເກີນ 1 ຊົ່ວໂມງ
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

  function isActiveNow(b) {
    return new Date(b.startAt) <= now && now < new Date(b.endAt);
  }
  function minutesUntilEnd(b) {
    return Math.round((new Date(b.endAt).getTime() - now.getTime()) / 60000);
  }

  function callAction(path, method, body, onDone) {
    setBusyId(path);
    fetch(`http://localhost:3000/api/room-bookings${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
      .then((res) => res.json().then((responseBody) => ({ ok: res.ok, responseBody })))
      .then(({ ok, responseBody }) => {
        if (!ok) throw new Error(responseBody?.msg || 'ດຳເນີນການບໍ່ສຳເລັດ');
        onDone && onDone();
        fetchMyBookings();
        fetchRooms();
      })
      .catch((err) => alert(err.message))
      .finally(() => setBusyId(null));
  }

  const handleCheckIn = (b) => callAction(`/${b._id}/checkin`, 'PATCH');
  const handleCheckOut = (b) => callAction(`/${b._id}/checkout`, 'PATCH');

  const handleSaveAttendees = (b) => {
    const raw = attendeeDrafts[b._id] ?? (b.attendees || []).join(', ');
    const attendees = raw.split(',').map((s) => s.trim()).filter(Boolean);
    callAction(`/${b._id}/attendees`, 'PATCH', { attendees });
  };

  const openExtendModal = (b) => {
    setExtendModalBooking(b);
    setExtendError('');
    // pre-fill: ຕໍ່ອອກໄປ 30 ນາທີຈາກເວລາສິ້ນສຸດເກົ່າ ເປັນຄ່າຕັ້ງຕົ້ນ ແກ້ໄດ້
    const suggested = new Date(new Date(b.endAt).getTime() + 30 * 60000);
    setExtendNewEndAt(suggested.toISOString().slice(0, 16));
  };

  const submitExtend = (e) => {
    e.preventDefault();
    if (!extendModalBooking) return;
    const newEndAt = new Date(extendNewEndAt);
    if (newEndAt <= new Date(extendModalBooking.startAt)) {
      setExtendError('ເວລາສິ້ນສຸດໃໝ່ຕ້ອງຢູ່ຫຼັງເວລາເລີ່ມ');
      return;
    }
    setExtendSubmitting(true);
    setExtendError('');
    fetch(`http://localhost:3000/api/room-bookings/${extendModalBooking._id}/reschedule`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ startAt: extendModalBooking.startAt, endAt: newEndAt.toISOString() }),
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດຕໍ່ເວລາໄດ້');
        setExtendModalBooking(null);
        fetchMyBookings();
        fetchRooms();
      })
      .catch((err) => setExtendError(err.message))
      .finally(() => setExtendSubmitting(false));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ລາຍງານສະຖານະຫ້ອງປະຊຸມຕົວຈິງ</h1>
          <p className="text-sm text-gray-500 mt-1">
            ສະຖານະຫ້ອງແບບສົດ, ບັນທຶກຄົນເຂົ້າຮ່ວມ, ແລະ ຕໍ່ເວລາປະຊຸມທີ່ໃກ້ໝົດເວລາ
          </p>
        </div>

        {/* ສ່ວນ 1: ສະຖານະຫ້ອງທັງໝົດ (ອ່ານໄດ້ທຸກຄົນ) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 font-bold text-gray-800">ສະຖານະຫ້ອງທັງໝົດ</div>
          {roomsError && <div className="p-4 text-sm text-red-600">{roomsError}</div>}
          {loadingRooms ? (
            <div className="p-8 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rooms.map((room) => {
                const info = roomStatusInfo(room.liveStatus || room.status);
                return (
                  <div key={room._id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DoorClosed size={18} className="text-gray-400" />
                      <div>
                        <div className="font-semibold text-gray-800">{room.name}</div>
                        <div className="text-xs text-gray-400">{room.location} — ຄວາມຈຸ {room.capacity} ຄົນ</div>
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${info.className}`}>{info.label}</span>
                  </div>
                );
              })}
              {rooms.length === 0 && <div className="p-8 text-center text-sm text-gray-400">ບໍ່ມີຫ້ອງປະຊຸມ</div>}
            </div>
          )}
        </div>

        {/* ສ່ວນ 2: ການຈອງຂອງຂ້ອຍ — check-in / check-out / ຜູ້ເຂົ້າຮ່ວມ / ຕໍ່ເວລາ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 font-bold text-gray-800">ການປະຊຸມຂອງທ່ານ</div>
          {bookingsError && <div className="p-4 text-sm text-red-600">{bookingsError}</div>}
          {loadingBookings ? (
            <div className="p-8 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
          ) : relevantBookings.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">ບໍ່ມີການຈອງທີ່ກຳລັງດຳເນີນຢູ່</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {relevantBookings.map((b) => {
                const roomName = b.roomId?.name || b.roomId;
                const active = isActiveNow(b);
                const remaining = minutesUntilEnd(b);
                const nearEnd = active && remaining <= 15;
                const checkedIn = !!b.checkedInAt;
                const checkedOut = !!b.checkedOutAt;

                return (
                  <div key={b._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-gray-800">{b.title || 'ການປະຊຸມ'} — {roomName}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock size={12} />
                          {new Date(b.startAt).toLocaleString()} — {new Date(b.endAt).toLocaleTimeString()}
                        </div>
                      </div>
                      {b.status === 'PENDING' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">ລໍຖ້າອະນຸມັດ</span>
                      )}
                    </div>

                    {nearEnd && !checkedOut && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-xl">
                        <AlertTriangle size={14} />
                        <span>ໃກ້ໝົດເວລາອີກ {remaining} ນາທີ — ຕ້ອງການໃຊ້ຕໍ່ບໍ?</span>
                      </div>
                    )}

                    {b.status === 'CONFIRMED' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {!checkedIn && !checkedOut && (
                          <button
                            onClick={() => handleCheckIn(b)}
                            disabled={busyId === `/${b._id}/checkin`}
                            className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <LogIn size={14} /> Check-in
                          </button>
                        )}
                        {checkedIn && !checkedOut && (
                          <>
                            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                              ✓ ເຂົ້າຫ້ອງແລ້ວ {new Date(b.checkedInAt).toLocaleTimeString()}
                            </span>
                            <button
                              onClick={() => handleCheckOut(b)}
                              disabled={busyId === `/${b._id}/checkout`}
                              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                            >
                              <LogOut size={14} /> Check-out
                            </button>
                            <button
                              onClick={() => openExtendModal(b)}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium transition flex items-center gap-1"
                            >
                              <Plus size={14} /> ຕໍ່ເວລາ
                            </button>
                          </>
                        )}
                        {checkedOut && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                            ອອກຈາກຫ້ອງແລ້ວ {new Date(b.checkedOutAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* ບັນທຶກຜູ້ເຂົ້າຮ່ວມ — ໃຫ້ແກ້ໄດ້ຕະຫຼອດ (ບໍ່ຈຳກັດວ່າຕ້ອງ check-in ກ່ອນ, ອາດຢາກໃສ່ລ່ວງໜ້າ) */}
                    <div className="flex items-center gap-2 pt-1">
                      <Users size={14} className="text-gray-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="ຊື່ຜູ້ເຂົ້າຮ່ວມ, ຄັ່ນດ້ວຍຈຸດຈ້ຳ (,)"
                        value={attendeeDrafts[b._id] ?? (b.attendees || []).join(', ')}
                        onChange={(e) => setAttendeeDrafts((prev) => ({ ...prev, [b._id]: e.target.value }))}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                      />
                      <button
                        onClick={() => handleSaveAttendees(b)}
                        disabled={busyId === `/${b._id}/attendees`}
                        className="text-xs px-2.5 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition disabled:opacity-50"
                      >
                        ບັນທຶກ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal ຕໍ່ເວລາ */}
        {extendModalBooking && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={submitExtend} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ຕໍ່ເວລາປະຊຸມ</h2>
                <button type="button" onClick={() => setExtendModalBooking(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {extendModalBooking.roomId?.name || extendModalBooking.roomId} — ເລີ່ມ {new Date(extendModalBooking.startAt).toLocaleString()}
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ເວລາສິ້ນສຸດໃໝ່</label>
                <input
                  type="datetime-local"
                  value={extendNewEndAt}
                  onChange={(e) => setExtendNewEndAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>
              {extendError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{extendError}</div>
              )}
              <p className="text-xs text-gray-400">
                ລະບົບຈະກວດອັດຕະໂນມັດວ່າຊ່ວງເວລານີ້ມີຄົນອື່ນຈອງຕໍ່ຈາກທ່ານແລ້ວຫຼືບໍ່ — ຖ້າຊົນຈະບໍ່ອະນຸຍາດ.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setExtendModalBooking(null)} className="px-4 py-2 text-sm text-gray-600">ຍົກເລີກ</button>
                <button type="submit" disabled={extendSubmitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {extendSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ຢືນຢັນຕໍ່ເວລາ'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
