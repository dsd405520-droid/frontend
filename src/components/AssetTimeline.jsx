import { useEffect, useState } from 'react';
import { PackagePlus, UserCheck, Undo2, Wrench, RefreshCw, Plus, Building2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

const STATUS_LABEL = {
  AVAILABLE: 'ວ່າງ',
  ASSIGNED: 'ຖືກມອບໝາຍແລ້ວ',
  UNDER_REPAIR: 'ສ້ອມແປງ',
  RETIRED: 'ເລີກໃຊ້',
};
const REPAIR_STATUS = { IN_PROGRESS: 'ກຳລັງສ້ອມ', COMPLETED: 'ສ້ອມແລ້ວ', CANCELLED: 'ຍົກເລີກ' };

const META = {
  RECEIVED: { Icon: PackagePlus, label: 'ຮັບເຂົ້າສາງ', dot: 'bg-emerald-500' },
  CREATED: { Icon: Plus, label: 'ເພີ່ມເຂົ້າທະບຽນ', dot: 'bg-emerald-500' },
  ASSIGNED: { Icon: UserCheck, label: 'ມອບໝາຍ / ມີຄົນຮັບໄປ', dot: 'bg-blue-500' },
  ASSIGNED_DEPT: { Icon: Building2, label: 'ມອບໃຫ້ພະແນກ', dot: 'bg-violet-500' },
  RETURNED: { Icon: Undo2, label: 'ຮັບຄືນເຂົ້າສາງ', dot: 'bg-teal-500' },
  REPAIR: { Icon: Wrench, label: 'ສ້ອມແປງ', dot: 'bg-amber-500' },
  STATUS_CHANGED: { Icon: RefreshCw, label: 'ປ່ຽນສະຖານະ', dot: 'bg-gray-400' },
};

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const money = (n) => (n != null ? Number(n).toLocaleString() : null);
const person = (p) => (p ? `${p.name}${p.code ? ` (${p.code})` : ''}` : null);

function Row({ label, children }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (
    <div className="text-xs text-gray-600">
      <span className="text-gray-400">{label}: </span>
      <span className="text-gray-700">{children}</span>
    </div>
  );
}

function EventBody({ e }) {
  const d = e.detail || {};
  switch (e.type) {
    case 'RECEIVED':
      return (
        <>
          <Row label="ໃບຮັບເຄື່ອງ">{d.receiptNo}</Row>
          <Row label="ຜູ້ຂາຍ">{d.vendor}</Row>
          <Row label="ເລກບິນ">{d.invoiceNo}</Row>
          <Row label="ລາຄາ">{money(d.unitPrice)}</Row>
          <Row label="ໃບສະເໜີຊື້">{d.purchaseRequestNo}</Row>
          <Row label="ຫ້ອງເກັບ">{d.storageRoom}</Row>
          <Row label="ຮັບໂດຍ">{person(e.actor)}</Row>
        </>
      );
    case 'CREATED':
      return (
        <>
          <Row label="ວັນທີຊື້">{d.purchaseDate ? fmtDate(d.purchaseDate) : null}</Row>
          <Row label="ລາຄາ">{money(d.purchasePrice)}</Row>
          <Row label="ເພີ່ມໂດຍ">{person(e.actor)}</Row>
        </>
      );
    case 'ASSIGNED':
    case 'ASSIGNED_DEPT':
      return (
        <>
          {e.department && <Row label="ພະແນກ">{e.department}</Row>}
          <Row label={e.department ? 'ຜູ້ຮັບຜິດຊອບ' : 'ຜູ້ຮັບ'}>{person(e.holder)}</Row>
          <Row label="ຮັບແທນໂດຍ">{person(e.receivedBy)}</Row>
          <Row label="ຜູ້ດຳເນີນການ">{person(e.actor)}</Row>
        </>
      );
    case 'RETURNED':
      return (
        <>
          <Row label="ຄືນຈາກ">{person(e.holder)}</Row>
          {e.department && <Row label="ພະແນກ">{e.department}</Row>}
          <Row label="ຜູ້ດຳເນີນການ">{person(e.actor)}</Row>
        </>
      );
    case 'REPAIR':
      return (
        <>
          <Row label="ສະຖານະ">{REPAIR_STATUS[d.status] || d.status}</Row>
          <Row label="ບັນຫາ">{d.issue}</Row>
          <Row label="ລາຍລະອຽດ">{d.description}</Row>
          <Row label="ໝາຍເຫດສ້ອມ">{d.repairNotes}</Row>
          <Row label="ຊ່າງ">{d.technician}</Row>
          <Row label="ຄ່າໃຊ້ຈ່າຍ">{money(d.cost)}</Row>
          <Row label="ສ້ອມແລ້ວວັນທີ">{d.completionDate ? fmtDate(d.completionDate) : null}</Row>
          <Row label="ບັນທຶກໂດຍ">{person(e.actor)}</Row>
        </>
      );
    case 'STATUS_CHANGED':
      return (
        <>
          <Row label="ຈາກ → ເປັນ">
            {`${STATUS_LABEL[d.from] || d.from || '—'} → ${STATUS_LABEL[d.to] || d.to || '—'}`}
          </Row>
          <Row label="ໂດຍ">{person(e.actor)}</Row>
        </>
      );
    default:
      return null;
  }
}

export default function AssetTimeline({ assetId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assetId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    const token = localStorage.getItem('token') || '';
    fetch(`${API_BASE_URL}/assets/${encodeURIComponent(assetId)}/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || body?.message || 'ໂຫຼດປະຫວັດບໍ່ສຳເລັດ');
        if (!cancelled) setData(body?.data !== undefined ? body.data : body);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (loading) return <p className="text-sm text-gray-400">ກຳລັງໂຫຼດປະຫວັດ...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data) return null;

  const holder = person(data.currentHolder);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          <div className="text-[11px] text-gray-400">ເຂົ້າສາງຄັ້ງທຳອິດ</div>
          <div className="text-sm font-medium text-gray-800">{fmtDate(data.firstReceivedAt)}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          <div className="text-[11px] text-gray-400">ສະຖານະ</div>
          <div className="text-sm font-medium text-gray-800">{STATUS_LABEL[data.status] || data.status}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          <div className="text-[11px] text-gray-400">ໃຜຖືຢູ່ຕອນນີ້</div>
          <div className="text-sm font-medium text-gray-800">
            {holder || '— (ຢູ່ສາງ)'}
            {data.currentDepartment && <span className="block text-xs text-violet-600">ພະແນກ {data.currentDepartment}</span>}
          </div>
        </div>
      </div>

      {data.events.length === 0 ? (
        <p className="text-sm text-gray-400">ຍັງບໍ່ມີປະຫວັດ</p>
      ) : (
        <ol className="relative border-l border-gray-200 ml-3 space-y-4">
          {data.events.map((e, i) => {
            const m = META[e.type] || META.STATUS_CHANGED;
            const Icon = m.Icon;
            return (
              <li key={`${e.type}-${i}`} className="ml-5">
                <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full text-white ${m.dot}`}>
                  <Icon size={13} />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold text-gray-800">{m.label}</span>
                  <span className="text-xs text-gray-400">{fmtDateTime(e.at)}</span>
                </div>
                <div className="mt-0.5 space-y-0.5">
                  <EventBody e={e} />
                  {e.note && <div className="text-xs text-gray-500 italic">"{e.note}"</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
