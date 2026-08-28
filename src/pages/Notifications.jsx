import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function Notifications() {
  const [notifs, setNotifs] = useState([]);

  /*
  useEffect(() => {
    fetch('http://localhost:3000/api/notifications')
      .then(res => res.json())
      .then(data => setNotifs(data));
  }, []);
  */

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ການແຈ້ງເຕືອນ</h1>
            <p className="text-sm text-gray-500 mt-1">ສູນລວມການແຈ້ງເຕືອນທັງໝົດໃນລະບົບ</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {notifs.length > 0 ? (
            notifs.map((item) => (
              <div key={item._id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <Bell className="text-amber-500" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.message}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">
              ບໍ່ມີການແຈ້ງເຕືອນໃໝ່ (ພ້ອມເຊື່ອມຕໍ່ Real-time WebSocket / NestJS)
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}