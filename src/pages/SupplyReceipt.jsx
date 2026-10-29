import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, ScanLine, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import MainLayout from '../layouts/MainLayout';
import CameraScanner from '../components/CameraScanner';
import axios from '../services/api';
import { getCurrentUser } from '../utils/permissions';

const unwrap = (body) => (body && body.data !== undefined ? body.data : body);

const STATUS_LABEL = {
  REQUESTED: { text: 'ລໍຖ້າອະນຸມັດ', className: 'bg-amber-50 text-amber-600 border-amber-200' },
  APPROVED: { text: 'ອະນຸມັດແລ້ວ — ລໍຖ້າຮັບເຄື່ອງ', className: 'bg-blue-50 text-blue-600 border-blue-200' },
  FULFILLED: { text: 'ຮັບເຄື່ອງແລ້ວ', className: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  CLOSED: { text: 'ຮັບເຄື່ອງແລ້ວ', className: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  REJECTED: { text: 'ຖືກປະຕິເສດ', className: 'bg-rose-50 text-rose-600 border-rose-200' },
};

// ໃບຮັບເຄື່ອງ 1 ໃບ ຕໍ່ 1 ໃບຂໍ — QR ຂອງໜ້ານີ້ = ເລກໃບຂໍ. ຜູ້ຂໍສະແກນ (login ຢູ່ແລ້ວ) ແລ້ວຢືນຢັນຮັບທຸກລາຍການໃນຄັ້ງດຽວ
export default function SupplyReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = getCurrentUser();

  const publicBaseUrl = (import.meta.env.VITE_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const baseUrl = publicBaseUrl || window.location.origin;
  const isLocalOrigin = !publicBaseUrl && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const receiptUrl = `${baseUrl}/supplies/receipt/${id}`;

  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [tags, setTags] = useState([]); // asset tag ຫຼື _id ທີ່ສະແກນ/ພິມ
  const [tagInput, setTagInput] = useState('');
  const [confirmConsumables, setConfirmConsumables] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [delegateInput, setDelegateInput] = useState('');
  const [delegateSaving, setDelegateSaving] = useState(false);
  const [delegateError, setDelegateError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await axios.get(`/supply-requests/${id}/receipt`);
      setReceipt(unwrap(res.data));
    } catch (err) {
      setReceipt(null);
      setLoadError(err.response?.data?.msg || 'ບໍ່ພົບໃບຂໍນີ້ ຫຼື ທ່ານບໍ່ມີສິດເບິ່ງ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const items = receipt?.items || [];
  const taggedItems = items.filter((i) => i.requiresAssetTag);
  const consumableItems = items.filter((i) => !i.requiresAssetTag);
  const requiredTagCount = taggedItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

  const requester = receipt?.requestedBy && typeof receipt.requestedBy === 'object' ? receipt.requestedBy : null;
  const requesterName = requester
    ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || requester.employeeCode || '—'
    : '—';
  const department = receipt?.departmentId && typeof receipt.departmentId === 'object' ? receipt.departmentId : null;
  const custodian = receipt?.custodianId && typeof receipt.custodianId === 'object' ? receipt.custodianId : null;
  const custodianName = custodian
    ? `${custodian.firstName || ''} ${custodian.lastName || ''}`.trim() || custodian.employeeCode || '—'
    : '—';
  const delegate = receipt?.delegateId && typeof receipt.delegateId === 'object' ? receipt.delegateId : null;
  const delegateName = delegate
    ? `${delegate.firstName || ''} ${delegate.lastName || ''}`.trim() || delegate.employeeCode || '—'
    : '';
  const isDepartmentRequest = !!receipt?.isDepartmentRequest;
  const receiverName = isDepartmentRequest ? custodianName : requesterName;

  const addTag = (raw) => {
    let value = String(raw || '').trim();
    if (!value) return;
    // QR ຂອງຊັບສິນເປັນລິ້ງ …/assets/<_id>?claim=1 → ເອົາ _id
    const m = value.match(/\/assets\/([A-Za-z0-9_-]+)/);
    if (m) value = m[1];
    setTags((prev) => (prev.some((t) => t.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value]));
    setSubmitError('');
  };

  // ສະແກນຄົບຕາມຈຳນວນທີ່ຂໍ → ປິດກ້ອງອັດຕະໂນມັດ (ໜ່ວງສັ້ນໆ ໃຫ້ເຫັນ ✓ ສະແກນແລ້ວ ກ່ອນ)
  const prevTagCount = useRef(0);
  useEffect(() => {
    const reached = prevTagCount.current < requiredTagCount && tags.length >= requiredTagCount;
    prevTagCount.current = tags.length;
    if (!scannerOpen || requiredTagCount <= 0 || !reached) return undefined;
    const t = setTimeout(() => setScannerOpen(false), 700);
    return () => clearTimeout(t);
  }, [tags, requiredTagCount, scannerOpen]);

  const removeTag = (value) => setTags((prev) => prev.filter((t) => t !== value));

  // ຜູ້ຂໍກຳນົດ/ປ່ຽນ/ລຶບ ຜູ້ຮັບແທນ (1 ຄົນ) — ສົ່ງ null ເພື່ອລຶບ
  const saveDelegate = async (code) => {
    setDelegateError('');
    setDelegateSaving(true);
    try {
      await axios.patch(`/supply-requests/${id}/delegate`, { delegateCode: code });
      setDelegateInput('');
      await load();
    } catch (err) {
      setDelegateError(err.response?.data?.msg || err.response?.data?.message || 'ບັນທຶກຜູ້ຮັບແທນບໍ່ສຳເລັດ');
    } finally {
      setDelegateSaving(false);
    }
  };

  const submit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const payload = { assetTags: tags };
      if (consumableItems.length > 0) payload.confirmConsumables = confirmConsumables;
      // ເຈົ້າໜ້າທີ່ສາງຢືນຢັນແທນຜູ້ຂໍ → ລະບຸລະຫັດຜູ້ຂໍເປັນຜູ້ຮັບ
      // (ໃບຂອງແຜນກ: ບໍ່ສົ່ງ assigneeCode — Backend ຈະມອບໃຫ້ຜູ້ຮັບຜິດຊອບຂອງແຜນກ)
      if (!isDepartmentRequest && !receipt.isRequester && requester?.employeeCode) {
        payload.assigneeCode = requester.employeeCode;
      }
      // ເຈົ້າໜ້າທີ່ສາງທີ່ບໍ່ແມ່ນຜູ້ຂໍ/ຜູ້ຮັບແທນ → override ຕ້ອງມີເຫດຜົນ (ບັນທຶກ audit + ແຈ້ງຜູ້ຂໍ)
      if (receipt.requiresOverride) payload.overrideReason = overrideReason.trim();
      await axios.patch(`/supply-requests/${id}/receive`, payload);
      setDone(true);
      await load();
    } catch (err) {
      setSubmitError(err.response?.data?.msg || err.response?.data?.message || 'ຢືນຢັນຮັບເຄື່ອງບໍ່ສຳເລັດ');
    } finally {
      setSubmitting(false);
    }
  };

  const status =
    receipt?.status === 'APPROVED' && receipt?.readyToCollect
      ? { text: 'ພ້ອມມາຮັບ', className: 'bg-teal-50 text-teal-700 border-teal-200' }
      : STATUS_LABEL[receipt?.status] ||
        (receipt?.status === 'ORDERED'
          ? { text: 'ລໍຂອງເຂົ້າຄັງ', className: 'bg-violet-50 text-violet-600 border-violet-200' }
          : { text: receipt?.status, className: 'bg-gray-50 text-gray-600 border-gray-200' });
  const canSubmit =
    receipt?.canConfirm &&
    !submitting &&
    (!receipt.requiresOverride || overrideReason.trim().length >= 5) &&
    (requiredTagCount === 0 || tags.length >= requiredTagCount) &&
    (consumableItems.length === 0 || confirmConsumables);

  return (
    <MainLayout>
      <style>{`@media print { aside, nav, header, .no-print { display: none !important; } main { margin: 0 !important; padding: 0 !important; } }`}</style>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="no-print flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/supplies')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={16} /> ກັບໄປລາຍການຂໍ
          </button>
          {receipt && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              <Printer size={15} /> ພິມໃບຮັບເຄື່ອງ
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-10 text-center text-sm text-gray-500">ກຳລັງໂຫຼດ...</div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl p-10 text-center space-y-2">
            <AlertCircle className="mx-auto text-red-400" size={32} />
            <div className="text-sm text-red-600">{loadError}</div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-2">
                  <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Package size={20} className="text-amber-500" /> ໃບຮັບເຄື່ອງ
                  </h1>
                  <div className="text-sm text-gray-500">
                    ເລກໃບຂໍ: <span className="font-mono font-semibold text-gray-800">{receipt._id}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    ຜູ້ຂໍ: <span className="font-medium text-gray-800">{requesterName}</span>
                    {requester?.employeeCode ? ` (${requester.employeeCode})` : ''}
                  </div>
                  {isDepartmentRequest && (
                    <>
                      <div className="text-sm text-gray-500">
                        ແຜນກ: <span className="font-medium text-violet-700">{department?.name || department?._id || '—'}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        ຜູ້ຮັບຜິດຊອບ: <span className="font-medium text-gray-800">{custodianName}</span>
                        {custodian?.employeeCode ? ` (${custodian.employeeCode})` : ''}
                      </div>
                    </>
                  )}
                  {delegate && (
                    <div className="text-sm text-gray-500">
                      ຜູ້ຮັບແທນ: <span className="font-medium text-gray-800">{delegateName}</span>
                      {delegate.employeeCode ? ` (${delegate.employeeCode})` : ''}
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    ວັນທີຍື່ນ: {receipt.createdAt ? new Date(receipt.createdAt).toLocaleDateString() : '—'}
                  </div>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${status.className}`}>
                    {status.text}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 self-center sm:self-start">
                  <QRCodeSVG value={receiptUrl} size={120} level="M" marginSize={2} />
                  <div className="text-[11px] font-mono text-gray-500">{receipt._id}</div>
                </div>
              </div>

              {isLocalOrigin && (
                <div className="no-print text-[11px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  ກຳລັງເປີດຜ່ານ localhost — QR ນີ້ມືຖືຈະເປີດບໍ່ໄດ້. ໃຫ້ເປີດເວັບຜ່ານ IP ຂອງເຄື່ອງ (ຫຼືຕັ້ງ VITE_PUBLIC_BASE_URL) ກ່ອນພິມ/ສະແດງ QR
                </div>
              )}

              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">ລາຍການ</th>
                      <th className="p-3 text-center">ຈຳນວນ</th>
                      <th className="p-3">ປະເພດ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((it, k) => (
                      <tr key={k}>
                        <td className="p-3 text-gray-400">{k + 1}</td>
                        <td className="p-3">
                          <div className="font-medium text-gray-800">{it.name}</div>
                          {it.reason && <div className="text-xs text-gray-400">{it.reason}</div>}
                        </td>
                        <td className="p-3 text-center font-semibold">{it.quantity}</td>
                        <td className="p-3 text-xs">
                          {it.requiresAssetTag ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">ມີ Asset Tag — ຕ້ອງສະແກນ</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">ຂອງໃຊ້ສິ້ນເປືອງ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="hidden print:grid grid-cols-2 gap-8 pt-10 text-xs text-gray-500">
                <div className="border-t border-gray-400 pt-1 text-center">ຜູ້ຈ່າຍເຄື່ອງ (ສາງ)</div>
                <div className="border-t border-gray-400 pt-1 text-center">
                  ຜູ້ຮັບເຄື່ອງ{isDepartmentRequest ? ' (ຜູ້ຮັບຜິດຊອບແຜນກ)' : ''}
                </div>
              </div>
            </div>

            {done && ['FULFILLED', 'CLOSED'].includes(receipt.status) && (
              <div className="no-print bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3 text-emerald-700">
                <CheckCircle2 size={28} />
                <div>
                  <div className="font-semibold">ຢືນຢັນຮັບເຄື່ອງສຳເລັດ</div>
                  <div className="text-xs">
                    {isDepartmentRequest
                      ? `ຊັບສິນທີ່ມີ Asset Tag ຖືກບັນທຶກເຂົ້າທະບຽນໃນນາມແຜນກ ${department?.name || ''} ແລ້ວ`
                      : 'ຊັບສິນທີ່ມີ Asset Tag ຖືກບັນທຶກເຂົ້າທະບຽນໃຫ້ຜູ້ຮັບແລ້ວ'}
                  </div>
                </div>
              </div>
            )}

            {receipt.receiveOverride && (
              <div className="no-print bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
                ເຈົ້າໜ້າທີ່ສາງຢືນຢັນຮັບເຄື່ອງແທນ (override) — ເຫດຜົນ: {receipt.receiveOverride.reason}
              </div>
            )}

            {receipt.canSetDelegate && (
              <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                <h2 className="text-base font-bold text-gray-800">ຜູ້ຮັບແທນ</h2>
                <div className="text-xs text-gray-500">
                  ກຳນົດໄດ້ 1 ຄົນ ແລະປ່ຽນໄດ້ຕະຫຼອດຈົນກວ່າຈະຮັບເຄື່ອງ. ຜູ້ຮັບແທນມາຢືນຢັນຮັບເຄື່ອງຈາກໃບນີ້ໄດ້; ເຄື່ອງຍັງບັນທຶກໃຫ້ຜູ້ຂໍ{isDepartmentRequest ? '/ແຜນກ' : ''}ຄືເກົ່າ.
                </div>
                <div className="text-sm text-gray-600">
                  ປັດຈຸບັນ:{' '}
                  {delegate ? (
                    <span className="font-medium text-gray-800">
                      {delegateName}
                      {delegate.employeeCode ? ` (${delegate.employeeCode})` : ''}
                    </span>
                  ) : (
                    <span className="text-gray-400">ຍັງບໍ່ໄດ້ກຳນົດ</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={delegateInput}
                    onChange={(e) => setDelegateInput(e.target.value)}
                    placeholder="ລະຫັດພະນັກງານຂອງຜູ້ຮັບແທນ (ເຊັ່ນ EMP002)"
                    className="flex-1 border border-gray-200 rounded-lg p-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => saveDelegate(delegateInput.trim())}
                    disabled={delegateSaving || !delegateInput.trim()}
                    className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40"
                  >
                    {delegate ? 'ປ່ຽນ' : 'ບັນທຶກ'}
                  </button>
                  {delegate && (
                    <button
                      type="button"
                      onClick={() => saveDelegate(null)}
                      disabled={delegateSaving}
                      className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40"
                    >
                      ລຶບ
                    </button>
                  )}
                </div>
                {delegateError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{delegateError}</div>
                )}
              </div>
            )}

            {receipt.waitingForPurchase && (
              <div className="no-print bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm text-violet-800 space-y-2">
                <div className="font-semibold">ລໍຂອງເຂົ້າຄັງ — ຍັງຮັບບໍ່ໄດ້ຈົນກວ່າຈະ "ພ້ອມມາຮັບ"</div>
                {receipt.items
                  .filter((it) => it.purchaseRequestId)
                  .map((it, k) => (
                    <div key={`${it.purchaseRequestId}-${k}`} className="text-xs">
                      {it.name}: ຂໍ {it.quantity} = ໃຊ້ສະຕັອກ {Math.max((it.quantity || 0) - (it.purchaseQty || 0), 0)} + ຊື້ເພີ່ມ {it.purchaseQty}
                      {' · '}ຂອງມາແລ້ວ <b>{it.arrivedQty || 0}/{it.purchaseQty}</b> ({it.purchaseRequestNo})
                      {(it.purchaseStatus === 'REJECTED' || it.purchaseStatus === 'CANCELLED') && (
                        <span className="text-red-600"> — ໃບສະເໜີຊື້ຖືກ{it.purchaseStatus === 'REJECTED' ? 'ປະຕິເສດ' : 'ຍົກເລີກ'} ຍັງບໍ່ໄດ້ຮັບການຈັດຫາ</span>
                      )}
                    </div>
                  ))}
                <div className="text-xs">ຈະແຈ້ງເຕືອນເມື່ອຂອງມາຄົບ — ຫຼັງຈາກນັ້ນມາສະແກນຮັບຕາມປົກກະຕິ</div>
              </div>
            )}
            {receipt.readyToCollect && receipt.canConfirm && (
              <div className="no-print bg-teal-50 border border-teal-200 rounded-2xl p-4 text-sm text-teal-800">
                ຂອງທີ່ຕ້ອງຊື້ເພີ່ມມາຄົບແລ້ວ ແລະຖືກຈອງໄວ້ໃຫ້ຄຳຂໍນີ້ — ສະແກນຮັບໄດ້ເລີຍ
              </div>
            )}

            {['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(receipt.status) && !receipt.canConfirm && !receipt.waitingForPurchase && (
              <div className="no-print bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
                ມີສະເພາະຜູ້ຂໍ, ຜູ້ຮັບແທນທີ່ຖືກກຳນົດ, ຜູ້ຮັບຜິດຊອບ/ຫົວໜ້າແຜນກ ຫຼື ເຈົ້າໜ້າທີ່ສາງ (ສິດ supplies.fulfill ແລະ assets.assign) ທີ່ຢືນຢັນຮັບເຄື່ອງໄດ້
              </div>
            )}

            {['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(receipt.status) && receipt.canConfirm && (
              <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <h2 className="text-base font-bold text-gray-800">ຢືນຢັນຮັບເຄື່ອງທັງໃບ</h2>

                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">ຜູ້ຢືນຢັນ (ບັນຊີທີ່ login)</span>
                    <span className="font-medium text-gray-800">
                      {`${me?.firstName || ''} ${me?.lastName || ''}`.trim() || me?.email || '—'}
                      {me?.employeeCode ? ` (${me.employeeCode})` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ຜູ້ຮັບເຄື່ອງ</span>
                    <span className="font-medium text-gray-800">
                      {receiverName}
                      {custodian?.employeeCode && isDepartmentRequest ? ` (${custodian.employeeCode})` : ''}
                    </span>
                  </div>
                  {receipt.isDelegate && !receipt.isRequester && (
                    <div className="text-xs text-blue-600 pt-1">
                      ທ່ານຢືນຢັນໃນນາມຜູ້ຮັບແທນ —{' '}
                      {isDepartmentRequest
                        ? `ຊັບສິນຈະຖືກບັນທຶກໃນນາມແຜນກ ${department?.name || ''} ແລະ ມອບໃຫ້ຜູ້ຮັບຜິດຊອບ`
                        : 'ເຄື່ອງຈະຖືກບັນທຶກໃຫ້ຜູ້ຂໍ'}
                    </div>
                  )}
                  {receipt.requiresOverride && (
                    <div className="text-xs text-amber-600 pt-1">
                      ທ່ານບໍ່ແມ່ນຜູ້ຂໍ ຫຼື ຜູ້ຮັບແທນ — ການຢືນຢັນນີ້ເປັນ override: ຕ້ອງໃສ່ເຫດຜົນ, ຖືກບັນທຶກໃນ audit log ແລະຜູ້ຂໍຈະໄດ້ຮັບການແຈ້ງເຕືອນ.{' '}
                      {isDepartmentRequest
                        ? `ຊັບສິນຈະຖືກບັນທຶກໃນນາມແຜນກ ${department?.name || ''} ແລະ ມອບໃຫ້ຜູ້ຮັບຜິດຊອບ`
                        : 'ເຄື່ອງຈະຖືກບັນທຶກໃຫ້ຜູ້ຂໍ'}
                    </div>
                  )}
                </div>

                {receipt.requiresOverride && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700" htmlFor="override-reason">
                      ເຫດຜົນທີ່ຮັບແທນ (ຈຳເປັນ)
                    </label>
                    <textarea
                      id="override-reason"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="ເຊັ່ນ: ຜູ້ຂໍລາພັກ, ຕ້ອງການເຄື່ອງດ່ວນ"
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                    />
                  </div>
                )}

                {taggedItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-700">
                        ຂອງມີ Asset Tag — ສະແກນ {tags.length}/{requiredTagCount} ຊິ້ນ
                      </div>
                      <button
                        type="button"
                        onClick={() => setScannerOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium"
                      >
                        <ScanLine size={14} /> ສະແກນ QR / ບາໂຄ໊ດ
                      </button>
                    </div>
                    <ul className="text-xs text-gray-500 list-disc pl-5">
                      {taggedItems.map((it, k) => (
                        <li key={k}>{it.name} × {it.quantity}</li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag(tagInput);
                            setTagInput('');
                          }
                        }}
                        placeholder="ພິມ Asset Tag ແລ້ວກົດ Enter (ຫຼື ສະແກນ)"
                        className="flex-1 border border-gray-200 rounded-lg p-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => { addTag(tagInput); setTagInput(''); }}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        ເພີ່ມ
                      </button>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">
                            {t}
                            <button type="button" onClick={() => removeTag(t)} className="text-emerald-400 hover:text-red-500" aria-label={`ລຶບ ${t}`}>✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {consumableItems.length > 0 && (
                  <label className="flex items-start gap-3 text-sm bg-gray-50 border border-gray-200 rounded-xl p-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmConsumables}
                      onChange={(e) => setConfirmConsumables(e.target.checked)}
                      className="mt-0.5 rounded"
                    />
                    <span>
                      ໄດ້ຮັບຂອງໃຊ້ສິ້ນເປືອງຄົບຕາມຈຳນວນ:
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {consumableItems.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                      </span>
                    </span>
                  </label>
                )}

                {submitError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
                >
                  {submitting ? 'ກຳລັງບັນທຶກ...' : 'ຢືນຢັນຮັບເຄື່ອງ'}
                </button>
              </div>
            )}
          </>
        )}

        {scannerOpen && (
          <CameraScanner
            continuous
            title="ສະແກນ Asset Tag"
            hint="ຈ່ອງກ້ອງໃສ່ QR/ບາໂຄ໊ດຂອງເຄື່ອງ — ສະແກນໄດ້ຫຼາຍຊິ້ນຕິດຕໍ່ກັນ"
            onScan={addTag}
            onClose={() => setScannerOpen(false)}
          />
        )}
      </div>
    </MainLayout>
  );
}
