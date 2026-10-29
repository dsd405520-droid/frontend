import { X } from 'lucide-react';

const TYPE_LABEL = {
  DEVICE_SERIAL: 'ມີ Serial Number',
  DEVICE_TAG: 'ຕິດ Asset Tag (ບໍ່ມີ S/N)',
  CONSUMABLE: 'ນັບຈຳນວນ (ສິ້ນເປືອງ)',
};

const personName = (u) =>
  u && typeof u === 'object' ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.employeeCode || '—' : '—';

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : '—');
const fmtMoney = (v) => (v != null ? Number(v).toLocaleString() : '—');

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, children, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-gray-800 font-medium break-words">{children}</div>
    </div>
  );
}

export default function PurchaseRequestDetailModal({ request: r, statusInfo, actions, onClose }) {
  const unit = r.unit ? ` ${r.unit}` : '';
  const remaining = Math.max((r.quantity || 0) - (r.receivedQuantity || 0), 0);
  const decided = r.status === 'REJECTED' ? 'ປະຕິເສດໂດຍ' : 'ອະນຸມັດໂດຍ';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="font-mono text-xs text-gray-400">{r.prNo}</div>
            <h3 className="text-lg font-bold text-gray-800">{r.itemName}</h3>
            <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.cls}`}>{statusInfo.text}</span>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <Section title="ລາຍການ">
            <Row label="ປະເພດໃບສະເໜີ">{r.mode === 'NEW_ITEM' ? 'ລາຍການໃໝ່' : 'ເພີ່ມລາຍການທີ່ມີແລ້ວ'}</Row>
            <Row label="ລະຫັດ Catalog">{r.catalogItemId || '—'}</Row>
            {r.newItem && (
              <>
                <Row label="ໝວດໝູ່">{r.newItem.category || '—'}</Row>
                <Row label="ໜ່ວຍນັບ">{r.newItem.unit || '—'}</Row>
                <Row label="ວິທີຕິດຕາມ">{TYPE_LABEL[r.newItem.type] || r.newItem.type || '—'}</Row>
              </>
            )}
          </Section>

          <Section title="ຈຳນວນ ແລະ ລາຄາ">
            <Row label="ຈຳນວນທີ່ຂໍ">{r.quantity}{unit}</Row>
            <Row label="ຮັບແລ້ວ">{r.receivedQuantity ?? 0}{unit}</Row>
            <Row label="ຍັງຄ້າງຮັບ">{remaining}{unit}</Row>
            <Row label="ລາຄາ/ໜ່ວຍ (ປະມານ)">{fmtMoney(r.estimatedUnitPrice)}</Row>
            <Row label="ລາຄາລວມ (ປະມານ)">{fmtMoney(r.estimatedTotal)}</Row>
            <Row label="ຮ້ານ / ຜູ້ຂາຍທີ່ແນະນຳ">{r.vendor || '—'}</Row>
          </Section>

          <Section title="ເຫດຜົນ">
            <Row label="ເຫດຜົນ / ຄວາມຈຳເປັນ" full>{r.reason}</Row>
            <Row label="ຕ້ອງການພາຍໃນວັນທີ">{fmtDate(r.neededBy)}</Row>
          </Section>

          <Section title="ຜູ້ສະເໜີ ແລະ ການອະນຸມັດ">
            <Row label="ຜູ້ສະເໜີ">{personName(r.requestedBy)}</Row>
            <Row label="ວັນທີສະເໜີ">{fmtDateTime(r.createdAt)}</Row>
            {r.approvedBy && (
              <>
                <Row label={decided}>{personName(r.approvedBy)}</Row>
                <Row label="ວັນທີດຳເນີນການ">{fmtDateTime(r.approvedAt)}</Row>
              </>
            )}
            {r.rejectReason && (
              <Row label="ເຫດຜົນທີ່ປະຕິເສດ" full>
                <span className="text-red-600">{r.rejectReason}</span>
              </Row>
            )}
            <Row label="ອັບເດດຫຼ້າສຸດ">{fmtDateTime(r.updatedAt)}</Row>
          </Section>

          {r.linkedSupplyRequest && (() => {
            const l = r.linkedSupplyRequest;
            const arrived = l.arrivedQty || 0;
            const SR_TEXT = {
              REQUESTED: 'ລໍອະນຸມັດ (ຈະອະນຸມັດພ້ອມໃບສະເໜີນີ້)',
              ORDERED: 'ອະນຸມັດແລ້ວ — ລໍຂອງເຂົ້າຄັງ',
              APPROVED: l.readyToCollectAt ? 'ພ້ອມມາຮັບ (ຈອງໄວ້ໃຫ້ຜູ້ຂໍແລ້ວ)' : 'ອະນຸມັດແລ້ວ',
              CLOSED: 'ຜູ້ຂໍຮັບເຄື່ອງແລ້ວ',
              FULFILLED: 'ຜູ້ຂໍຮັບເຄື່ອງແລ້ວ',
              REJECTED: 'ຄຳຂໍຖືກປະຕິເສດ',
            };
            const stalled = (r.status === 'REJECTED' || r.status === 'CANCELLED') && l.status === 'REQUESTED';
            return (
              <Section title="ຄຳຂໍເບີກທີ່ຜູກ">
                <Row label="ເລກຄຳຂໍເບີກ">{l._id}</Row>
                <Row label="ຜູ້ຂໍເບີກ">{personName(l.requestedBy)}</Row>
                <Row label="ສະຖານະຄຳຂໍເບີກ">{SR_TEXT[l.status] || l.status}</Row>
                <Row label="ຈຳນວນ">
                  ຂໍ {l.requestedQty} = ໃຊ້ສະຕັອກ {Math.max((l.requestedQty || 0) - (l.purchaseQty || 0), 0)} + ຊື້ເພີ່ມ {l.purchaseQty}
                </Row>
                <Row label="ຂອງມາຮອດຄັງແລ້ວ (ຈອງໃຫ້ຜູ້ຂໍ)">{arrived}/{l.purchaseQty}</Row>
                {stalled && (
                  <Row label="ແຈ້ງເຕືອນ" full>
                    <span className="text-red-600">
                      ໃບສະເໜີນີ້ຖືກ{r.status === 'REJECTED' ? 'ປະຕິເສດ' : 'ຍົກເລີກ'} — ຄຳຂໍເບີກ {l._id} ຍັງຄ້າງ ແລະສ່ວນທີ່ສະຕັອກບໍ່ພໍຍັງບໍ່ໄດ້ຮັບການຈັດຫາ
                    </span>
                  </Row>
                )}
              </Section>
            );
          })()}

          {r.receiptIds?.length > 0 && (
            <Section title="ໃບຮັບເຄື່ອງ">
              <Row label={`ຮັບເຄື່ອງແລ້ວ ${r.receiptIds.length} ຄັ້ງ`} full>
                <div className="flex flex-wrap gap-2">
                  {r.receiptIds.map((id) => (
                    <span key={id} className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{id}</span>
                  ))}
                </div>
              </Row>
            </Section>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-gray-100">
          {actions}
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
            ປິດ
          </button>
        </div>
      </div>
    </div>
  );
}
