import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function Issues() {
  // 1. ກຽມ State ສຳລັບຮອງຮັບข้อมูลຈາກ NestJS API (MongoDB documents)
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 2. ຕົວຢ່າງ Function ສຳລັບດຶງຂໍ້ມູນຈາກ NestJS Backend (ສາມາດໃຫ້ໝູ່ເອໄປປັບ URL API ຕາມຕົວຈິງໄດ້ເລີຍ)
  /*
  useEffect(() => {
    const fetchIssues = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:3000/api/issues'); // ຕົວຢ່າງ Endpoint ຈາກ NestJS
        const data = await response.json();
        setIssues(data); // ຂໍ້ມູນ JSON ຈາກ MongoDB ຈະມີ _id
      } catch (error) {
        console.error('Error fetching issues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, []);
  */

  return (
    <MainLayout>
      <div className="space-y-6">
        
        {/* Header Title & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ແກ້ໄຂບັນຫາ</h1>
            <p className="text-sm text-gray-500 mt-1">ຈັດການ ແລະ ຕິດຕາມສະຖານະການແຈ້ງບັນຫາຕ່າງໆໃນລະບົບ (NestJS + MongoDB)</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <Plus size={18} />
            <span>ສ້າງລາຍການໃໝ່</span>
          </button>
        </div>

        {/* Filter & Search Bar Section */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ຄົ້ນຫາລະຫັດ, ຫົວຂໍ້, ຜູ້ໃຊ້..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 transition">
              <Filter size={16} />
              <span>ກອງສະຖານະ</span>
            </button>
          </div>
        </div>

        {/* Main Data Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                  <th className="p-4 font-medium">SLA</th>
                  <th className="p-4 font-medium">ລະຫັດ (_id / code)</th>
                  <th className="p-4 font-medium">ຫົວຂໍ້ບັນຫາ</th>
                  <th className="p-4 font-medium">ຄວາມສຳຄັນ</th>
                  <th className="p-4 font-medium">ສະຖານະ</th>
                  <th className="p-4 font-medium">ເຈົ້າໜ້າທີ່ຮັບຜິດຊອບ</th>
                  <th className="p-4 font-medium">ສ້າງເມື່ອ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        <span>ກຳລັງໂຫລດຂໍ້ມູນຈາກ NestJS...</span>
                      </div>
                    </td>
                  </tr>
                ) : issues.length > 0 ? (
                  // Loop ສະແດງຂໍ້ມູນຈາກ MongoDB (ຕອນຕໍ່ API ແລ້ວ)
                  issues.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="p-4">{item.sla || '—'}</td>
                      <td className="p-4 font-semibold text-gray-900">{item.code}</td>
                      <td className="p-4">{item.title}</td>
                      <td className="p-4">{item.priority}</td>
                      <td className="p-4">{item.status}</td>
                      <td className="p-4">{item.assignee}</td>
                      <td className="p-4 text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  // ករណីຍັງບໍ່ມີຂໍ້ມູນ ຫຼື ຍັງບໍ່ໄດ້ຕໍ່ API
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-sm text-gray-400">
                      ຍັງບໍ່ມີຂໍ້ມູນ (ໂຄງສ້າງພ້ອມເຊື່ອມຕໍ່ MongoDB & NestJS API ແລ້ວ)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </MainLayout>
  );
}