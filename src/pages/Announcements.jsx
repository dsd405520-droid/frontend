import React, { useState, useEffect } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function Announcements() {
  const [items, setItems] = useState([]);

  /*
  useEffect(() => {
    fetch('http://localhost:3000/api/announcements')
      .then(res => res.json())
      .then(data => setItems(data));
  }, []);
  */

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ປະກາດ ແລະ ຂ່າວສານ</h1>
            <p className="text-sm text-gray-500 mt-1">ແຈ້ງຂໍ້ມູນຂ່າວສານສຳຄັນພາຍໃນອົງກອນ</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <Plus size={18} />
            <span>ສ້າງປະກາດໃໝ່</span>
          </button>
        </div>

        <div className="space-y-4">
          {items.length > 0 ? (
            items.map((ann) => (
              <div key={ann._id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 text-base">{ann.title}</h3>
                  <span className="text-xs text-gray-400">{new Date(ann.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-600">{ann.content}</p>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              ຍັງບໍ່ມີປະກາດໃນລະບົບ (ຮອງຮັບ MongoDB & NestJS API)
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}