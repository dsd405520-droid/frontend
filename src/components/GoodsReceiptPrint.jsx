import { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import api from '../services/api';
import { API_ORIGIN } from '../config';

const PRINT_STYLE_ID = 'goods-receipt-print-style';

const ensurePrintStyle = () => {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      @page { size: A4; margin: 14mm; }
      body * { visibility: hidden !important; }
      #goods-receipt-print-area, #goods-receipt-print-area * { visibility: visible !important; }
      #goods-receipt-print-area {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        background: #fff !important;
        color: #000 !important;
      }
    }
  `;
  document.head.appendChild(style);
};

const unwrap = (body) => (body && body.data !== undefined ? body.data : body);
const money = (n) => (n === undefined || n === null ? '—' : Number(n).toLocaleString());
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const personName = (u) =>
  u && typeof u === 'object' ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.employeeCode || '—' : '—';

function Row({ label, children }) {
  return (
    <tr>
      <td className="py-1 pr-4 text-gray-500 align-top w-40">{label}</td>
      <td className="py-1 font-medium text-gray-900">{children}</td>
    </tr>
  );
}

/** ໃບຮັບເຄື່ອງເຂົ້າຄັງ (ພິມ A4) — ດຶງຂໍ້ມູນຈາກ GET /goods-receipt/:id */
export default function GoodsReceiptPrint({ receiptId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get(`/goods-receipt/${receiptId}`)
      .then((res) => alive && setData(unwrap(res.data)))
      .catch((err) => {
        const m = err.response?.data?.msg ?? err.response?.data?.message;
        alive && setError((Array.isArray(m) ? m.join(' · ') : m) || 'ໂຫຼດໃບຮັບເຄື່ອງບໍ່ສຳເລັດ');
      });
    return () => {
      alive = false;
    };
  }, [receiptId]);

  const print = () => {
    ensurePrintStyle();
    window.print();
  };

  const assets = data?.assets || [];
  const invoiceHref = data?.invoiceFileUrl ? `${API_ORIGIN}${data.invoiceFileUrl}` : '';

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">ໃບຮັບເຄື່ອງ {data?.receiptNo || ''}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">{error}</div>}
          {!data && !error && <p className="text-sm text-gray-400 text-center py-8">ກຳລັງໂຫຼດ...</p>}
          {data && (
            <div id="goods-receipt-print-area" className="text-sm text-gray-900 bg-white">
              <div className="text-center mb-4">
                <h1 className="text-xl font-bold">ໃບຮັບເຄື່ອງເຂົ້າຄັງ</h1>
                <p className="text-gray-500">ເລກທີ {data.receiptNo || '—'}</p>
              </div>

              <table className="w-full mb-4">
                <tbody>
                  <Row label="ວັນທີຮັບ">{fmtDate(data.receivedDate)}</Row>
                  <Row label="ຜູ້ຂາຍ / ຜູ້ສະໜອງ">{data.vendor || '—'}</Row>
                  <Row label="ເລກທີໃບບິນ">
                    {data.invoiceNo || '—'}
                    {invoiceHref && (
                      <span className="font-normal text-xs text-gray-500 ml-2">
                        (ແນບໄຟລ໌: {data.invoiceFileName || 'ເບິ່ງໄຟລ໌'})
                      </span>
                    )}
                  </Row>
                  <Row label="ສາຂາ">{data.branchName || '—'}</Row>
                  <Row label="ຫ້ອງເກັບ">{data.storageRoom || '—'}</Row>
                </tbody>
              </table>

              <table className="w-full border border-gray-400 mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 p-2 text-left">ລາຍການ</th>
                    <th className="border border-gray-400 p-2 text-right">ຈຳນວນ</th>
                    <th className="border border-gray-400 p-2 text-right">ລາຄາ/ໜ່ວຍ</th>
                    <th className="border border-gray-400 p-2 text-right">ລວມ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-400 p-2">
                      {data.itemName}
                      <div className="text-xs text-gray-500">{data.catalogItemId}</div>
                    </td>
                    <td className="border border-gray-400 p-2 text-right">
                      {data.quantity}
                      {data.unit ? ` ${data.unit}` : ''}
                    </td>
                    <td className="border border-gray-400 p-2 text-right">{money(data.unitPrice)}</td>
                    <td className="border border-gray-400 p-2 text-right font-semibold">{money(data.totalPrice)}</td>
                  </tr>
                </tbody>
              </table>

              {data.expectedQuantity != null && data.expectedQuantity !== data.quantity && (
                <p className="mb-3 text-xs">
                  ຕາມໃບສົ່ງເຄື່ອງ {data.expectedQuantity} / ນັບໄດ້ຈິງ {data.quantity} — {data.countNote || ''}
                </p>
              )}
              {data.note && <p className="mb-3 text-xs">ໝາຍເຫດ: {data.note}</p>}

              {assets.length > 0 && (
                <table className="w-full border border-gray-400 mb-6 text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 p-1 w-10">#</th>
                      <th className="border border-gray-400 p-1 text-left">Asset Tag</th>
                      <th className="border border-gray-400 p-1 text-left">Serial Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a, i) => (
                      <tr key={a._id}>
                        <td className="border border-gray-400 p-1 text-center">{i + 1}</td>
                        <td className="border border-gray-400 p-1 font-mono">{a.assetTag}</td>
                        <td className="border border-gray-400 p-1">{a.serialNumber || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="grid grid-cols-2 gap-8 mt-10 text-center">
                <div>
                  <div className="border-t border-gray-500 pt-1">ຜູ້ຮັບເຄື່ອງ</div>
                  <div className="text-xs text-gray-500">{personName(data.createdBy)}</div>
                </div>
                <div>
                  <div className="border-t border-gray-500 pt-1">ຜູ້ກວດສອບ / ຜູ້ອະນຸມັດ</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          {invoiceHref && (
            <a
              href={invoiceHref}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
            >
              ເປີດໃບບິນທີ່ແນບ
            </a>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
            ປິດ
          </button>
          <button
            type="button"
            disabled={!data}
            onClick={print}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Printer size={16} /> ພິມ
          </button>
        </div>
      </div>
    </div>
  );
}
