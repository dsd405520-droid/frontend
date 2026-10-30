import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

/** ຖ່າຍຮູບດ້ວຍກ້ອງ (ເວັບແຄມ/ກ້ອງມືຖື) ແລ້ວສົ່ງກັບເປັນ File — ໃຊ້ຕອນເຄື່ອງບໍ່ຮອງຮັບ capture ຂອງ <input> */
export default function PhotoCaptureModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (err) {
        setError(
          err?.name === 'NotAllowedError'
            ? 'ບໍ່ໄດ້ຮັບອະນຸຍາດໃຊ້ກ້ອງ — ກະລຸນາອະນຸຍາດກ້ອງໃນ browser'
            : 'ບໍ່ສາມາດເປີດກ້ອງໄດ້ (ຕ້ອງໃຊ້ HTTPS ຫຼື localhost ແລະມີກ້ອງ)',
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `invoice-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        onClose();
      },
      'image/jpeg',
      0.9,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">ຖ່າຍຮູບໃບບິນ</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="ປິດ">
            <X size={20} />
          </button>
        </div>
        <div className="bg-black aspect-video flex items-center justify-center">
          {error ? (
            <p className="text-sm text-red-300 px-6 text-center">{error}</p>
          ) : (
            <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">ຍົກເລີກ</button>
          <button
            type="button"
            onClick={snap}
            disabled={!ready || !!error}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <Camera size={16} /> ຖ່າຍ
          </button>
        </div>
      </div>
    </div>
  );
}
