import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Plus, Loader2, X, ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    body: '',
    departmentId: '',
    tags: ''
  });

  const token = localStorage.getItem('token');

  const extractArrayData = (resData) => {
    if (Array.isArray(resData)) return resData;
    if (resData && Array.isArray(resData.data)) return resData.data;
    if (resData && Array.isArray(resData.articles)) return resData.articles;
    return [];
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const endpoint = searchQuery 
        ? `http://localhost:3000/api/kb-articles/search?q=${encodeURIComponent(searchQuery)}`
        : 'http://localhost:3000/api/kb-articles';

      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setArticles(extractArrayData(data));
      }
    } catch (error) {
      console.error('Error fetching kb-articles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchArticles();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // ຈັດການແປງ tags ຈາກ string (ຂັ້ນດ້ວຍ comma) ໃຫ້ເປັນ Array
      const formattedTags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      const payload = {
        title: formData.title,
        category: formData.category,
        body: formData.body,
        departmentId: formData.departmentId,
        tags: formattedTags
      };

      const res = await fetch('http://localhost:3000/api/kb-articles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ title: '', category: '', body: '', departmentId: '', tags: '' });
        fetchArticles();
      } else {
        const err = await res.json();
        alert(err.message || 'ບໍ່ສາມາດສ້າງບົດຄວາມໄດ້');
      }
    } catch (error) {
      console.error('Error creating article:', error);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ເຊີບເວີ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຖານຂໍ້ມູນຄວາມຮູ້ / FAQ</h1>
            <p className="text-sm text-gray-500 mt-1">ຄູ່ມື ແລະ ວິທີແກ້ໄຂບັນຫາເບື້ອງຕົ້ນໃນລະບົບ (MongoDB)</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
          >
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
          {loading ? (
            <div className="col-span-full py-12 text-center text-gray-400 flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-200">
              <Loader2 className="animate-spin" size={20} />
              <span>ກຳລັງໂຫລດຂໍ້ມູນ...</span>
            </div>
          ) : articles.length > 0 ? (
            articles.map((item) => (
              <div key={item._id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3 hover:shadow-md transition flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
                      <BookOpen size={16} />
                      {item.category || 'ທົ່ວໄປ'}
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono text-[10px]">
                      {item._id}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 text-base">{item.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-3">{item.body}</p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Eye size={14} /> {item.viewCount || 0}</span>
                    <span className="flex items-center gap-1 text-emerald-600"><ThumbsUp size={14} /> {item.helpfulCount || 0}</span>
                    <span className="flex items-center gap-1 text-rose-600"><ThumbsDown size={14} /> {item.notHelpfulCount || 0}</span>
                  </div>
                  <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-medium">
                    {item.departmentId}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              ຍັງບໍ່ມີບົດຄວາມໃນລະບົບ
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg">ເພີ່ມບົດຄວາມຄວາມຮູ້ໃໝ່</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຫົວຂໍ້ບົດຄວາມ (Title)</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="ລະບຸຫົວຂໍ້..." 
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ໝວດໝູ່ (Category)</label>
                  <input 
                    type="text" 
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="ເຊັ່ນ: Networking" 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ລະຫັດພະແນກ (Department ID)</label>
                  <input 
                    type="text" 
                    required
                    value={formData.departmentId}
                    onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                    placeholder="DX001" 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ເນື້ອໃນ (Body)</label>
                <textarea 
                  rows="4"
                  required
                  value={formData.body}
                  onChange={(e) => setFormData({...formData, body: e.target.value})}
                  placeholder="ຂຽນຄູ່ມື ຫຼື ວິທີແກ້ໄຂບັນຫາ..." 
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tags (ຂັ້ນດ້ວຍຈໍ້າເມັດ comma)</label>
                <input 
                  type="text" 
                  value={formData.tags}
                  onChange={(e) => setFormData({...formData, tags: e.target.value})}
                  placeholder="vpn, network, connection" 
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  ຍົກເລີກ
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  <span>ບັນທຶກ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}