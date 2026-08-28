import React, { useState, useEffect } from 'react';
import { Calendar, Plus, DoorClosed } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function MeetingRooms() {
  const [rooms, setRooms] = useState([]);

  /* 
  useEffect(() => {
    // ດຶງຂໍ້ມູນຈາກ NestJS API: GET /api/meeting-rooms
    fetch('http://localhost:3000/api/meeting-rooms')
      .then(res => res.json())
      .then(data => setRooms(data));
  }, []);
  */

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຈອງຫ້ອງປະຊຸມ</h1>
            <p className="text-sm text-gray-500 mt-1">ກວດສອບສະຖານະ ແລະ ຈອງຫ້ອງປະຊຸມອອນໄລນ໌</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <Plus size={18} />
            <span>ຈອງຫ້ອງປະຊຸມ</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <div key={room._id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 text-base">{room.name}</h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{room.status}</span>
                </div>
                <p className="text-sm text-gray-500">ຄວາມຈຸ: {room.capacity} ຄົນ</p>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              ຍັງບໍ່ມີຂໍ້ມູນຫ້ອງປະຊຸມ (ກະລຸນາເຊື່ອມຕໍ່ API Backend)
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}