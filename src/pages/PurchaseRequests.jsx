import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, CheckCircle2, ChevronDown, ChevronRight, PackagePlus } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';
import { getCurrentUser, hasPermission } from '../utils/permissions';

const unwrap = (body) => (body && body.data !== undefined ? body.data : body);
const inputCls =
  'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 bg-white';

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

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function RequestModal({ catalog, onClose, onSaved }) {
  const [mode, setMode] = useState('RESTOCK');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [item, setItem] = useState({ name: '', category: '', unit: '', type: 'DEVICE_SERIAL' });
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [vendor, setVendor] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const qty = parseInt(quantity, 10) || 0;
  const price = unitPrice === '' ? null : Number(unitPrice);
  const total = price !== null && Number.isFinite(price) ? price * qty : null;
  const activeCatalog = useMemo(() => catalog.filter((c) => c.isActive !== false), [catalog]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'RESTOCK' && !catalogItemId) return setError('ກະລຸນາເລືອກລາຍການ');
    if (mode === 'NEW_ITEM' && (!item.name.trim() || !item.category.trim() || !item.unit.trim()))
      return setError('ກະລຸນາໃສ່ຊື່, ໝວດໝູ່ ແລະ ໜ່ວຍນັບ');
    if (qty < 1) return setError('ຈຳນວນຕ້ອງຢ່າງໜ້ອຍ 1');
    if (reason.trim().length < 3) return setError('ກະລຸນາໃສ່ເຫດຜົນ / ຄວາມຈຳເປັນ');
    try {
      setSaving(true);
      await api.post('/purchase-requests', {
        mode,
        catalogItemId: mode === 'RESTOCK' ? catalogItemId : undefined,
        item:
          mode === 'NEW_ITEM'
            ? { ...item, name: item.name.trim(), category: item.category.trim(), unit: item.unit.trim() }
            : undefined,
        quantity: qty,
        estimatedUnitPrice: price !== null && Number.isFinite(price) ? price : undefined,
        vendor: vendor.trim() || undefined,
        neededBy: neededBy || undefined,
        reason: reason.trim(),
      });
      onSaved();
    } catch (err) {
      setError(errText(err, 'ສົ່ງໃບສະເໜີບໍ່ສຳເລັດ'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">ສ້າງໃບສະເໜີຊື້</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">{error}</div>}

          <div className="grid grid-cols-2 gap-2">
            {[
              ['RESTOCK', 'ເພີ່ມລາຍການທີ່ມີແລ້ວ'],
              ['NEW_ITEM', 'ລາຍການໃໝ່'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={`px-3 py-2 rounded-xl text-sm border ${
                  mode === k ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'RESTOCK' ? (
            <Field label="ລາຍການ" required>
              <select className={inputCls} value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)}>
                <option value="">— ເລືອກລາຍການ —</option>
                {activeCatalog.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c._id} — {c.name} (ສະຕັອກ {c.stockQty ?? 0})
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field label="ຊື່ລາຍການ" required>
                <input className={inputCls} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ໝວດໝູ່" required>
                  <input
                    className={inputCls}
                    list="pr-categories"
                    value={item.category}
                    onChange={(e) => setItem({ ...item, category: e.target.value })}
                  />
                  <datalist id="pr-categories">
                    {[...new Set(catalog.map((c) => c.category).filter(Boolean))].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label="ໜ່ວຍນັບ" required>
                  <input
                    className={inputCls}
                    placeholder="ເຊັ່ນ ອັນ, ກ່ອງ"
                    value={item.unit}
                    onChange={(e) => setItem({ ...item, unit: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="ວິທີຕິດຕາມ" required>
                <select className={inputCls} value={item.type} onChange={(e) => setItem({ ...item, type: e.target.value })}>
                  <option value="DEVICE_SERIAL">ມີ Serial Number</option>
                  <option value="DEVICE_TAG">ຕິດ Asset Tag (ບໍ່ມີ S/N)</option>
                  <option value="CONSUMABLE">ນັບຈຳນວນ (ສິ້ນເປືອງ)</option>
                </select>
              </Field>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="ຈຳນວນທີ່ຂໍ" required>
              <input type="number" min="1" max="1000" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
            <Field label="ລາຄາຕໍ່ໜ່ວຍ (ປະມານ)">
              <input type="number" min="0" step="any" className={inputCls} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </Field>
          </div>
          {total !== null && (
            <div className="text-xs text-gray-500">ລາຄາລວມປະມານ: <b>{total.toLocaleString()}</b></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="ຮ້ານ / ຜູ້ຂາຍທີ່ແນະນຳ">
              <input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </Field>
            <Field label="ຕ້ອງການພາຍໃນວັນທີ">
              <input type="date" className={inputCls} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </Field>
          </div>
          <Field label="ເຫດຜົນ / ຄວາມຈຳເປັນ" required>
            <textarea rows={3} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
            ຍົກເລີກ
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງໃບສະເໜີ'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PurchaseRequests() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const canCreate = hasPermission('supplies', 'create');
  const canApprove = hasPermission('supplies', 'approve');
  const canReceive = hasPermission('supplies', 'manage');

  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [success, setSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');

  const fetchRows = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = {};
      if (status) params.status = status;
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
  };

  useEffect(() => {
    const t = setTimeout(fetchRows, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

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

  const reject = (id) => {
    const reason = window.prompt('ເຫດຜົນທີ່ປະຕິເສດ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ)');
    if (reason && reason.trim().length >= 3) act(id, 'reject', { reason: reason.trim() }, 'ປະຕິເສດໃບສະເໜີແລ້ວ');
  };

  const isMine = (r) => String(r.requestedBy?._id ?? r.requestedBy) === String(currentUser?._id);

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
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">ທຸກສະຖານະ</option>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.text}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                  <th className="p-4 font-medium">ເລກທີ</th>
                  <th className="p-4 font-medium">ລາຍການ</th>
                  <th className="p-4 font-medium">ຈຳນວນ (ຮັບແລ້ວ/ຂໍ)</th>
                  <th className="p-4 font-medium">ລາຄາປະມານ</th>
                  <th className="p-4 font-medium">ຜູ້ສະເໜີ</th>
                  <th className="p-4 font-medium">ສະຖານະ</th>
                  <th className="p-4 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {loading ? (
                  <tr><td colSpan="7" className="py-12 text-center text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan="7" className="py-12 text-center text-red-500 px-4">⚠️ {loadError}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="7" className="py-12 text-center text-gray-400">ຍັງບໍ່ມີໃບສະເໜີ</td></tr>
                ) : (
                  rows.map((r) => {
                    const st = STATUS[r.status] || STATUS.PENDING;
                    const open = expandedId === r._id;
                    const busy = busyId === r._id;
                    return (
                      <Fragment key={r._id}>
                        <tr onClick={() => setExpandedId(open ? '' : r._id)} className="hover:bg-gray-50 cursor-pointer">
                          <td className="p-4 font-mono text-xs">
                            <span className="inline-flex items-center gap-1">
                              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {r.prNo}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-gray-800">{r.itemName}</div>
                            <div className="text-xs text-gray-400">
                              {r.mode === 'NEW_ITEM' && !r.catalogItemId ? 'ລາຍການໃໝ່' : r.catalogItemId}
                              {r.vendor ? ` · ${r.vendor}` : ''}
                            </div>
                          </td>
                          <td className="p-4">
                            {r.receivedQuantity}/{r.quantity}
                            {r.unit ? ` ${r.unit}` : ''}
                          </td>
                          <td className="p-4">{r.estimatedTotal != null ? Number(r.estimatedTotal).toLocaleString() : '—'}</td>
                          <td className="p-4">{personName(r.requestedBy)}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>{st.text}</span>
                          </td>
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-2 justify-end">
                              {r.status === 'PENDING' && canApprove && (
                                <>
                                  <button
                                    disabled={busy}
                                    onClick={() => act(r._id, 'approve', undefined, 'ອະນຸມັດໃບສະເໜີແລ້ວ')}
                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs disabled:opacity-50"
                                  >
                                    ອະນຸມັດ
                                  </button>
                                  <button
                                    disabled={busy}
                                    onClick={() => reject(r._id)}
                                    className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
                                  >
                                    ປະຕິເສດ
                                  </button>
                                </>
                              )}
                              {r.status === 'PENDING' && isMine(r) && canCreate && (
                                <button
                                  disabled={busy}
                                  onClick={() => window.confirm('ຍົກເລີກໃບສະເໜີນີ້?') && act(r._id, 'cancel', undefined, 'ຍົກເລີກໃບສະເໜີແລ້ວ')}
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
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-gray-50/60">
                            <td colSpan="7" className="px-6 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div className="sm:col-span-2">ເຫດຜົນ: <b>{r.reason}</b></div>
                                <div>ລາຄາ/ໜ່ວຍ (ປະມານ): <b>{r.estimatedUnitPrice != null ? Number(r.estimatedUnitPrice).toLocaleString() : '—'}</b></div>
                                <div>ຕ້ອງການພາຍໃນ: <b>{r.neededBy ? new Date(r.neededBy).toLocaleDateString() : '—'}</b></div>
                                <div>ວັນທີສະເໜີ: <b>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</b></div>
                                {r.approvedBy && (
                                  <div>
                                    {r.status === 'REJECTED' ? 'ປະຕິເສດໂດຍ' : 'ອະນຸມັດໂດຍ'}: <b>{personName(r.approvedBy)}</b>
                                  </div>
                                )}
                                {r.rejectReason && <div className="sm:col-span-2 text-red-600">ເຫດຜົນທີ່ປະຕິເສດ: <b>{r.rejectReason}</b></div>}
                                {r.receiptIds?.length > 0 && <div className="sm:col-span-2">ຮັບເຄື່ອງແລ້ວ {r.receiptIds.length} ຄັ້ງ (ເບິ່ງໃນໜ້າ "ຮັບເຄື່ອງເຂົ້າຄັງ")</div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreate && (
        <RequestModal
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
