import React from 'react';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Bell, 
  Info
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="space-y-6">
        
        {/* ປະກາດປັກໝຸດ (Announcement Banner) */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between text-blue-900 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="bg-red-500 text-white p-1 rounded-lg flex items-center justify-center">
              <Info size={18} />
            </span>
            <span className="text-sm font-medium">
              <strong>ປະກາດປັກໝຸດ:</strong> [ແຈ້ງການ/ປະກາດສຳຄັນ]
            </span>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-500 text-sm">ລາຍການທີ່ເປີດຢູ່</span>
              <span className="bg-amber-100 text-amber-700 p-2 rounded-lg"><AlertCircle size={20} /></span>
            </div>
            <h2 className="text-3xl font-bold mt-2 text-gray-300">-</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">ລາຍລະອຽດ SLA</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-500 text-sm">ລໍຖ້າການອະນຸມັດ</span>
              <span className="bg-red-100 text-red-700 p-2 rounded-lg"><Clock size={20} /></span>
            </div>
            <h2 className="text-3xl font-bold mt-2 text-gray-300">-</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">ລາຍລະອຽດເວລາ</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-500 text-sm">CSAT ສະເລ່ຍ</span>
              <span className="bg-emerald-100 text-emerald-700 p-2 rounded-lg"><CheckCircle2 size={20} /></span>
            </div>
            <h2 className="text-3xl font-bold mt-2 text-gray-300">-</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">ຄະແນນຄວາມພໍໃຈ</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-500 text-sm">ປະກາດໃໝ່</span>
              <span className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Bell size={20} /></span>
            </div>
            <h2 className="text-3xl font-bold mt-2 text-gray-300">-</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">ຈຳນວນປະກາດ</p>
          </div>
        </div>

        {/* Main Content Grid (Left Table & Right Activity) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: ລາຍການແຈ້ງຊ່ວຍເຫຼືອຂອງຂ້ອຍ */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-gray-800 text-base">ລາຍການແຈ້ງຂອງຂ້ອຍ — ໃຫ້ທັນກຳນົດ</h3>
                <p className="text-xs text-gray-500">ຮຽງຕາມເວລາ SLA ທີ່ເຫຼືອນ້ອຍສຸດ</p>
              </div>
              <button className="text-xs bg-gray-100 text-gray-400 px-3 py-1.5 rounded-lg font-medium cursor-not-allowed">
                ເບິ່ງທັງໝົດ
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs">
                    <th className="pb-3 font-medium">SLA</th>
                    <th className="pb-3 font-medium">ລະຫັດ</th>
                    <th className="pb-3 font-medium">ຫົວຂໍ້</th>
                    <th className="pb-3 font-medium">ຄວາມສຳຄັນ</th>
                    <th className="pb-3 font-medium">ສະຖານະ</th>
                    <th className="pb-3 font-medium">ເຈົ້າໜ້າທີ່</th>
                    <th className="pb-3 font-medium">ສ້າງເມື່ອ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-400">
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-sm text-gray-400">
                      ຍັງບໍ່ມີຂໍ້ມູນ (ກະລຸນາເຊື່ອມຕໍ່ API)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: ກິດຈະກຳຫຼ້າສຸດ */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 text-base mb-4">ກິດຈະກຳຫຼ້າສຸດ</h3>
            <div className="py-12 text-center text-sm text-gray-400">
              ຍັງບໍ່ມີກິດຈະກຳ
            </div>
          </div>

        </div>

        {/* Bottom 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 1. ລາຍການຕາມສະຖານະ */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 text-base mb-4">ລາຍການຕາມສະຖານະ</h3>
            <div className="py-10 text-center text-sm text-gray-400">
              [ກຣາຟສະແດງຜົນ]
            </div>
          </div>

          {/* 2. ຫ້ອງປະຊຸມ — ຕອນນີ້ */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 text-base mb-4">ຫ້ອງປະຊຸມ — ຕອນນີ້</h3>
            <div className="py-10 text-center text-sm text-gray-400">
              [ສະຖານະຫ້ອງປະຊຸມ]
            </div>
          </div>

          {/* 3. ຄຳຂໍອຸປະກອນຫຼ້າສຸດ */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 text-base mb-4">ຄຳຂໍອຸປະກອນຫຼ້າສຸດ</h3>
            <div className="py-10 text-center text-sm text-gray-400">
              [ລາຍການຄຳຂໍ]
            </div>
          </div>

        </div>

      </div>
    </MainLayout>
  );
}