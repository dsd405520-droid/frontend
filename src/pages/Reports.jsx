import React, { useState, useEffect } from 'react';
import { BarChart3, Download } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function Reports() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ບົດລາຍງານສະຫຼຸບ ແລະ ວິເຄາະ</h1>
            <p className="text-sm text-gray-500 mt-1">ສະຖິຕິ ແລະ ປະສິດທິພາບການເຮັດວຽກຂອງລະບົບ (Analytics)</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <Download size={18} />
            <span>ສົ່ງອອກລາຍງານ (PDF/CSV)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <p className="text-sm text-gray-500">ປີ້ທັງໝົດໃນລະບົບ</p>
            <h3 className="text-3xl font-bold text-gray-800">0</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <p className="text-sm text-gray-500">ອັດຕາການເຮັດຕາມ SLA</p>
            <h3 className="text-3xl font-bold text-green-600">0%</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <p className="text-sm text-gray-500">ຄະແນນຄວາມພໍໃຈ (CSAT)</p>
            <h3 className="text-3xl font-bold text-amber-500">0.0</h3>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}