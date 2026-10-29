import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import api from '../services/api';
import AssetTagVisual from './AssetTagVisual';

const unwrap = (res) => {
  const body = res?.data;
  return body?.data !== undefined ? body.data : body;
};
const asList = (v) => (Array.isArray(v) ? v : []);
const refId = (v) => (v && typeof v === 'object' ? v._id : v);
const userDeptId = (u) => u?.departmentId?._id || u?.departmentId?.id || u?.departmentId || '';

const publicBaseUrl = (import.meta.env.VITE_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const claimBaseUrl = publicBaseUrl || window.location.origin;
const isLocalOrigin = !publicBaseUrl && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const isIpOrigin = !publicBaseUrl && /^\d{1,3}(\.\d{1,3}){3}$/.test(window.location.hostname);

export function AssignAssetModal({ asset, onClose, onDone }) {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [mode, setMode] = useState('PERSON');
  const [deptId, setDeptId] = useState('');
  const [userId, setUserId] = useState('');
  const [custodianId, setCustodianId] = useState('');
  const [note, setNote] = useState('');
  const [proxyOn, setProxyOn] = useState(false);
  const [proxyCode, setProxyCode] = useState('');
  const [proxyLookup, setProxyLookup] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users').then((r) => setUsers(asList(unwrap(r)))).catch(() => setUsers([]));
    api.get('/departments').then((r) => setDepartments(asList(unwrap(r)))).catch(() => setDepartments([]));
  }, []);

  const deptName = (id) => {
    if (id && typeof id === 'object' && id.name) return id.name;
    const rid = refId(id);
    return departments.find((d) => d._id === rid)?.name || rid || '—';
  };

  const custodianCandidates = (id) => {
    const dept = departments.find((d) => d._id === id);
    const managers = (dept?.managerIds || []).map(refId);
    return users.filter((u) => u.isActive !== false && (userDeptId(u) === id || managers.includes(u._id)));
  };

  useEffect(() => {
    if (!proxyOn) return undefined;
    const code = proxyCode.trim();
    if (!code) {
      setProxyLookup(null);
      return undefined;
    }
    const t = setTimeout(() => {
      api.get(`/users/lookup/${encodeURIComponent(code)}`)
        .then((res) => {
          const u = unwrap(res);
          if (!u) return setProxyLookup({ ok: false, msg: 'ບໍ່ພົບລະຫັດພະນັກງານນີ້' });
          if (u.isActive === false) return setProxyLookup({ ok: false, msg: 'ບັນຊີນີ້ຖືກປິດໃຊ້ງານແລ້ວ' });
          const dept = departments.find((d) => d._id === deptId);
          const managers = (dept?.managerIds || []).map(refId);
          if (userDeptId(u) !== deptId && !managers.includes(u._id)) {
            return setProxyLookup({ ok: false, msg: 'ຜູ້ຮັບແທນຕ້ອງເປັນຄົນໃນພະແນກທີ່ເລືອກ' });
          }
          if (u._id === custodianId) return setProxyLookup({ ok: false, msg: 'ຜູ້ຮັບແທນຄືຜູ້ຮັບຜິດຊອບແລ້ວ — ບໍ່ຕ້ອງຕິກ "ຮັບແທນ"' });
          return setProxyLookup({ ok: true, user: u });
        })
        .catch(() => setProxyLookup({ ok: false, msg: 'ກວດລະຫັດບໍ່ສຳເລັດ' }));
    }, 400);
    return () => clearTimeout(t);
  }, [proxyOn, proxyCode, deptId, custodianId, departments]);

  const submit = async (e) => {
    e.preventDefault();
    const toDept = mode === 'DEPARTMENT';
    if (toDept) {
      if (!deptId) return setError('ກະລຸນາເລືອກພະແນກ');
      if (!custodianId) return setError('ກະລຸນາເລືອກຜູ້ຮັບຜິດຊອບ');
      if (proxyOn && !(proxyLookup?.ok && proxyLookup.user)) return setError('ກະລຸນາໃສ່ລະຫັດຜູ້ຮັບແທນໃຫ້ຖືກຕ້ອງ');
    } else if (!userId) {
      return setError('ກະລຸນາເລືອກພະນັກງານ');
    }
    setSubmitting(true);
    setError('');
    try {
      const body = toDept
        ? { departmentId: deptId, custodianId, receivedById: proxyOn ? proxyLookup.user._id : undefined, note: note || undefined }
        : { assigneeId: userId, note: note || undefined };
      await api.patch(`/assets/${asset._id}/${toDept ? 'assign-department' : 'assign'}`, body);
      onDone();
    } catch (err) {
      const m = err.response?.data?.msg ?? err.response?.data?.message;
      setError((Array.isArray(m) ? m.join(' · ') : m) || 'ບໍ່ສາມາດມອບໝາຍໄດ້');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">ມອບໝາຍ {asset.assetTag}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode('PERSON')} className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border ${mode === 'PERSON' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-gray-200 text-gray-500'}`}>ມອບໃຫ້ບຸກຄົນ</button>
          <button type="button" onClick={() => setMode('DEPARTMENT')} className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border ${mode === 'DEPARTMENT' ? 'bg-violet-50 border-violet-400 text-violet-700' : 'border-gray-200 text-gray-500'}`}>ມອບໃຫ້ພະແນກ</button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">ພະແນກ{mode === 'DEPARTMENT' && <span className="text-red-500"> *</span>}</label>
          <select value={deptId} onChange={(e) => { setDeptId(e.target.value); setUserId(''); setCustodianId(''); setProxyLookup(null); }} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
            <option value="">-- ເລືອກພະແນກ --</option>
            {departments.filter((d) => d.isActive !== false).map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </div>
        {mode === 'PERSON' ? (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ພະນັກງານ</label>
            <select required value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
              <option value="">-- ເລືອກພະນັກງານ --</option>
              {users.filter((u) => u.isActive && (!deptId || userDeptId(u) === deptId)).map((u) => (
                <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.employeeCode})</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ຜູ້ຮັບຜິດຊອບ (ຫົວໜ້າ ຫຼື ຜູ້ທີ່ພະແນກມອບໝາຍ) <span className="text-red-500">*</span></label>
              <select value={custodianId} onChange={(e) => { setCustodianId(e.target.value); setProxyLookup(null); }} disabled={!deptId} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm disabled:bg-gray-50">
                <option value="">{deptId ? '-- ເລືອກຜູ້ຮັບຜິດຊອບ --' : 'ເລືອກພະແນກກ່ອນ'}</option>
                {custodianCandidates(deptId).map((u) => (
                  <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.employeeCode})</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={proxyOn} onChange={(e) => { setProxyOn(e.target.checked); setProxyCode(''); setProxyLookup(null); }} />
              ມີຜູ້ມາຮັບແທນ (ຜູ້ຮັບຜິດຊອບບໍ່ຢູ່)
            </label>
            {proxyOn && (
              <div className="space-y-1">
                <input type="text" value={proxyCode} onChange={(e) => setProxyCode(e.target.value)} placeholder="ລະຫັດພະນັກງານຂອງຜູ້ມາຮັບແທນ" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                {proxyLookup?.ok && proxyLookup.user && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    ✓ {proxyLookup.user.firstName} {proxyLookup.user.lastName} · {deptName(proxyLookup.user.departmentId)}
                  </div>
                )}
                {proxyLookup && !proxyLookup.ok && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{proxyLookup.msg}</div>
                )}
                <p className="text-[11px] text-gray-400">ຜູ້ຮັບຜິດຊອບເຄື່ອງຍັງຄືເດີມ ຜູ້ຮັບແທນຖືກບັນທຶກໃນປະຫວັດເທົ່ານັ້ນ</p>
              </div>
            )}
          </>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">ໝາຍເຫດ (ບໍ່ບັງຄັບ)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">ຍົກເລີກ</button>
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {submitting ? 'ກຳລັງບັນທຶກ...' : 'ມອບໝາຍ'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AssetBarcodeModal({ asset, holderLabel, onClose }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Barcode & QR</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <AssetTagVisual asset={asset} claimBaseUrl={claimBaseUrl} showOriginWarning isLocalOrigin={isLocalOrigin} isIpOrigin={isIpOrigin} />
        {holderLabel && (
          <div className="border-t border-gray-100 pt-3 text-left space-y-1">
            <div className="text-xs font-semibold text-gray-600">ຜູ້ຖືຢູ່ປັດຈຸບັນ</div>
            <div className="text-sm font-medium text-gray-800">{holderLabel}</div>
          </div>
        )}
        <div className="pt-2 space-y-2">
          <button type="button" onClick={() => navigate(`/assets/${asset._id}`)} className="w-full px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition">
            ເປີດໜ້າລາຍລະອຽດ
          </button>
          <button type="button" onClick={() => navigate(`/assets/${asset._id}?claim=1`)} className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition">
            ຮັບເຄື່ອງ / ຢືນຢັນ
          </button>
        </div>
      </div>
    </div>
  );
}

export function AssignmentHistoryModal({ asset, nameOfUser, onClose }) {
  const list = [...(asset.assignmentHistory || [])].reverse();
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">ປະຫວັດການມອບໝາຍ — {asset.assetTag}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">ຍັງບໍ່ເຄີຍຖືກມອບໝາຍ</p>
        ) : (
          <div className="space-y-2">
            {list.map((h, i) => (
              <div key={h._id || i} className="border border-gray-100 rounded-xl p-3 text-sm">
                <div className="font-medium text-gray-800">{nameOfUser(h.assigneeId)}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {h.assignedAt ? new Date(h.assignedAt).toLocaleString() : '—'} —{' '}
                  {h.returnedAt ? new Date(h.returnedAt).toLocaleString() : <span className="text-blue-600 font-medium">ຍັງຖືຢູ່</span>}
                </div>
                {h.note && <div className="text-xs text-gray-500 mt-1 italic">"{h.note}"</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
