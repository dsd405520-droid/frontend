import { useRef, useState } from 'react';
import { ImagePlus, Package, Trash2 } from 'lucide-react';
import { API_BASE_URL, API_ORIGIN } from '../config';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

export const imageSrc = (url) => (url ? `${API_ORIGIN}${url}` : '');

/** ຮູບນ້ອຍຂອງລາຍການ catalog — ບໍ່ມີຮູບ ສະແດງໄອຄອນແທນ */
export function CatalogThumb({ url, name = '', size = 40, className = '' }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (!url || broken) {
    return (
      <span
        style={style}
        className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300 ${className}`}
        aria-hidden="true"
      >
        <Package size={Math.round(size * 0.5)} />
      </span>
    );
  }
  return (
    <img
      src={imageSrc(url)}
      alt={name}
      style={style}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-lg object-cover border border-gray-100 bg-white ${className}`}
    />
  );
}

/** ປຸ່ມອັບໂຫຼດຮູບ + ພຣີວິວ. value = url ປັດຈຸບັນ, onChange(url | '') */
export default function CatalogImageUpload({ value, onChange, disabled = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) return setError('ຮອງຮັບສະເພາະຮູບ PNG, JPG, WEBP, GIF');
    if (file.size > MAX_BYTES) return setError('ຮູບໃຫຍ່ເກີນໄປ (ຈຳກັດ 2MB)');
    try {
      setUploading(true);
      setError('');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE_URL}/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: fd,
      });
      if (!res.ok) throw new Error('upload');
      const body = await res.json();
      const info = body.data ?? body;
      onChange(info.url);
    } catch {
      setError('ອັບໂຫຼດຮູບບໍ່ສຳເລັດ');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        ຮູບລາຍການ <span className="text-gray-400 font-normal">— ທາງເລືອກ</span>
      </label>
      <div className="flex items-center gap-3">
        <CatalogThumb url={value} size={64} />
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <ImagePlus size={14} /> {uploading ? 'ກຳລັງອັບໂຫຼດ...' : value ? 'ປ່ຽນຮູບ' : 'ເລືອກຮູບ'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-100 rounded-lg text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} /> ລຶບຮູບ
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={pick} />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <p className="text-[11px] text-gray-400 mt-1">PNG / JPG / WEBP / GIF ບໍ່ເກີນ 2MB</p>
    </div>
  );
}
