import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Plus, Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  /* 
  useEffect(() => {
    // ດຶງຂໍ້ມູນຈາກ NestJS API: GET /api/knowledge-base
    fetch('http://localhost:3000/api/knowledge-base')
      .then(res => res.json())
      .then(data => setArticles(data));
  }, []);
  */

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຄັງຄວາມຮູ້ / FAQ</h1>
            <p className="text-sm text-gray-500 mt-1">ຄູ່ມື ແລະ ວິທີແກ້ໄຂບັນຫາເບື້ອງຕົ້ນໃນລະບົບ (MongoDB)</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <Plus size={18} />
            <span>ເພີ່ມບົດຄວາມ</span>
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ຄົ້ນຫາຫົວຂໍ້ຄູ່ມື, ວິທີໃຊ້ງານ..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.length > 0 ? (
            articles.map((item) => (
              <div key={item._id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
                  <BookOpen size={18} />
                  <span>{item.category}</span>
                </div>
                <h3 className="font-bold text-gray-800">{item.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2">{item.content}</p>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              ຍັງບໍ່ມີບົດຄວາມໃນລະບົບ (ພ້ອມເຊື່ອມຕໍ່ NestJS Backend)
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}