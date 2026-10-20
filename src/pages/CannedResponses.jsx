import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Search, Plus, Pencil, Trash2, Copy, Check, X, Loader2, ShieldAlert } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { API_BASE_URL } from '../config';
import { hasPermission } from '../utils/permissions';

const unwrap = (b) => (b && typeof b === 'object' && !Array.isArray(b) && 'data' in b ? b.data : b);
const errMsg = (b, fallback) => (Array.isArray(b?.message) ? b.message.join(', ') : b?.message || fallback);

export default function CannedResponses() {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Authorization': `Bearer ${token}` };

  const canManage = hasPermission('tickets', 'update');
  const isElevated = hasPermission('tickets', 'assign'); // ຜູ້ບໍລິຫານ: ຈັດການໄດ້ທຸກພະແນກ

  const [myDept, setMyDept] = useState({ id: '', name: '' });
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(''); // '' = ທຸກພະແນກ (ສະເພາະຜູ້ບໍລິຫານ)
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [modal, setModal] = useState(null); // { _id?, departmentId, title, body }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [ready, setReady] = useState(false);

  // 1) ພະແນກຂອງຕົນເອງ (+ ລາຍຊື່ພະແນກທັງໝົດຖ້າເປັນຜູ້ບໍລິຫານ)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch(`${API_BASE_URL}/auth/me`, { headers });
        const me = unwrap(await meRes.json().catch(() => ({}))) || {};
        const dept = me.departmentId;
        const id = String(dept?._id ?? dept ?? '');
        if (!cancelled) setMyDept({ id, name: dept?.name || '' });
        if (!isElevated && !cancelled) setSelectedDept(id);

        if (isElevated) {
          const dRes = await fetch(`${API_BASE_URL}/departments`, { headers });
          if (dRes.ok) {
            const list = unwrap(await dRes.json().catch(() => []));
            if (!cancelled && Array.isArray(list)) setDepartments(list);
          }
        }
      } catch {
        if (!cancelled) setError('ໂຫຼດຂໍ້ມູນພະແນກບໍ່ສຳເລັດ');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) ແມ່ແບບຕາມພະແນກທີ່ເລືອກ
  const loadTemplates = async () => {
    if (!isElevated && !selectedDept) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const qs = selectedDept ? `?departmentId=${encodeURIComponent(selectedDept)}` : '';
      const res = await fetch(`${API_BASE_URL}/canned-responses${qs}`, { headers });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errMsg(b, 'ໂຫຼດແມ່ແບບບໍ່ສຳເລັດ'));
      const list = unwrap(b);
      setTemplates(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedDept]);

  const deptName = (id) =>
    departments.find((d) => String(d._id) === String(id))?.name ||
    (String(id) === myDept.id ? myDept.name : '') ||
    id;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => !q || `${t.title} ${t.body}`.toLowerCase().includes(q));
  }, [templates, query]);

  const openCreate = () => {
    setFormError('');
    setModal({
      departmentId: selectedDept || (isElevated ? departments[0]?._id || '' : myDept.id),
      title: '',
      body: '',
    });
  };
  const openEdit = (t) => {
    setFormError('');
    setModal({ _id: t._id, departmentId: t.departmentId, title: t.title, body: t.body });
  };

  const save = async () => {
    if (!modal.departmentId) return setFormError('ກະລຸນາເລືອກພະແນກ');
    if (!modal.title.trim() || !modal.body.trim()) return setFormError('ກະລຸນາໃສ່ຫົວຂໍ້ ແລະ ເນື້ອຫາ');
    setSaving(true);
    setFormError('');
    try {
      const isEdit = !!modal._id;
      const res = await fetch(`${API_BASE_URL}/canned-responses${isEdit ? `/${modal._id}` : ''}`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? { title: modal.title.trim(), body: modal.body.trim() }
            : { departmentId: modal.departmentId, title: modal.title.trim(), body: modal.body.trim() }
        ),
      });
      if (!res.ok) throw new Error(errMsg(await res.json().catch(() => ({})), 'ບັນທຶກບໍ່ສຳເລັດ'));
      setModal(null);
      loadTemplates();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`ລຶບແມ່ແບບ "${t.title}" ແມ່ນບໍ?`)) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/canned-responses/${t._id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(errMsg(await res.json().catch(() => ({})), 'ລຶບບໍ່ສຳເລັດ'));
      loadTemplates();
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async (t) => {
    try {
      await navigator.clipboard.writeText(t.body);
      setCopiedId(t._id);
      setTimeout(() => setCopiedId((id) => (id === t._id ? null : id)), 1500);
    } catch {
      setError('ຄັດລອກບໍ່ສຳເລັດ');
    }
  };

  if (!canManage) {
    return (
      <MainLayout>
        <div className="max-w-sm mx-auto mt-16 text-center bg-white border border-gray-200 rounded-2xl p-8">
          <ShieldAlert className="mx-auto text-red-500 mb-3" size={28} />
          <p className="font-bold text-gray-800">ບໍ່ມີສິດເຂົ້າເຖິງໜ້ານີ້</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <MessageSquare size={24} className="text-amber-500" /> ແມ່ແບບຄຳຕອບ (Canned Responses)
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              ຂໍ້ຄວາມຕອບກັບທີ່ໃຊ້ຊ້ຳໄດ້ — Agent ເລືອກໃຊ້ໃນແຊັດຂອງ Ticket ໄດ້ທັນທີ
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={!isElevated && !myDept.id}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            <Plus size={16} /> ສ້າງແມ່ແບບ
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ຄົ້ນຫາຫົວຂໍ້ ຫຼື ເນື້ອຫາ..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>
          {isElevated ? (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white"
            >
              <option value="">ທຸກພະແນກ</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name} ({d._id})</option>
              ))}
            </select>
          ) : (
            <span className="px-3 py-2 text-sm rounded-xl bg-amber-50 text-amber-800">
              ພະແນກ: {myDept.name || myDept.id || '—'}
            </span>
          )}
          <span className="text-xs text-gray-500 ml-auto">{visible.length} / {templates.length} ລາຍການ</span>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>}

        {!isElevated && ready && !myDept.id ? (
          <div className="bg-white rounded-2xl border border-gray-200 py-12 text-center text-sm text-gray-400">
            ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ຖືກກຳນົດພະແນກ — ກະລຸນາຕິດຕໍ່ຜູ້ບໍລິຫານ
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 py-12 text-center text-gray-400">
            <Loader2 className="animate-spin inline" size={20} />
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 py-12 text-center text-sm text-gray-400">
            {templates.length === 0 ? 'ຍັງບໍ່ມີແມ່ແບບ — ກົດ "ສ້າງແມ່ແບບ" ເພື່ອເພີ່ມ' : 'ບໍ່ພົບແມ່ແບບທີ່ຕົງກັນ'}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visible.map((t) => {
              const expanded = expandedId === t._id;
              return (
                <div key={t._id} className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">{deptName(t.departmentId)}</span>
                        {t.createdAt && <span className="text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center">
                      <button type="button" title="ຄັດລອກ" onClick={() => copy(t)} className="p-1.5 text-gray-400 hover:text-emerald-600">
                        {copiedId === t._id ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                      </button>
                      <button type="button" title="ແກ້ໄຂ" onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600">
                        <Pencil size={15} />
                      </button>
                      <button type="button" title="ລຶບ" onClick={() => remove(t)} className="p-1.5 text-gray-400 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <p className={`text-sm text-gray-600 whitespace-pre-wrap ${expanded ? '' : 'max-h-20 overflow-hidden'}`}>{t.body}</p>
                  {t.body.length > 140 && (
                    <button type="button" onClick={() => setExpandedId(expanded ? null : t._id)} className="self-start text-xs text-blue-600 hover:underline">
                      {expanded ? 'ຫຍໍ້' : 'ເບິ່ງທັງໝົດ'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{modal._id ? 'ແກ້ໄຂແມ່ແບບ' : 'ສ້າງແມ່ແບບໃໝ່'}</h2>
              <button type="button" onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ພະແນກ</label>
              {isElevated && !modal._id ? (
                <select
                  value={modal.departmentId}
                  onChange={(e) => setModal({ ...modal, departmentId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="" disabled>-- ເລືອກພະແນກ --</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name} ({d._id})</option>
                  ))}
                </select>
              ) : (
                <p className="px-3 py-2 text-sm rounded-lg bg-gray-50 text-gray-700">{deptName(modal.departmentId)}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ຫົວຂໍ້</label>
              <input
                type="text"
                value={modal.title}
                onChange={(e) => setModal({ ...modal, title: e.target.value })}
                placeholder="ເຊັ່ນ: ຂັ້ນຕອນ reset VPN"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ເນື້ອຫາຄຳຕອບ</label>
              <textarea
                rows={7}
                value={modal.body}
                onChange={(e) => setModal({ ...modal, body: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {formError && <p className="text-xs text-red-600">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} disabled={saving} className="px-4 py-2 text-sm rounded-xl text-gray-600 hover:bg-gray-100">
                ຍົກເລີກ
              </button>
              <button type="button" onClick={save} disabled={saving} className="px-5 py-2 text-sm font-medium rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
                {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
