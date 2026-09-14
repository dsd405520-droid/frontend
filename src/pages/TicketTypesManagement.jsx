import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Plus, X, Loader2, AlertCircle, Pencil, Trash2, Clock, ArrowRight, Search, Filter } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const EMPTY_FORM = {
  name: '',
  defaultDepartmentId: '',
  defaultPriority: 'medium',
  description: '',
  isActive: true,
};

const EMPTY_SLA_ROW = { priority: 'low', responseTimeMinutes: 30, resolutionTimeMinutes: 240 };

export default function TicketTypesManagement() {
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slaRows, setSlaRows] = useState([]); // each row = one SLA policy to create alongside this ticket type
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const addSlaRow = () => {
    const usedPriorities = slaRows.map(r => r.priority);
    const nextPriority = PRIORITIES.find(p => !usedPriorities.includes(p)) || PRIORITIES[0];
    setSlaRows([...slaRows, { ...EMPTY_SLA_ROW, priority: nextPriority }]);
  };

  const removeSlaRow = (index) => {
    setSlaRows(slaRows.filter((_, i) => i !== index));
  };

  const updateSlaRow = (index, field, value) => {
    setSlaRows(slaRows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const [deletingId, setDeletingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const STATUS_OPTIONS = [
    { key: 'enabled', label: 'ເປີດໃຊ້ງານ' },
    { key: 'disabled', label: 'ປິດໃຊ້ງານ' },
  ];
  const PRIORITY_LEVELS = [
    { key: 'low', label: 'ຕ່ຳ' },
    { key: 'medium', label: 'ປານກາງ' },
    { key: 'high', label: 'ສູງ' },
    { key: 'urgent', label: 'ດ່ວນ' },
  ];
  const SORT_OPTIONS = [
    { key: 'date', label: 'ວັນທີສ້າງ' },
    { key: 'priority_asc', label: 'ຄວາມສຳຄັນ: ຕ່ຳ → ດ່ວນ' },
    { key: 'priority_desc', label: 'ຄວາມສຳຄັນ: ດ່ວນ → ຕ່ຳ' },
  ];
  const PRIORITY_ORDER = { low: 0, medium: 1, high: 2, urgent: 3 };

  const [statusFilter, setStatusFilter] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const [sortBy, setSortBy] = useState('date');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef(null);

  const toggleStatusFilter = (key) => {
    setStatusFilter(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };
  const togglePriorityFilter = (key) => {
    setPriorityFilter(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };
  const toggleDepartmentFilter = (id) => {
    setDepartmentFilter(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const [selectedType, setSelectedType] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [relatedSlas, setRelatedSlas] = useState([]);
  const [loadingSlas, setLoadingSlas] = useState(false);

  const openDetailModal = (t) => {
    setSelectedType(t);
    setIsDetailModalOpen(true);
    setRelatedSlas([]);
    setLoadingSlas(true);
    fetch('http://localhost:3000/api/sla-policies', { headers })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(body => {
        const all = extractArray(body);
        setRelatedSlas(all.filter(s => s.ticketTypeId === (t._id || t.id)));
      })
      .catch(() => setRelatedSlas([]))
      .finally(() => setLoadingSlas(false));
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedType(null);
    setRelatedSlas([]);
  };

  const goToSlaPage = () => {
    const id = selectedType?._id || selectedType?.id;
    navigate(`/sla-management?ticketTypeId=${id}`);
  };

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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const departmentName = (id) => departments.find(d => d._id === id)?.name || id || '-';

  const filteredTypes = types.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      t.name?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      departmentName(t.defaultDepartmentId)?.toLowerCase().includes(q) ||
      t.defaultPriority?.toLowerCase().includes(q);

    const isEnabled = t.isActive !== false;
    const matchesStatus = statusFilter.length === 0 ||
      (statusFilter.includes('enabled') && isEnabled) ||
      (statusFilter.includes('disabled') && !isEnabled);

    const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(t.defaultPriority);

    const matchesDepartment = departmentFilter.length === 0 || departmentFilter.includes(t.defaultDepartmentId);

    return matchesSearch && matchesStatus && matchesPriority && matchesDepartment;
  });

  const sortedTypes = [...filteredTypes].sort((a, b) => {
    if (sortBy === 'priority_asc') {
      return (PRIORITY_ORDER[a.defaultPriority] ?? 0) - (PRIORITY_ORDER[b.defaultPriority] ?? 0);
    }
    if (sortBy === 'priority_desc') {
      return (PRIORITY_ORDER[b.defaultPriority] ?? 0) - (PRIORITY_ORDER[a.defaultPriority] ?? 0);
    }
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlaRows([]);
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
    setSlaRows([]);
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

      // ສ້າງ SLA ໄປພ້ອມກັນ — ໃຊ້ໄດ້ສະເພາະຕອນສ້າງໃໝ່ (ບໍ່ແມ່ນຕອນແກ້ໄຂ)
      if (!editingId && slaRows.length > 0) {
        const body = await res.json().catch(() => ({}));
        const newTypeId = body?.data?._id || body?._id;

        if (newTypeId) {
          const slaResults = await Promise.all(
            slaRows.map((row) =>
              fetch('http://localhost:3000/api/sla-policies', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: `${form.name} - ${row.priority} SLA`,
                  ticketTypeId: newTypeId,
                  priority: row.priority,
                  responseTimeMinutes: row.responseTimeMinutes,
                  resolutionTimeMinutes: row.resolutionTimeMinutes,
                  isActive: true,
                }),
              })
            )
          );

          const failedCount = slaResults.filter((r) => !r.ok).length;
          if (failedCount > 0) {
            alert(`ສ້າງປະເພດບັນຫາສຳເລັດ, ແຕ່ສ້າງ SLA ບໍ່ສຳເລັດ ${failedCount} ລາຍການ`);
          }
        }
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

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່ປະເພດ, ພະແນກ, ຄວາມສຳຄັນ..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 transition"
              >
                <Filter size={16} />
                <span>FILTER</span>
                {(statusFilter.length + priorityFilter.length + departmentFilter.length) > 0 && (
                  <span key={statusFilter.length + priorityFilter.length + departmentFilter.length}>
                    {` (${statusFilter.length + priorityFilter.length + departmentFilter.length})`}
                  </span>
                )}
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-[34rem] bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-1 px-1">ສະຖານະ</p>
                      {STATUS_OPTIONS.map(opt => (
                        <label key={opt.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                          <input type="checkbox" checked={statusFilter.includes(opt.key)} onChange={() => toggleStatusFilter(opt.key)} className="rounded" />
                          {opt.label}
                        </label>
                      ))}
                    </div>

                    <div className="border-l border-gray-100 pl-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-1 px-1">ຄວາມສຳຄັນ</p>
                      {PRIORITY_LEVELS.map(level => (
                        <label key={level.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                          <input type="checkbox" checked={priorityFilter.includes(level.key)} onChange={() => togglePriorityFilter(level.key)} className="rounded" />
                          {level.label}
                        </label>
                      ))}
                    </div>

                    <div className="border-l border-gray-100 pl-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-1 px-1">ພະແນກ</p>
                      <div className="max-h-40 overflow-y-auto">
                        {departments.map(d => (
                          <label key={d._id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                            <input type="checkbox" checked={departmentFilter.includes(d._id)} onChange={() => toggleDepartmentFilter(d._id)} className="rounded" />
                            {d.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(statusFilter.length + priorityFilter.length + departmentFilter.length) > 0 && (
                    <button
                      onClick={() => { setStatusFilter([]); setPriorityFilter([]); setDepartmentFilter([]); }}
                      className="w-full text-center text-xs text-amber-600 hover:text-amber-700 mt-3 pt-2 border-t border-gray-100"
                    >
                      ລ້າງການກອງ
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 transition"
              >
                <span>ຈັດຮຽງຕາມ</span>
              </button>

              {isSortOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-2">
                  {SORT_OPTIONS.map(opt => (
                    <label key={opt.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                      <input
                        type="radio"
                        name="typeSortBy"
                        checked={sortBy === opt.key}
                        onChange={() => { setSortBy(opt.key); setIsSortOpen(false); }}
                        className="rounded-full"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
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
              ) : sortedTypes.length > 0 ? (
                sortedTypes.map((t) => (
                  <tr key={t._id} onClick={() => openDetailModal(t)} className="hover:bg-gray-50 cursor-pointer">
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
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
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
                <tr><td colSpan="6" className="py-12 text-center text-sm text-gray-400">
                  {types.length === 0 ? 'ຍັງບໍ່ມີປະເພດບັນຫາ' : 'ບໍ່ພົບຂໍ້ມູນທີ່ຄົ້ນຫາ'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-xl">
              <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
                <h2 className="text-lg font-bold text-gray-800">
                  {editingId ? 'ແກ້ໄຂປະເພດບັນຫາ' : 'ສ້າງປະເພດບັນຫາໃໝ່'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-6 py-4">
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

                {!editingId && (
                  <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">ນະໂຍບາຍ SLA (ບໍ່ບັງຄັບ)</span>
                      <button
                        type="button"
                        onClick={addSlaRow}
                        disabled={slaRows.length >= PRIORITIES.length}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Plus size={14} /> ເພີ່ມລະດັບ SLA
                      </button>
                    </div>

                    {slaRows.length === 0 && (
                      <p className="text-xs text-gray-400">ຍັງບໍ່ໄດ້ເພີ່ມ SLA — ກົດ "ເພີ່ມລະດັບ SLA" ຖ້າຕ້ອງການສ້າງໄປພ້ອມກັນ</p>
                    )}

                    {slaRows.map((row, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
                        <div className="flex items-center justify-between">
                          <select
                            value={row.priority}
                            onChange={(e) => updateSlaRow(index, 'priority', e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs capitalize"
                          >
                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeSlaRow(index)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-gray-500 mb-0.5">ເວລາຕອບກັບ (ນາທີ)</label>
                            <input
                              type="number"
                              min="1"
                              value={row.responseTimeMinutes}
                              onChange={(e) => updateSlaRow(index, 'responseTimeMinutes', Number(e.target.value))}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-500 mb-0.5">ເວລາແກ້ໄຂ (ນາທີ)</label>
                            <input
                              type="number"
                              min="1"
                              value={row.resolutionTimeMinutes}
                              onChange={(e) => updateSlaRow(index, 'resolutionTimeMinutes', Number(e.target.value))}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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

        {isDetailModalOpen && selectedType && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Tag size={16} className="text-gray-400" /> {selectedType.name}
                  </h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedType.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {selectedType.isActive !== false ? 'ໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                  </span>
                </div>
                <button onClick={closeDetailModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              <div className="overflow-y-auto px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">ພະແນກຮັບຜິດຊອບ</div>
                    <div className="text-gray-700">{departmentName(selectedType.defaultDepartmentId)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">ຄວາມສຳຄັນເລີ່ມຕົ້ນ</div>
                    <div className="text-gray-700 capitalize">{selectedType.defaultPriority}</div>
                  </div>
                </div>

                {selectedType.description && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">ລາຍລະອຽດ</div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{selectedType.description}</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                      <Clock size={14} /> ນະໂຍບາຍ SLA ທີ່ເຊື່ອມໂຍງ
                    </span>
                    <button
                      onClick={goToSlaPage}
                      className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      ເບິ່ງ SLA ເພີ່ມເຕີມ <ArrowRight size={14} />
                    </button>
                  </div>

                  {loadingSlas ? (
                    <div className="text-center py-6 text-sm text-gray-400">
                      <Loader2 className="animate-spin mx-auto mb-2" size={18} />
                      ກຳລັງໂຫຼດ SLA...
                    </div>
                  ) : relatedSlas.length > 0 ? (
                    <div className="space-y-2">
                      {relatedSlas.map(sla => (
                        <div key={sla._id} className="border border-gray-200 rounded-xl p-3 flex items-center justify-between text-sm">
                          <div>
                            <div className="font-medium text-gray-800">{sla.name}</div>
                            <div className="text-xs text-gray-500">ຕອບກັບ {sla.responseTimeMinutes} ນາທີ · ແກ້ໄຂ {sla.resolutionTimeMinutes} ນາທີ</div>
                          </div>
                          <span className={`px-2 py-1 rounded-md text-xs font-medium uppercase ${sla.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            sla.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              sla.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                            }`}>
                            {sla.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">ຍັງບໍ່ມີ SLA ສຳລັບປະເພດນີ້</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
