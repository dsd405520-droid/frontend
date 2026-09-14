import React, { useState, useEffect } from 'react';
import { Tag, Plus, X, Loader2, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const EMPTY_FORM = {
  name: '',
  defaultDepartmentId: '',
  defaultPriority: 'medium',
  description: '',
  isActive: true,
};

export default function TicketTypesManagement() {
  const [types, setTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [deletingId, setDeletingId] = useState(null);

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Authorization': `Bearer ${token}` };

  const hasPermission = (module, action) => {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const perms = payload.permissions || [];
      const entry = perms.find(p => p.module === module);
      return !!entry?.actions?.includes(action);
    } catch {
      return false;
    }
  };
  const canRead = hasPermission('ticket-types', 'read');
  const canCreate = hasPermission('ticket-types', 'create');
  const canUpdate = hasPermission('ticket-types', 'update');
  const canDelete = hasPermission('ticket-types', 'delete');

  const extractArray = (body) => (Array.isArray(body) ? body : body?.data || []);

  const fetchData = () => {
    setLoading(true);
    setLoadError('');
    Promise.all([
      fetch('http://localhost:3000/api/ticket-types', { headers }),
      fetch('http://localhost:3000/api/departments', { headers }),
    ])
      .then(async ([typesRes, deptRes]) => {
        if (typesRes.status === 403) {
          throw new Error('ບໍ່ມີສິດເຂົ້າເຖິງ (ticket-types:read)');
        }
        if (!typesRes.ok) {
          const result = await typesRes.json().catch(() => ({}));
          throw new Error(result.message || `ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (HTTP ${typesRes.status})`);
        }
        const typesBody = await typesRes.json();
        setTypes(extractArray(typesBody));

        if (deptRes.ok) {
          const deptBody = await deptRes.json();
          setDepartments(extractArray(deptBody));
        }
        setLoading(false);
      })
      .catch(err => {
        setLoadError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departmentName = (id) => departments.find(d => d._id === id)?.name || id || '-';

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (t) => {
    setEditingId(t._id);
    setForm({
      name: t.name || '',
      defaultDepartmentId: t.defaultDepartmentId || '',
      defaultPriority: t.defaultPriority || 'medium',
      description: t.description || '',
      isActive: t.isActive !== false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.defaultDepartmentId) {
      setFormError('ກະລຸນາລະບຸຊື່ປະເພດ ແລະ ເລືອກພະແນກຮັບຜິດຊອບ');
      return;
    }
    setSubmitting(true);
    setFormError('');

    const url = editingId
      ? `http://localhost:3000/api/ticket-types/${editingId}`
      : 'http://localhost:3000/api/ticket-types';
    const method = editingId ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.message || 'ບັນທຶກບໍ່ສຳເລັດ');
      }
      closeModal();
      fetchData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`ຕ້ອງການລຶບປະເພດ "${t.name}" ແທ້ບໍ? ຖ້າຍັງມີບັນຫາທີ່ໃຊ້ປະເພດນີ້ຢູ່ ອາດຈະລຶບບໍ່ໄດ້.`)) return;
    setDeletingId(t._id);
    try {
      const res = await fetch(`http://localhost:3000/api/ticket-types/${t._id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.message || 'ລຶບບໍ່ສຳເລັດ');
      }
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ປະເພດບັນຫາ (Ticket Types)</h1>
            <p className="text-sm text-gray-500 mt-1">
              ຈັດການປະເພດບັນຫາທີ່ໃຊ້ຕອນສ້າງ Ticket — ແຕ່ລະປະເພດຈະກຳນົດພະແນກ ແລະ ຄວາມສຳຄັນເລີ່ມຕົ້ນອັດຕະໂນມັດ
            </p>
          </div>
          {canCreate && (
            <button
              onClick={openCreateModal}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span>ສ້າງປະເພດໃໝ່</span>
            </button>
          )}
        </div>

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle size={16} /> {loadError}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ຊື່ປະເພດ</th>
                <th className="p-4 font-medium">ພະແນກຮັບຜິດຊອບ</th>
                <th className="p-4 font-medium">ຄວາມສຳຄັນເລີ່ມຕົ້ນ</th>
                <th className="p-4 font-medium">ລາຍລະອຽດ</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
                <th className="p-4 font-medium text-right">ຈັດການ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr><td colSpan="6" className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td></tr>
              ) : types.length > 0 ? (
                types.map((t) => (
                  <tr key={t._id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800 flex items-center gap-2">
                      <Tag size={14} className="text-gray-400" /> {t.name}
                    </td>
                    <td className="p-4">{departmentName(t.defaultDepartmentId)}</td>
                    <td className="p-4 capitalize">{t.defaultPriority}</td>
                    <td className="p-4 text-xs text-gray-500 max-w-xs truncate">{t.description || '-'}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {t.isActive !== false ? 'ໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {canUpdate && (
                          <button onClick={() => openEditModal(t)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="ແກ້ໄຂ">
                            <Pencil size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(t)}
                            disabled={deletingId === t._id}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50"
                            title="ລຶບ"
                          >
                            {deletingId === t._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="py-12 text-center text-sm text-gray-400">ຍັງບໍ່ມີປະເພດບັນຫາ</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">
                  {editingId ? 'ແກ້ໄຂປະເພດບັນຫາ' : 'ສ້າງປະເພດບັນຫາໃໝ່'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ຊື່ປະເພດບັນຫາ <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ເຊັ່ນ: VPN Access Issue"
                    required
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ພະແນກຮັບຜິດຊອບ <span className="text-red-500">*</span></label>
                  <select
                    value={form.defaultDepartmentId}
                    onChange={(e) => setForm({ ...form, defaultDepartmentId: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">-- ເລືອກພະແນກ --</option>
                    {departments.map(d => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ຄວາມສຳຄັນເລີ່ມຕົ້ນ</label>
                  <select
                    value={form.defaultPriority}
                    onChange={(e) => setForm({ ...form, defaultPriority: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm capitalize"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ລາຍລະອຽດ</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                {editingId && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    ໃຊ້ງານຢູ່ (ຖ້າປິດ ຈະບໍ່ສະແດງໃນລາຍການສ້າງ Ticket ໃໝ່)
                  </label>
                )}

                {formError && <p className="text-xs text-red-500">{formError}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm">ຍົກເລີກ</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm disabled:opacity-50">
                    {submitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
