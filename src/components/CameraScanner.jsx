import { useEffect, useId, useRef, useState } from 'react';
import { X, Camera, AlertCircle, ScanLine } from 'lucide-react';

export default function CameraScanner({
  onScan,
  onClose,
  continuous = false,
  title = 'ສະແກນ QR / ບາໂຄ໊ດ',
  hint = 'ຈ່ອງກ້ອງໃສ່ QR ຫຼື ບາໂຄ໊ດຂອງອຸປະກອນ',
}) {
  const reactId = useId();
  const elementId = `camera-scanner-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const scannerRef = useRef(null);
  const stoppedRef = useRef(false);
  const lastScanRef = useRef({ text: '', at: 0 });

  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const [lastText, setLastText] = useState('');
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const flashTimerRef = useRef(null);
  const audioRef = useRef(null);

  const signalScan = () => {
    setFlash(true);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(false), 450);
    try {
      navigator.vibrate?.(80);
    } catch {
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      return;
    }
  };

  const stopScanner = async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
    }
    try {
      scanner.clear();
    } catch {
    }
  };

  const handleClose = async () => {
    await stopScanner();
    onClose?.();
  };

  useEffect(() => {
    let cancelled = false;
    stoppedRef.current = false;

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        setError(
          `ເບຣົາເຊີບລັອກກ້ອງ ເນື່ອງຈາກໜ້ານີ້ບໍ່ແມ່ນ HTTPS (ປັດຈຸບັນ: ${window.location.origin}). ກະລຸນາເປີດຜ່ານ https://... ຫຼື localhost ເທົ່ານັ້ນ`,
        );
        return;
      }

      let Html5Qrcode;
      try {
        ({ Html5Qrcode } = await import('html5-qrcode'));
      } catch {
        if (!cancelled) {
          setStarting(false);
          setError('ໂຫຼດໂມດູນສະແກນບໍ່ສຳເລັດ — ກະລຸນາລອງໃໝ່');
        }
        return;
      }
      if (cancelled) return;

      const scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          (decodedText) => {
            const now = Date.now();
            const prev = lastScanRef.current;
            if (prev.text === decodedText && now - prev.at < 1500) return;
            lastScanRef.current = { text: decodedText, at: now };
            setLastText(decodedText);
            setCount((c) => c + 1);
            signalScan();
            onScan?.(decodedText);
            if (!continuous) void handleClose();
          },
          () => {
          },
        );
        if (!cancelled) setStarting(false);
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        const msg = String(err?.message || err || '');
        if (/NotAllowed|Permission|denied/i.test(msg)) {
          setError('ຖືກປະຕິເສດສິດເຂົ້າເຖິງກ້ອງ — ກະລຸນາອະນຸຍາດໃຊ້ກ້ອງໃນເບຣົາເຊີ ແລ້ວລອງໃໝ່');
        } else if (/NotFound|Overconstrained|no camera/i.test(msg)) {
          setError('ບໍ່ພົບກ້ອງໃນອຸປະກອນນີ້ — ໃຊ້ການພິມ/ສະແກນຈາກອຸປະກອນພາຍນອກແທນ');
        } else {
          setError('ເປີດກ້ອງບໍ່ສຳເລັດ — ຕ້ອງເປີດເວັບຜ່ານ HTTPS ຫຼື localhost');
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(flashTimerRef.current);
      void stopScanner();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <ScanLine size={16} className="text-amber-500" /> {title}
          </h2>
          <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="relative bg-black min-h-[200px]">
          <div id={elementId} className="w-full" />
          {!error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`absolute inset-0 bg-emerald-400 transition-opacity duration-300 ${flash ? 'opacity-50' : 'opacity-0'}`} />
              <div className={`absolute z-10 flex items-center gap-2 bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg transition-all duration-300 ${flash ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                <span>✓</span> ສະແກນແລ້ວ
              </div>
              <div className="w-[70%] h-[75%] border-2 border-amber-400/80 rounded-2xl" />
            </div>
          )}
          {starting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/90 text-xs">
              <Camera size={28} className="animate-pulse" />
              ກຳລັງເປີດກ້ອງ...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <AlertCircle size={30} className="text-red-400" />
              <p className="text-xs text-white/90">{error}</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 space-y-1">
          {!error && <p className="text-xs text-gray-500">{hint}</p>}
          {lastText && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-mono break-all">
              ✓ {lastText}
              {continuous && count > 0 && <span className="text-emerald-600"> ({count})</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}