import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

const MAX_BATCH = 50;
const parseTags = (s) => [...new Set(String(s || '').split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))];
const unwrap = (body) => (body && body.data !== undefined ? body.data : body);
const errText = (err, fallback) => {
  const m = err?.response?.data?.msg ?? err?.response?.data?.message ?? err?.message;
  return Array.isArray(m) ? m.join(', ') : m || fallback;
};

export default function AddAssetModal({ onClose, onDone }) {
  const rowSeq = useRef(0);
  const newRow = (over = {}) => ({
    id: ++rowSeq.current, catalogSearch: '', catalogItemId: '', name: '', qty: 1,
    assetTag: '', purchaseDate: '', warrantyExpiry: '', showDates: false, ...over,
  });

  const [branches, setBranches] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [rows, setRows] = useState(() => [newRow()]);
  const [branchId, setBranchId] = useState('');
  const [purchase, setPurchase] = useState('');
  const [warranty, setWarranty] = useState('');
  const [done, setDone] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState(() => new Set());

  const assetCatalog = catalog.filter((c) => c.itemType === 'ASSET' && c.isActive !== false);

  useEffect(() => {
    api.get('/branches').then((r) => setBranches(unwrap(r.data) || [])).catch(() => setBranches([]));
    api.get('/supply-catalog').then((r) => setCatalog(unwrap(r.data) || [])).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const updateRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));
  const isBlankRow = (r) => !r.catalogItemId && !(r.name || '').trim() && !(r.assetTag || '').trim();

  const handleRowCatalog = (id, value) => {
    const clean = value.trim().toLowerCase();
    const matched = assetCatalog.find((c) => (c.name || '').toLowerCase() === clean || (c._id || '').toLowerCase() === clean);
    updateRow(id, { catalogSearch: value, catalogItemId: matched ? matched._id : '', ...(matched ? { name: matched.name } : {}) });
  };

  const togglePicked = (cid) => setPickerSelected((prev) => {
    const next = new Set(prev);
    if (next.has(cid)) next.delete(cid); else next.add(cid);
    return next;
  });

  const addPicked = () => {
    setRows((prev) => {
      const have = new Set(prev.map((r) => r.catalogItemId).filter(Boolean));
      const keep = prev.filter((r) => !isBlankRow(r));
      const added = assetCatalog
        .filter((c) => pickerSelected.has(c._id) && !have.has(c._id))
        .map((c) => newRow({ catalogSearch: c.name, catalogItemId: c._id, name: c.name }));
      const merged = [...keep, ...added];
      return merged.length > 0 ? merged : [newRow()];
    });
    setPickerSelected(new Set());
    setPickerOpen(false);
  };

  const activeRows = rows.filter((r) => !isBlankRow(r));
  const total = activeRows.reduce((sum, r) => sum + Math.max(0, Math.floor(Number(r.qty) || 0)), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!branchId) { setError('ກະລຸນາເລືອກສາຂາ'); return; }
    if (activeRows.length === 0) { setError('ກະລຸນາເພີ່ມຢ່າງໜ້ອຍ 1 ລາຍການ'); return; }
    for (let i = 0; i < activeRows.length; i += 1) {
      const r = activeRows[i];
      const qty = Math.floor(Number(r.qty) || 0);
      const label = `ແຖວທີ່ ${i + 1}`;
      if (!(r.name || '').trim()) { setError(`${label}: ກະລຸນາໃສ່ຊື່/ປະເພດ`); return; }
      if (!r.catalogItemId && !(r.assetTag || '').trim()) { setError(`${label}: ເລືອກລາຍການ Catalog (ສ້າງ Tag ອັດຕະໂນມັດ) ຫຼືໃສ່ Asset Tag`); return; }
      if (qty < 1) { setError(`${label}: ຈຳນວນຕ້ອງຢ່າງໜ້ອຍ 1`); return; }
      const tagCount = parseTags(r.assetTag).length;
      if (tagCount > 0 && tagCount !== qty) { setError(`${label}: ໃສ່ Asset Tag ${tagCount} ອັນ ແຕ່ຈຳນວນ ${qty} — ຕ້ອງເທົ່າກັນ`); return; }
    }
    if (total > MAX_BATCH) { setError(`ສ້າງໄດ້ສູງສຸດ ${MAX_BATCH} ຊິ້ນຕໍ່ຄັ້ງ (ຕອນນີ້ ${total})`); return; }

    setSubmitting(true);
    setError('');
    const doneNow = { ...done };
    const summary = [];
    let failed = false;
    for (const r of activeRows) {
      const want = Math.floor(Number(r.qty) || 1);
      let ok = doneNow[r.id] || 0;
      let errMsg = '';
      const tagList = parseTags(r.assetTag);
      while (ok < want) {
        try {
          await api.post('/assets', {
            assetTag: tagList[ok],
            catalogItemId: r.catalogItemId || undefined,
            type: r.name.trim(),
            branchId,
            purchaseDate: r.purchaseDate || purchase || undefined,
            warrantyExpiry: r.warrantyExpiry || warranty || undefined,
          });
          ok += 1;
          doneNow[r.id] = ok;
        } catch (err) {
          errMsg = errText(err, 'ບໍ່ສາມາດເພີ່ມຊັບສິນໄດ້');
          failed = true;
          break;
        }
      }
      summary.push({ name: r.name || r.assetTag, ok, want, errMsg });
      if (failed) break;
    }
    setDone(doneNow);
    setResult(summary);
    if (failed) setError('ມີບາງລາຍການສ້າງບໍ່ສຳເລັດ — ເບິ່ງສະຫຼຸບດ້ານລຸ່ມ, ແກ້ແລ້ວກົດບັນທຶກອີກຄັ້ງ (ສ່ວນທີ່ສ້າງແລ້ວຈະບໍ່ຖືກສ້າງຊ້ຳ)');
    else setFinished(true);
    onDone?.();
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">ເພີ່ມຊັບສິນໃໝ່</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="ປິດ"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ສາຂາ * (ໃຊ້ກັບທຸກແຖວ)</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
              <option value="">-- ເລືອກສາຂາ --</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ວັນທີຊື້ (ທາງເລືອກ)</label>
            <input type="date" value={purchase} onChange={(e) => setPurchase(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ໝົດປະກັນ (ທາງເລືອກ)</label>
            <input type="date" value={warranty} onChange={(e) => setWarranty(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700">ລາຍການຊັບສິນ</div>
          <div className="flex items-center gap-3 text-xs">
            <button type="button" onClick={() => setPickerOpen((v) => !v)} className="text-blue-600 hover:underline">
              {pickerOpen ? 'ປິດການເລືອກຈາກ Catalog' : '☑ ເລືອກຫຼາຍລາຍການຈາກ Catalog'}
            </button>
            <button type="button" onClick={() => setRows((rs) => [...rs, newRow()])} className="text-amber-600 hover:underline">+ ເພີ່ມລາຍການອື່ນ</button>
          </div>
        </div>

        {pickerOpen && (
          <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3 space-y-2">
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່ ຫຼື ລະຫັດ..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            />
            <div className="max-h-48 overflow-y-auto bg-white border border-gray-100 rounded-lg divide-y divide-gray-100">
              {assetCatalog
                .filter((c) => {
                  const q = pickerSearch.trim().toLowerCase();
                  return !q || (c.name || '').toLowerCase().includes(q) || (c._id || '').toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q);
                })
                .map((c) => (
                  <label key={c._id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={pickerSelected.has(c._id)} onChange={() => togglePicked(c._id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800">{c.name} <span className="text-xs text-gray-400">({c._id})</span></div>
                      <div className="text-xs text-gray-500">ສະຕ໊ອກ Catalog (ວ່າງ) {c.stockQty}</div>
                    </div>
                  </label>
                ))}
              {assetCatalog.length === 0 && <div className="px-3 py-3 text-xs text-gray-400">ບໍ່ມີລາຍການ Catalog ປະເພດ ASSET — ສ້າງລາຍການໃໝ່ຜ່ານ "ຊື້ເຄື່ອງເຂົ້າສະຕັອກ" ກ່ອນ</div>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">ເລືອກແລ້ວ {pickerSelected.size} ລາຍການ</span>
              <button type="button" disabled={pickerSelected.size === 0} onClick={addPicked} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-40">ເພີ່ມເຂົ້າລາຍການ</button>
            </div>
          </div>
        )}

        <datalist id="add-asset-catalog-options">
          {assetCatalog.map((c) => (
            <option key={c._id} value={c.name}>{c._id} — {c.category}</option>
          ))}
        </datalist>

        <div className="space-y-3">
          {rows.map((r, idx) => {
            const cat = r.catalogItemId ? catalog.find((c) => c._id === r.catalogItemId) : null;
            const doneN = done[r.id] || 0;
            return (
              <div key={r.id} className="border border-gray-200 bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">ແຖວທີ່ {idx + 1}{doneN > 0 && <span className="ml-2 text-emerald-600">✓ ສ້າງແລ້ວ {doneN}</span>}</span>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(r.id)} className="text-xs text-red-500 hover:underline">ລຶບ</button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">ຄົ້ນຫາ/ເລືອກຈາກ Supply Catalog</label>
                    <input
                      type="text"
                      list="add-asset-catalog-options"
                      value={r.catalogSearch}
                      onChange={(e) => handleRowCatalog(r.id, e.target.value)}
                      placeholder="ພິມຊື່ອຸປະກອນ ຫຼື SC001, SC002..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ຈຳນວນ *</label>
                    <input type="number" min={1} max={MAX_BATCH} value={r.qty} onChange={(e) => updateRow(r.id, { qty: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
                  </div>
                </div>
                {cat ? (
                  <div className="text-xs text-gray-500">
                    ✓ {cat.name} ({cat._id}) — Asset Tag ສ້າງໃຫ້ອັດຕະໂນມັດ · ສະຕ໊ອກ Catalog (ວ່າງ) {cat.stockQty}
                    <span className="block text-gray-400">ຫຼັງສ້າງ ສະຕ໊ອກ Catalog ຈະບວກ +{Math.max(0, Math.floor(Number(r.qty) || 0))} ອັດຕະໂນມັດ</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ຊື່/ປະເພດ *</label>
                      <input type="text" value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} placeholder="Laptop, ຈໍ, ບັດພະນັກງານ..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Asset Tag (ບໍ່ມີ Catalog = ຕ້ອງໃສ່, 1 ແຖວ/ຄອມມາ ຕໍ່ 1 ຊິ້ນ) — {parseTags(r.assetTag).length}/{Math.floor(Number(r.qty) || 0)}</label>
                      <textarea rows={Math.min(5, Math.max(2, Math.floor(Number(r.qty) || 1)))} value={r.assetTag} onChange={(e) => updateRow(r.id, { assetTag: e.target.value })} placeholder={'A-1042\nA-1043'} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-mono" />
                    </div>
                  </div>
                )}
                <div>
                  <button type="button" onClick={() => updateRow(r.id, { showDates: !r.showDates })} className="text-xs text-blue-600 hover:underline">
                    {r.showDates ? 'ໃຊ້ວັນທີຮ່ວມ' : 'ປັບວັນທີຊື້/ປະກັນຂອງແຖວນີ້'}
                  </button>
                  {r.showDates && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <input type="date" value={r.purchaseDate} onChange={(e) => updateRow(r.id, { purchaseDate: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
                      <input type="date" value={r.warrantyExpiry} onChange={(e) => updateRow(r.id, { warrantyExpiry: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-gray-500">ລວມ {total} ຊິ້ນ (ສູງສຸດ {MAX_BATCH} ຕໍ່ຄັ້ງ)</div>

        {result && (
          <div className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 space-y-1">
            {result.map((r, i) => (
              <div key={i} className={r.errMsg ? 'text-red-600' : 'text-emerald-700'}>
                {r.errMsg ? '✕' : '✓'} {r.name}: ສ້າງແລ້ວ {r.ok}/{r.want}{r.errMsg ? ` — ${r.errMsg}` : ''}
              </div>
            ))}
          </div>
        )}
        {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{finished ? 'ປິດ' : 'ຍົກເລີກ'}</button>
          {!finished && (
            <button type="submit" disabled={submitting || total < 1} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {submitting ? 'ກຳລັງບັນທຶກ...' : `ບັນທຶກທັງໝົດ (${total} ຊິ້ນ)`}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
