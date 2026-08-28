import React, { useState, useEffect } from 'react';
import { Package, Plus } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function AssetManagement() {
  const [assets, setAssets] = useState([]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຈັດການຊັບສິນ (Asset Management)</h1>
            <p className="text-sm text-gray-500 mt-1">ທະບຽນ ແລະ ຕິດຕາມຊັບສິນໄອທີຂອງບໍລິສັດ (ແລັບທັອບ, ຈໍພາບ, ແລະ ອື່ນໆ)</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <Plus size={18} />
            <span>ເພີ່ມຊັບສິນໃໝ່</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດຊັບສິນ (_id)</th>
                <th className="p-4 font-medium">ຊື່ຊັບສິນ / Serial No</th>
                <th className="p-4 font-medium">ປະເພດ</th>
                <th className="p-4 font-medium">ຜູ້ຖືຄອງ</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {assets.length > 0 ? (
                assets.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">{item.code}</td>
                    <td className="p-4">{item.name}</td>
                    <td className="p-4">{item.type}</td>
                    <td className="p-4">{item.holder || '—'}</td>
                    <td className="p-4">{item.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    ຍັງບໍ່ดີຂໍ້ມູນຊັບສິນ (ພ້ອມເຊື່ອມຕໍ່ NestJS + MongoDB)
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