import React, { useState, useEffect } from 'react';
import { Clock, Plus, Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function Slamanagement() {
  const [slas, setSlas] = useState([]);
  const [loading, setLoading] = useState(false);

  /*
  useEffect(() => {
    fetch('http://localhost:3000/api/slas')
      .then(res => res.json())
      .then(data => setSlas(data));
  }, []);
  */

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ການຈັດການ SLA</h1>
            <p className="text-sm text-gray-500 mt-1">ກຳນົດນະໂຍບາຍເວລາຕອບກັບ ແລະ ແກ້ໄຂບັນຫາ (NestJS + MongoDB)</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <Plus size={18} />
            <span>ເພີ່ມນະໂຍບາຍ SLA</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ຊື່ນະໂຍບາຍ (_id)</th>
                <th className="p-4 font-medium">ລະດັບຄວາມສຳຄັນ</th>
                <th className="p-4 font-medium">ເວລາຕອບກັບ (Response Time)</th>
                <th className="p-4 font-medium">ເວລາແກ້ໄຂ (Resolution Time)</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {slas.length > 0 ? (
                slas.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">{item.name}</td>
                    <td className="p-4">{item.priority}</td>
                    <td className="p-4">{item.responseTime} ຊມ.</td>
                    <td className="p-4">{item.resolutionTime} ຊມ.</td>
                    <td className="p-4">{item.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    ຍັງບໍ່ມີຂໍ້ມູນ SLA (ກະລຸນາເຊື່ອມຕໍ່ API Backend)
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