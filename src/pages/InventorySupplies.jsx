import React, { useState, useEffect } from 'react';
import { Package, Plus } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function InventorySupplies() {
  const [supplies, setSupplies] = useState([]);

  /* 
  useEffect(() => {
    // ດຶງຂໍ້ມູນຈາກ NestJS API: GET /api/supplies
    fetch('http://localhost:3000/api/supplies')
      .then(res => res.json())
      .then(data => setSupplies(data));
  }, []);
  */

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຂໍອຸປະກອນສິ້ນເປືອງ</h1>
            <p className="text-sm text-gray-500 mt-1">ຍື່ນຄຳຂໍເບີກວັດສະດຸ ແລະ ຕິດຕາມສະຖານະການອະນຸມັດ</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <Plus size={18} />
            <span>ສ້າງຄຳຂໍອຸປະກອນ</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດຄຳຂໍ (_id)</th>
                <th className="p-4 font-medium">ລາຍການອຸປະກອນ</th>
                <th className="p-4 font-medium">ຈຳນວນ</th>
                <th className="p-4 font-medium">ຜູ້ຍື່ນຄຳຂໍ</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {supplies.length > 0 ? (
                supplies.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">{item.code}</td>
                    <td className="p-4">{item.itemName}</td>
                    <td className="p-4">{item.quantity}</td>
                    <td className="p-4">{item.requester}</td>
                    <td className="p-4">{item.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    ຍັງບໍ່ມີຄຳຂໍອຸປະກອນ (ຮອງຮັບ MongoDB & NestJS API ແລ້ວ)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}