import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, X, Loader2, Calendar, Pin, Trash2, CheckCircle2, Eye, Building2, Users } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';

export default function Announcements() {
  const canCreate = hasPermission('announcements', 'create');
  const canUpdate = hasPermission('announcements', 'update'); // pin/unpin ໃຊ້ action 'update' ຕາມ backend
  const canDelete = hasPermission('announcements', 'delete');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // State ສຳລັບເບິ່ງລາຍລະອຽດປະກາດ
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    body: '',
    scope: 'COMPANY',
    branchId: '',
    departmentId: '',
    publishAt: '',
    expireAt: '',
    pinned: false
  });

  const token = localStorage.getItem('token');

  const extractArrayData = (resData) => {
    if (Array.isArray(resData)) return resData;
    if (resData && Array.isArray(resData.data)) return resData.data;
    return [];
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/announcements/active', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(extractArrayData(data));
      }
    } catch (error) {
      console.error('Error fetching active announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        title: formData.title,
        body: formData.body,
        scope: formData.scope,
        pinned: formData.pinned
      };

      if (formData.scope === 'BRANCH' && formData.branchId) {
        payload.branchId = formData.branchId;
      }
      if (formData.scope === 'DEPARTMENT' && formData.departmentId) {
        payload.departmentId = formData.departmentId;
      }
      if (formData.publishAt) {
        payload.publishAt = new Date(formData.publishAt).toISOString();
      }
      if (formData.expireAt) {
        payload.expireAt = new Date(formData.expireAt).toISOString();
      }

      const res = await fetch('http://localhost:3000/api/announcements', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          title: '',
          body: '',
          scope: 'COMPANY',
          branchId: '',
          departmentId: '',
          publishAt: '',
          expireAt: '',
          pinned: false
        });
        fetchAnnouncements();
      } else {
        const err = await res.json();
        alert(err.message || 'ບໍ່ສາມາດສ້າງປະກາດໄດ້');
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ເຊີບເວີ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePin = async (id, currentPinned, e) => {
    e.stopPropagation();
    const endpoint = currentPinned 
      ? `http://localhost:3000/api/announcements/${id}/unpin` 
      : `http://localhost:3000/api/announcements/${id}/pin`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchAnnouncements();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('ຕ້ອງການລຶບປະກາດນີ້ແທ້ບໍ?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await fetch(`http://localhost:3000/api/announcements/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setItems(items.map(item => item._id === id ? { ...item, isRead: true } : item));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleOpenDetail = async (ann) => {
    setSelectedAnnouncement(ann);
    setIsDetailOpen(true);
    // ຖ້າຫາກຍังບໍ່ໄດ້ອ່ານ, ໃຫ້ສົ່ງ Request ໄປໝາຍວ່າອ່ານແລ້ວອັດຕະໂນມັດ
    if (!ann.isRead) {
      await handleMarkRead(ann._id);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ປະກາດ ແລະ ຂ່າວສານ</h1>
            <p className="text-sm text-gray-500 mt-1">ແຈ້ງຂໍ້ມູນຂ່າວສານສຳຄັນພາຍໃນອົງກອນ</p>
          </div>
          {canCreate && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span>ສ້າງປະກາດໃໝ່</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-gray-400 flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-200">
              <Loader2 className="animate-spin" size={20} />
              <span>ກຳລັງໂຫລດຂໍ້ມູນ...</span>
            </div>
          ) : items.length > 0 ? (
            items.map((ann) => (
              <div 
                key={ann._id} 
                onClick={() => handleOpenDetail(ann)}
                className={`bg-white p-5 rounded-xl border transition cursor-pointer hover:border-amber-400 hover:shadow-md space-y-3 ${
                  ann.pinned 
                    ? 'border-amber-400 shadow-sm ring-1 ring-amber-400/20' 
                    : 'border-gray-200'
                } ${!ann.isRead ? 'bg-amber-50/20' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Megaphone size={18} className="text-amber-500" />
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono text-[10px]">{ann._id}</span>
                    <h3 className="font-bold text-gray-800 text-base hover:text-amber-600 transition">{ann.title}</h3>
                    {ann.pinned && (
                      <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Pin size={10} /> ປັກໝຸດ
                      </span>
                    )}
                    {!ann.isRead && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        ຍັງບໍ່ໄດ້ອ່ານ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </span>
                    {canUpdate && (
                      <button 
                        onClick={(e) => handleTogglePin(ann._id, ann.pinned, e)} 
                        className="text-gray-400 hover:text-amber-600 transition p-1" 
                        title={ann.pinned ? "ຍົກເລີກປັກໝຸດ" : "ປັກໝຸດ"}
                      >
                        <Pin size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        onClick={(e) => handleDelete(ann._id, e)} 
                        className="text-gray-400 hover:text-rose-600 transition p-1" 
                        title="ລຶບປະກາດ"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 pl-6">{ann.body}</p>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              ຍັງບໍ່ມີປະກາດໃນລະບົບຂະນະນີ້
            </div>
          )}
        </div>
      </div>

      {/* Modal ສະແດງລາຍລະອຽດປະກາດ */}
      {isDetailOpen && selectedAnnouncement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-mono text-xs font-semibold">{selectedAnnouncement._id}</span>
                <span className="text-xs text-gray-500">
                  ເຜີຍແຜ່ເມື່ອ: {new Date(selectedAnnouncement.createdAt).toLocaleString()}
                </span>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-800">{selectedAnnouncement.title}</h2>
              
              <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div><span className="font-semibold">ຂອບເຂດ:</span> {selectedAnnouncement.scope}</div>
                {selectedAnnouncement.branchId && <div><span className="font-semibold">ສາຂາ:</span> {selectedAnnouncement.branchId}</div>}
                {selectedAnnouncement.departmentId && <div><span className="font-semibold">ພະແນກ:</span> {selectedAnnouncement.departmentId}</div>}
              </div>

              <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed py-2">
                {selectedAnnouncement.body}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition"
                >
                  ປິດ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal ສ້າງປະກາດໃໝ່ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-800 text-lg">ສ້າງປະກາດແຈ້ງເຕືອນໃໝ່</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຫົວຂໍ້ປະກາດ (Title)</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="ລະບຸຫົວຂໍ້ປະກາດ..." 
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຂອບເຂດການເບິ່ງເຫັນ (Scope)</label>
                <select 
                  value={formData.scope}
                  onChange={(e) => setFormData({...formData, scope: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                >
                  <option value="COMPANY">ທົ່ວອົງກອນ (Company)</option>
                  <option value="BRANCH">ສະເພາະສາຂາ (Branch)</option>
                  <option value="DEPARTMENT">ສະເພາະພະແນກ (Department)</option>
                </select>
              </div>

              {formData.scope === 'BRANCH' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ລະຫັດສາຂາ (Branch ID - BX001)</label>
                  <input 
                    type="text" 
                    required
                    value={formData.branchId}
                    onChange={(e) => setFormData({...formData, branchId: e.target.value})}
                    placeholder="BX001" 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              )}

              {formData.scope === 'DEPARTMENT' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ລະຫັດພະແນກ (Department ID - DX001)</label>
                  <input 
                    type="text" 
                    required
                    value={formData.departmentId}
                    onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                    placeholder="DX001" 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ວັນທີເລີ່ມເຜີຍແຜ່ (Publish At)</label>
                  <input 
                    type="datetime-local" 
                    value={formData.publishAt}
                    onChange={(e) => setFormData({...formData, publishAt: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ວັນທີໝົດອາຍຸ (Expire At)</label>
                  <input 
                    type="datetime-local" 
                    value={formData.expireAt}
                    onChange={(e) => setFormData({...formData, expireAt: e.target.value})}
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="ລາຍລະອຽດເນື້ອໃນປະກາດ..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="pinned"
                  checked={formData.pinned}
                  onChange={(e) => setFormData({...formData, pinned: e.target.checked})}
                  className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="pinned" className="text-xs font-medium text-gray-700 cursor-pointer">ປັກໝຸດປະກາດນີ້ (Pin Announcement)</label>
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
                  <span>ບັນທຶກປະກາດ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}