import { X, Printer } from 'lucide-react';
import AssetTagVisual from './AssetTagVisual';

const PRINT_STYLE_ID = 'asset-tag-print-style';

const ensurePrintStyle = () => {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #asset-tag-print-area, #asset-tag-print-area * { visibility: visible !important; }
      #asset-tag-print-area {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
        padding: 8px !important;
        background: #fff !important;
      }
      #asset-tag-print-area .asset-tag-print-item {
        break-inside: avoid;
        page-break-inside: avoid;
        border: 1px dashed #999 !important;
      }
    }
  `;
  document.head.appendChild(style);
};

export default function AssetTagPrintModal({ assets = [], claimBaseUrl = '', onClose, title = 'ພິມປ້າຍ QR / Barcode' }) {
  if (!assets.length) return null;

  const print = () => {
    ensurePrintStyle();
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">{title} ({assets.length})</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div id="asset-tag-print-area" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {assets.map((a) => (
              <div key={a._id} className="asset-tag-print-item border border-gray-200 rounded-xl p-3 bg-white">
                <AssetTagVisual
                  asset={a}
                  claimBaseUrl={claimBaseUrl}
                  qrSize={96}
                  barcodeWidth={1.4}
                  barcodeHeight={36}
                  showHints={false}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
            ປິດ
          </button>
          <button
            type="button"
            onClick={print}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"
          >
            <Printer size={16} /> ພິມ
          </button>
        </div>
      </div>
    </div>
  );
}
