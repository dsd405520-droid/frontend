import { useEffect, useMemo, useState } from 'react';
import { Plus, ShoppingCart, X, Search, ScanLine, CheckCircle2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import CameraScanner from '../components/CameraScanner';
import api from '../services/api';
import { hasPermission } from '../utils/permissions';

const unwrap = (body) => (body && body.data !== undefined ? body.data : body);
const today = () => new Date().toISOString().slice(0, 10);
const MODE_LABEL = {
  RESTOCK: { text: 'ເພີ່ມ', cls: 'bg-amber-100 text-amber-700' },
  NEW_ITEM: { text: 'ຊື້', cls: 'bg-emerald-100 text-emerald-700' },
};
const inputCls =
  'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 bg-white';

const errText = (err, fallback) => {
  const m = err.response?.data?.msg ?? err.response?.data?.message;
  if (Array.isArray(m)) return m.join(' · ');
  return m || fallback;
};

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

/** ຟອມຮັບເຄື່ອງ — ໃຊ້ຮ່ວມກັນທັງ "ເພີ່ມ" (RESTOCK) ແລະ "ຊື້" (NEW_ITEM) */
function ReceiveModal({ mode, catalog, onClose, onSaved }) {
  const isNew = mode === 'NEW_ITEM';
  const [catalogItemId, setCatalogItemId] = useState('');
  const [item, setItem] = useState({ name: '', category: '', unit: '', type: 'DEVICE' });
  const [hasSerial, setHasSerial] = useState(false); // ສຳລັບ RESTOCK ຂອງລາຍການເກົ່າທີ່ບໍ່ໄດ້ລະບຸປະເພດ
  const [quantity, setQuantity] = useState(1);
  const [receivedDate, setReceivedDate] = useState(today());
  const [vendor, setVendor] = useState('');
  const [note, setNote] = useState('');
  const [serials, setSerials] = useState([]);
  const [scanIdx, setScanIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = catalog.find((c) => c._id === catalogItemId);
  const isDevice = isNew
    ? item.type === 'DEVICE'
    : selected?.itemType === 'ASSET' || (!!selected && !selected.itemType && hasSerial);
  const qty = Math.max(0, Math.min(1000, parseInt(quantity, 10) || 0));

  const setSerial = (i, v) =>
    setSerials((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isNew && !catalogItemId) return setError('ກະລຸນາເລືອກລາຍການ');
    if (isNew && (!item.name.trim() || !item.category.trim() || !item.unit.trim()))
      return setError('ກະລຸນາໃສ່ຊື່, ໝວດໝູ່ ແລະ ໜ່ວຍນັບ');
    if (!Number.isInteger(Number(quantity)) || qty < 1) return setError('ຈຳນວນຕ້ອງເປັນຈຳນວນເຕັມ ແລະ ຢ່າງໜ້ອຍ 1');
    let serialNumbers;
    if (isDevice) {
      serialNumbers = Array.from({ length: qty }, (_, i) => (serials[i] || '').trim());
      if (serialNumbers.some((s) => !s)) return setError('ກະລຸນາໃສ່ Serial Number ໃຫ້ຄົບທຸກໜ່ວຍ');
      const lower = serialNumbers.map((s) => s.toLowerCase());
      if (new Set(lower).size !== lower.length) return setError('ມີ Serial Number ຊ້ຳກັນໃນລາຍການທີ່ປ້ອນ');
    }
    const common = {
      quantity: qty,
      receivedDate: receivedDate || undefined,
      vendor: vendor.trim() || undefined,
      note: note.trim() || undefined,
      serialNumbers,
    };
    try {
      setSaving(true);
      if (isNew) {
        await api.post('/goods-receipt/new-item', {
          item: { ...item, name: item.name.trim(), category: item.category.trim(), unit: item.unit.trim() },
          ...common,
        });
      } else {
        await api.post('/goods-receipt/restock', { catalogItemId, ...common });
      }
      onSaved(isNew ? 'ບັນທຶກການຊື້ເຄື່ອງເຂົ້າສະຕັອກສຳເລັດ' : 'ເພີ່ມເຄື່ອງເຂົ້າສະຕັອກສຳເລັດ');
    } catch (err) {
      setError(errText(err, 'ບັນທຶກບໍ່ສຳເລັດ'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">
            {isNew ? 'ຊື້ເຄື່ອງເຂົ້າສະຕັອກ (ລາຍການໃໝ່)' : 'ເພີ່ມເຄື່ອງເຂົ້າສະຕັອກ'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">{error}</div>
          )}

          {isNew ? (
            <>
              <Field label="ຊື່ລາຍການ" required>
                <input className={inputCls} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ໝວດໝູ່" required>
                  <input
                    className={inputCls}
                    list="gr-categories"
                    value={item.category}
                    onChange={(e) => setItem({ ...item, category: e.target.value })}
                  />
                  <datalist id="gr-categories">
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
              <Field label="ປະເພດ" required>
                <select className={inputCls} value={item.type} onChange={(e) => setItem({ ...item, type: e.target.value })}>
                  <option value="DEVICE">ອຸປະກອນ (ມີ Serial Number / ຕິດ Asset Tag)</option>
                  <option value="CONSUMABLE">ວັດສະດຸສິ້ນເປືອງ (ນັບຈຳນວນ)</option>
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="ລາຍການ" required>
                <select className={inputCls} value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)}>
                  <option value="">— ເລືອກລາຍການ —</option>
                  {catalog
                    .filter((c) => c.isActive !== false)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c._id} — {c.name} (ສະຕັອກ {c.stockQty ?? 0})
                      </option>
                    ))}
                </select>
              </Field>
              {selected && !selected.itemType && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={hasSerial} onChange={(e) => setHasSerial(e.target.checked)} />
                  ລາຍການນີ້ເປັນອຸປະກອນທີ່ມີ Serial Number
                </label>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="ຈຳນວນ (ຊິ້ນ)" required>
              <input
                type="number"
                min="1"
                max="1000"
                className={inputCls}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="ວັນທີຮັບ">
              <input type="date" className={inputCls} value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
            </Field>
          </div>
          <Field label="ຜູ້ຂາຍ / ຜູ້ສະໜອງ">
            <input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </Field>
          <Field label="ໝາຍເຫດ">
            <textarea rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {isDevice && qty > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">
                Serial Number ({qty} ໜ່ວຍ) <span className="text-red-500">*</span>
              </p>
              {Array.from({ length: qty }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-8 text-xs text-gray-400 text-right">{i + 1}.</span>
                  <input
                    className={inputCls}
                    placeholder="ພິມ ຫຼື ສະແກນ S/N"
                    value={serials[i] || ''}
                    onChange={(e) => setSerial(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const next = e.target.closest('div')?.nextElementSibling?.querySelector('input');
                        next?.focus();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setScanIdx(i)}
                    title="ສະແກນ"
                    className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50"
                  >
                    <ScanLine size={16} />
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-400">ລະບົບຈະສ້າງຊັບສິນ + Asset Tag + QR ໃຫ້ຕໍ່ແຕ່ລະໜ່ວຍ ແລະ ເກັບເຂົ້າຄັງ</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
            ຍົກເລີກ
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 text-white rounded-xl text-sm font-medium shadow-sm disabled:opacity-50 ${
              isNew ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
          </button>
        </div>
      </form>

      {scanIdx !== null && (
        <CameraScanner
          title="ສະແກນ Serial Number"
          onScan={(text) => {
            setSerial(scanIdx, String(text).trim());
            setScanIdx(null);
          }}
          onClose={() => setScanIdx(null)}
        />
      )}
    </div>
  );
}

export default function GoodsReceipt() {
  const canManage = hasPermission('supplies', 'manage');
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [modal, setModal] = useState(null); // 'RESTOCK' | 'NEW_ITEM' | null
  const [success, setSuccess] = useState('');

  const fetchRows = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = {};
      if (search.trim()) params.q = search.trim();
      if (modeFilter) params.mode = modeFilter;
      const res = await api.get('/goods-receipt', { params });
      const list = unwrap(res.data);
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      setLoadError(errText(err, 'ບໍ່ສາມາດໂຫຼດປະຫວັດການຮັບເຄື່ອງໄດ້'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await api.get('/supply-catalog');
      const list = unwrap(res.data);
      setCatalog(Array.isArray(list) ? list : []);
    } catch {
      setCatalog([]);
    }
  };

  useEffect(() => {
    if (!canManage) return undefined;
    const t = setTimeout(fetchRows, 250); // debounce ການຄົ້ນຫາ
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, modeFilter, canManage]);

  useEffect(() => {
    if (canManage) fetchCatalog();
  }, [canManage]);

  const handleSaved = (msg) => {
    setModal(null);
    setSuccess(msg);
    fetchRows();
    fetchCatalog();
    setTimeout(() => setSuccess(''), 5000);
  };

  const personName = (u) =>
    u && typeof u === 'object'
      ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.employeeCode || '—'
      : '—';

  const total = useMemo(() => rows.reduce((s, r) => s + (r.quantity || 0), 0), [rows]);

  if (!canManage) {
    return (
      <MainLayout>
        <div className="p-8 text-center text-sm text-gray-500">ທ່ານບໍ່ມີສິດເຂົ້າເຖິງໜ້ານີ້ (ຕ້ອງມີສິດ supplies:manage)</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຮັບເຄື່ອງເຂົ້າຄັງ</h1>
            <p className="text-sm text-gray-500">ບັນທຶກເຄື່ອງທີ່ຊື້/ຮັບເຂົ້າສະຕັອກ — ຄຳຂໍເບີກເຄື່ອງໃຊ້ຂັ້ນຕອນເດີມ</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal('RESTOCK')}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm"
            >
              <Plus size={18} /> <span>ເພີ່ມເຄື່ອງເຂົ້າສະຕັອກ</span>
            </button>
            <button
              onClick={() => setModal('NEW_ITEM')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm"
            >
              <ShoppingCart size={18} /> <span>ຊື້ເຄື່ອງເຂົ້າສະຕັອກ</span>
            </button>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full self-start">
              {rows.length} ຄັ້ງ · ລວມ {total} ຊິ້ນ
            </span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ຄົ້ນຫາ ລາຍການ / ຜູ້ຂາຍ / S/N..."
                  className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 w-full sm:w-64"
                />
              </div>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">ທັງໝົດ</option>
                <option value="RESTOCK">ເພີ່ມ</option>
                <option value="NEW_ITEM">ຊື້</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                  <th className="p-4 font-medium">ວັນທີ</th>
                  <th className="p-4 font-medium">ລາຍການ</th>
                  <th className="p-4 font-medium">ຈຳນວນ</th>
                  <th className="p-4 font-medium">ປະເພດ</th>
                  <th className="p-4 font-medium">ບັນທຶກໂດຍ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {loading ? (
                  <tr><td colSpan="5" className="py-12 text-center text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan="5" className="py-12 text-center text-red-500 px-4">⚠️ {loadError}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="5" className="py-12 text-center text-gray-400">ຍັງບໍ່ມີປະຫວັດການຮັບເຄື່ອງ</td></tr>
                ) : (
                  rows.map((r) => {
                    const m = MODE_LABEL[r.mode] || MODE_LABEL.RESTOCK;
                    return (
                      <tr key={r._id} className="hover:bg-gray-50">
                        <td className="p-4">{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString() : '—'}</td>
                        <td className="p-4">
                          <div className="font-medium text-gray-800">{r.itemName}</div>
                          <div className="text-xs text-gray-400">
                            {r.catalogItemId}
                            {r.vendor ? ` · ${r.vendor}` : ''}
                            {r.serialNumbers?.length ? ` · S/N: ${r.serialNumbers.slice(0, 3).join(', ')}${r.serialNumbers.length > 3 ? '…' : ''}` : ''}
                          </div>
                        </td>
                        <td className="p-4">{r.quantity}{r.unit ? ` ${r.unit}` : ''}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.cls}`}>{m.text}</span>
                        </td>
                        <td className="p-4">{personName(r.createdBy)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && <ReceiveModal mode={modal} catalog={catalog} onClose={() => setModal(null)} onSaved={handleSaved} />}
    </MainLayout>
  );
}
