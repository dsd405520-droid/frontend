import BarcodeComponent from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';

const isAscii = (s) => !(s || '').split('').some((c) => c.charCodeAt(0) > 127);

export default function AssetTagVisual({
  asset,
  claimBaseUrl = '',
  qrSize = 130,
  barcodeWidth = 2,
  barcodeHeight = 50,
  showOriginWarning = false,
  isLocalOrigin = false,
  isIpOrigin = false,
  showHints = true,
}) {
  if (!asset) return null;
  const base = String(claimBaseUrl || '').replace(/\/+$/, '');

  return (
    <div className="flex flex-col items-center justify-center space-y-1">
      {showHints && <div className="text-xs font-medium text-gray-600">ເປີດໜ້າຢືນຢັນຮັບເຄື່ອງ (online)</div>}
      <QRCodeSVG value={`${base}/assets/${asset._id}?claim=1`} size={qrSize} level="M" marginSize={2} />
      {showOriginWarning &&
        (isLocalOrigin || isIpOrigin ? (
          <div className="text-[11px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
            ກຳລັງເປີດຜ່ານ localhost/IP — QR ນີ້ມືຖືຈະເປີດບໍ່ໄດ້ຖ້າ IP ປ່ຽນ. ໃຫ້ຕັ້ງ
            VITE_PUBLIC_BASE_URL=https://&lt;domain/IP ຖາວອນ&gt; ກ່ອນ build ແລ້ວສະແກນໃໝ່
          </div>
        ) : (
          <div className="text-[11px] text-gray-400">
            ຕ້ອງເຊື່ອມຕໍ່ເຄືອຂ່າຍດຽວກັບເຊີບເວີ — ເປີດໜ້າໃສ່ລະຫັດພະນັກງານທັນທີ
          </div>
        ))}

      <div className={`${showHints ? 'border-t border-gray-100 pt-3' : 'pt-1'} flex flex-col items-center justify-center`}>
        {isAscii(asset.assetTag) ? (
          <BarcodeComponent
            value={asset.assetTag}
            format="CODE128"
            width={barcodeWidth}
            height={barcodeHeight}
            fontSize={14}
            displayValue={false}
            margin={8}
          />
        ) : (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-[260px]">
            Asset Tag ມີຕົວອັກສອນທີ່ບໍ່ແມ່ນ ASCII (ຕົວຢ່າງ: ພາສາລາວ) — CODE128 ສ້າງບໍ່ໄດ້
          </div>
        )}
        <div className="mt-1 text-sm font-semibold tracking-widest text-gray-800">{asset.assetTag}</div>
        {asset.serialNumber && <div className="text-[11px] text-gray-500">S/N: {asset.serialNumber}</div>}
        {showHints && (
          <div className="text-[11px] text-gray-400 text-center">
            Barcode — CODE128 ຮອງຮັບສະເພາະຕົວອັກສອນ ASCII (A-Z, 0-9, ສັນຍາລັກ)
          </div>
        )}
      </div>
    </div>
  );
}
