import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

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

export default function PurchaseRequestModal({ catalog, onClose, onSaved, initialCatalogItemId = '', initialQuantity = 1, initialReason = '' }) {
  const [mode, setMode] = useState('RESTOCK');
  const [catalogItemId, setCatalogItemId] = useState(initialCatalogItemId);
  const [item, setItem] = useState({ name: '', category: '', unit: '', type: 'DEVICE_SERIAL' });
  const [quantity, setQuantity] = useState(initialQuantity);
  const [unitPrice, setUnitPrice] = useState('');
  const [vendor, setVendor] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [reason, setReason] = useState(initialReason);
  const [suggestion, setSuggestion] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const qty = parseInt(quantity, 10) || 0;
  const price = unitPrice === '' ? null : Number(unitPrice);
  const total = price !== null && Number.isFinite(price) ? price * qty : null;
  const activeCatalog = useMemo(() => catalog.filter((c) => c.isActive !== false), [catalog]);

  useEffect(() => {
    if (mode !== 'RESTOCK' || !catalogItemId) {
      setSuggestion(null);
      return undefined;
    }
    let cancelled = false;
    setSuggesting(true);
    api
      .get('/purchase-requests/price-suggestion', { params: { catalogItemId } })
      .then((res) => {
        if (cancelled) return;
        const body = res.data && res.data.data !== undefined ? res.data.data : res.data;
        setSuggestion(body && body.found ? body : null);
      })
      .catch(() => {
        if (!cancelled) setSuggestion(null);
      })
      .finally(() => {
        if (!cancelled) setSuggesting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, catalogItemId]);

  const applySuggestion = () => {
    if (!suggestion) return;
    setUnitPrice(String(suggestion.unitPrice));
    setVendor(suggestion.vendor || '');
  };

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
      const res = await api.post('/purchase-requests', {
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
      const body = res?.data;
      onSaved(body && body.data !== undefined ? body.data : body);
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
              {catalogItemId && suggesting && <p className="text-xs text-gray-400 mt-1">ກຳລັງຊອກຫາລາຄາທີ່ເຄີຍຊື້...</p>}
              {catalogItemId && !suggesting && suggestion && (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-700">
                    ລາຄາຕ່ຳສຸດທີ່ເຄີຍຊື້: <b>{Number(suggestion.unitPrice).toLocaleString()}</b>
                    {suggestion.vendor ? ` · ${suggestion.vendor}` : ''}
                    {suggestion.date ? ` (${new Date(suggestion.date).toLocaleDateString()})` : ''}
                    {suggestion.refNo ? ` · ${suggestion.refNo}` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    ໃຊ້ຂໍ້ມູນນີ້
                  </button>
                </div>
              )}
              {catalogItemId && !suggesting && !suggestion && (
                <p className="text-xs text-gray-400 mt-1">ຍັງບໍ່ມີປະຫວັດລາຄາຂອງລາຍການນີ້</p>
              )}
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
