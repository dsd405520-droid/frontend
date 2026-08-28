import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function Settings() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ການຕັ້ງຄ່າລະບົບ</h1>
          <p className="text-sm text-gray-500 mt-1">ຕັ້ງຄ່າທົ່ວໄປ, S3, SMTP ແລະ Integration Keys (ສຳລັບ Super Admin)</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-800 text-base border-b pb-3">ຕັ້ງຄ່າທົ່ວໄປຂອງອົງກອນ</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ຊື່ລະບົບ / ບໍລິສັດ</label>
              <input type="text" defaultValue="Helpdesk Enterprise" className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm">
              ບັນທຶກການຕັ້ງຄ່າ
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}