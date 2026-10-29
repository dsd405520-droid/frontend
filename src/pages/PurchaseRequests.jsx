import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, CheckCircle2, PackagePlus } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';
import { getCurrentUser, hasPermission } from '../utils/permissions';
import PurchaseRequestModal from '../components/PurchaseRequestModal';
import PurchaseRequestDetailModal from '../components/PurchaseRequestDetailModal';

const unwrap = (body) => (body && body.data !== undefined ? body.data : body);
const STATUS = {
  PENDING: { text: 'ລໍອະນຸມັດ', cls: 'bg-amber-100 text-amber-700' },
  APPROVED: { text: 'ອະນຸມັດແລ້ວ (ລໍຮັບເຄື່ອງ)', cls: 'bg-blue-100 text-blue-700' },
  PARTIALLY_RECEIVED: { text: 'ຮັບບາງສ່ວນ', cls: 'bg-violet-100 text-violet-700' },
  RECEIVED: { text: 'ຮັບຄົບແລ້ວ', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { text: 'ປະຕິເສດ', cls: 'bg-red-100 text-red-700' },
  CANCELLED: { text: 'ຍົກເລີກ', cls: 'bg-gray-100 text-gray-500' },
};

const errText = (err, fallback) => {
  const m = err.response?.data?.msg ?? err.response?.data?.message;
  if (Array.isArray(m)) return m.join(' · ');
  return m || fallback;
};

const personName = (u) =>
  u && typeof u === 'object' ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.employeeCode || '—' : '—';

export default function PurchaseRequests() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const canCreate = hasPermission('supplies', 'create');
  const canApprove = hasPermission('supplies', 'approve');
  const canReceive = hasPermission('supplies', 'manage');

  const [tab, setTab] = useState(canApprove ? 'APPROVING' : 'ALL');
  const [pendingCount, setPendingCount] = useState(0);
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [success, setSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');

  const approving = tab === 'APPROVING';

  const fetchPendingCount = async () => {
    try {
      const res = await api.get('/purchase-requests', { params: { status: 'PENDING' } });
      const list = unwrap(res.data);
      setPendingCount(Array.isArray(list) ? list.length : 0);
    } catch {
      setPendingCount(0);
    }
  };

  const fetchRows = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = {};
      if (approving) params.status = 'PENDING';
      else if (status) params.status = status;
      if (search.trim()) params.q = search.trim();
      const res = await api.get('/purchase-requests', { params });
      const list = unwrap(res.data);
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      setLoadError(errText(err, 'ໂຫຼດໃບສະເໜີບໍ່ສຳເລັດ'));
      setRows([]);
    } finally {
      setLoading(false);
    }
    fetchPendingCount();
  };

  useEffect(() => {
    const t = setTimeout(fetchRows, 250);
    return () => clearTimeout(t);
  }, [tab, status, search]);

  useEffect(() => {
    api
      .get('/supply-catalog')
      .then((res) => setCatalog(Array.isArray(unwrap(res.data)) ? unwrap(res.data) : []))
      .catch(() => setCatalog([]));
  }, []);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const act = async (id, action, body, okMsg) => {
    setActionError('');
    try {
      setBusyId(id);
      await api.patch(`/purchase-requests/${id}/${action}`, body);
      flash(okMsg);
      fetchRows();
    } catch (err) {
      setActionError(errText(err, 'ດຳເນີນການບໍ່ສຳເລັດ'));
    } finally {
      setBusyId('');
    }
  };

  // ຄຳຂໍເບີກທີ່ຜູກກັບໃບນີ້ ແລະຍັງລໍອະນຸມັດ (ການອະນຸມັດ/ປະຕິເສດໃບນີ້ມີຜົນກັບຄຳຂໍນັ້ນ)
  const pendingLink = (r) => (r?.linkedSupplyRequest?.status === 'REQUESTED' ? r.linkedSupplyRequest : null);

  const approve = (r) => {
    const l = pendingLink(r);
    if (l) {
      const unit = r.unit ? ` ${r.unit}` : '';
      const ok = window.confirm(
        `ໃບສະເໜີ ${r.prNo} ຜູກກັບຄຳຂໍເບີກ ${l._id} ຂອງ ${personName(l.requestedBy)}\n` +
          `${l.itemName}: ຂໍ ${l.requestedQty}${unit} = ໃຊ້ສະຕັອກ ${Math.max((l.requestedQty || 0) - (l.purchaseQty || 0), 0)} + ຊື້ເພີ່ມ ${l.purchaseQty}\n\n` +
          `ການອະນຸມັດໃບສະເໜີນີ້ ຈະອະນຸມັດຄຳຂໍເບີກ ${l._id} ພ້ອມກັນ. ດຳເນີນການຕໍ່?`,
      );
      if (!ok) return;
      act(r._id, 'approve', { confirmLinkedApproval: true }, `ອະນຸມັດໃບສະເໜີ ແລະຄຳຂໍເບີກ ${l._id} ແລ້ວ — ລໍຂອງເຂົ້າຄັງ`);
      return;
    }
    act(r._id, 'approve', {}, 'ອະນຸມັດໃບສະເໜີແລ້ວ');
  };

  const reject = (r) => {
    const l = pendingLink(r);
    const reason = window.prompt(
      `ເຫດຜົນທີ່ປະຕິເສດ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ)${l ? `\n\nໝາຍເຫດ: ຄຳຂໍເບີກ ${l._id} ທີ່ຜູກຢູ່ຈະຍັງຄ້າງ (ບໍ່ຖືກອະນຸມັດ) — ຜູ້ຂໍຈະໄດ້ຮັບແຈ້ງ` : ''}`,
    );
    if (reason && reason.trim().length >= 3) {
      act(
        r._id,
        'reject',
        { reason: reason.trim() },
        l ? `ປະຕິເສດໃບສະເໜີແລ້ວ — ຄຳຂໍເບີກ ${l._id} ຍັງບໍ່ໄດ້ຮັບການຈັດຫາ (ຄ້າງລໍຖ້າ)` : 'ປະຕິເສດໃບສະເໜີແລ້ວ',
      );
    }
  };

  const isMine = (r) => String(r.requestedBy?._id ?? r.requestedBy) === String(currentUser?._id);

  const renderActions = (r) => {
    const busy = busyId === r._id;
    return (
      <div className="flex flex-wrap gap-2 justify-end">
        {approving && r.status === 'PENDING' && canApprove && (
          <>
            <button
              disabled={busy}
              onClick={() => approve(r)}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs disabled:opacity-50"
            >
              ອະນຸມັດ
            </button>
            <button
              disabled={busy}
              onClick={() => reject(r)}
              className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
            >
              ປະຕິເສດ
            </button>
          </>
        )}
        {r.status === 'PENDING' && isMine(r) && canCreate && (
          <button
            disabled={busy}
            onClick={() =>
              window.confirm(
                pendingLink(r)
                  ? `ຍົກເລີກໃບສະເໜີນີ້? ຄຳຂໍເບີກ ${pendingLink(r)._id} ທີ່ຜູກຢູ່ຈະຍັງຄ້າງ ບໍ່ໄດ້ຮັບການຈັດຫາສ່ວນທີ່ຂາດ`
                  : 'ຍົກເລີກໃບສະເໜີນີ້?',
              ) && act(r._id, 'cancel', undefined, 'ຍົກເລີກໃບສະເໜີແລ້ວ')
            }
            className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            ຍົກເລີກ
          </button>
        )}
        {(r.status === 'APPROVED' || r.status === 'PARTIALLY_RECEIVED') && canReceive && (
          <button
            onClick={() => navigate(`/goods-receipt?pr=${r._id}`)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center gap-1"
          >
            <PackagePlus size={14} /> ຮັບເຄື່ອງ
          </button>
        )}
      </div>
    );
  };

  const detail = rows.find((r) => r._id === detailId);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ໃບສະເໜີຊື້</h1>
            <p className="text-sm text-gray-500">ສະເໜີ → ລໍອະນຸມັດ → ຮັບເຄື່ອງເຂົ້າຄັງຕາມໃບທີ່ອະນຸມັດ</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm self-start"
            >
              <Plus size={18} /> ສ້າງໃບສະເໜີຊື້
            </button>
          )}
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}
        {actionError && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">{actionError}</div>}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex gap-1 px-4 pt-3 border-b border-gray-100">
            {[
              ['APPROVING', 'ລໍອະນຸມັດ'],
              ['ALL', 'ຂໍ້ມູນທັງໝົດ'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTab(k);
                  setDetailId('');
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
                  tab === k ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
                {k === 'APPROVING' && pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full self-start">{rows.length} ໃບ</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ຄົ້ນຫາ ເລກໃບ / ລາຍການ / ຮ້ານ..."
                  className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 w-full sm:w-64"
                />
              </div>
              {!approving && (
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">ທຸກສະຖານະ</option>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.text}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                  <th className="p-4 font-medium">ເລກທີ</th>
                  <th className="p-4 font-medium">ລາຍການ</th>
                  <th className="p-4 font-medium">{approving ? 'ຈຳນວນທີ່ຂໍ' : 'ຈຳນວນ (ຮັບແລ້ວ/ຂໍ)'}</th>
                  <th className="p-4 font-medium">ລາຄາປະມານ</th>
                  <th className="p-4 font-medium">ຜູ້ສະເໜີ</th>
                  {approving ? (
                    <>
                      <th className="p-4 font-medium">ເຫດຜົນ</th>
                      <th className="p-4 font-medium">ຕ້ອງການພາຍໃນ</th>
                    </>
                  ) : (
                    <th className="p-4 font-medium">ສະຖານະ</th>
                  )}
                  <th className="p-4 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {loading ? (
                  <tr><td colSpan={approving ? 8 : 7} className="py-12 text-center text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={approving ? 8 : 7} className="py-12 text-center text-red-500 px-4">⚠️ {loadError}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={approving ? 8 : 7} className="py-12 text-center text-gray-400">{approving ? 'ບໍ່ມີໃບທີ່ລໍອະນຸມັດ' : 'ຍັງບໍ່ມີໃບສະເໜີ'}</td></tr>
                ) : (
                  rows.map((r) => {
                    const st = STATUS[r.status] || STATUS.PENDING;
                    return (
                        <tr key={r._id} onClick={() => setDetailId(r._id)} className="hover:bg-gray-50 cursor-pointer">
                          <td className="p-4 font-mono text-xs">
                            {r.prNo}
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-gray-800">{r.itemName}</div>
                            <div className="text-xs text-gray-400">
                              {r.mode === 'NEW_ITEM' && !r.catalogItemId ? 'ລາຍການໃໝ່' : r.catalogItemId}
                              {r.vendor ? ` · ${r.vendor}` : ''}
                            </div>
                            {r.linkedSupplyRequest && (
                              <div className="text-[11px] text-violet-600 mt-0.5">
                                ຜູກກັບຄຳຂໍເບີກ {r.linkedSupplyRequest._id} · {personName(r.linkedSupplyRequest.requestedBy)}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            {approving ? r.quantity : `${r.receivedQuantity}/${r.quantity}`}
                            {r.unit ? ` ${r.unit}` : ''}
                          </td>
                          <td className="p-4">{r.estimatedTotal != null ? Number(r.estimatedTotal).toLocaleString() : '—'}</td>
                          <td className="p-4">{personName(r.requestedBy)}</td>
                          {approving ? (
                            <>
                              <td className="p-4 max-w-xs">
                                <div className="line-clamp-2">{r.reason}</div>
                              </td>
                              <td className="p-4">{r.neededBy ? new Date(r.neededBy).toLocaleDateString() : '—'}</td>
                            </>
                          ) : (
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>{st.text}</span>
                            </td>
                          )}
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            {renderActions(r)}
                          </td>
                        </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detail && (
        <PurchaseRequestDetailModal
          request={detail}
          statusInfo={STATUS[detail.status] || STATUS.PENDING}
          actions={renderActions(detail)}
          onClose={() => setDetailId('')}
        />
      )}

      {showCreate && (
        <PurchaseRequestModal
          catalog={catalog}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            flash('ສົ່ງໃບສະເໜີຊື້ສຳເລັດ — ລໍອະນຸມັດ');
            fetchRows();
          }}
        />
      )}
    </MainLayout>
  );
}
