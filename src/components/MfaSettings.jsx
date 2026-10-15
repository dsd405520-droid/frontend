import { useState, useEffect } from 'react';
import { ShieldCheck, Mail, KeyRound, Smartphone, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

// ວິທີ MFA ທັງ 3 ແບບ (ຕົງກັບ backend: 'email' | 'pin' | 'totp')
const METHODS = {
  email: { label: 'ອີເມວ (Email)', desc: 'ຮັບລະຫັດ 6 ຫຼັກທາງອີເມວທຸກຄັ້ງທີ່ເຂົ້າສູ່ລະບົບ', Icon: Mail },
  pin: { label: 'PIN ສ່ວນຕົວ (Personal PIN)', desc: 'PIN ຕົວເລກ 6–8 ຫຼັກ ທີ່ທ່ານຕັ້ງເອງ', Icon: KeyRound },
  totp: { label: 'ແອັບ Authenticator (Auth PIN)', desc: 'ລະຫັດ 6 ຫຼັກຈາກແອັບ Google Authenticator, Authy...', Icon: Smartphone },
};
const ORDER = ['email', 'pin', 'totp'];

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white';
const primaryBtn = 'text-sm bg-amber-500 hover:bg-amber-400 text-white font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2';
const ghostBtn = 'text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium px-4 py-2 rounded-lg transition disabled:opacity-50';

async function call(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = result.msg || result.message;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg || 'ເກີດຂໍ້ຜິດພາດ');
  }
  return result?.data ?? result;
}

const onlyDigits = (v) => v.replace(/\D/g, '');

// ---------- ຢືນຢັນຕົວຕົນກ່ອນແກ້ໄຂ ----------
// ກົດ: ຕ້ອງຢືນຢັນດ້ວຍວິທີອື່ນທີ່ເປີດຢູ່ (ຖ້າມີ). backend ເປັນຜູ້ກຳນົດ — ໜ້ານີ້ສະແດງຕາມ status.verifiers
function VerifyBlock({ target, verifiers, verifyMethod, setVerifyMethod, verifyCode, setVerifyCode }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const sendEmailCode = async () => {
    setSending(true);
    setErr('');
    try {
      await call('/auth/mfa/step-up/send-code', { method: 'POST', body: { target } });
      setSent(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-800">ຢືນຢັນຕົວຕົນກ່ອນ</p>

      {verifiers.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {verifiers.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setVerifyMethod(m); setVerifyCode(''); setSent(false); setErr(''); }}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                verifyMethod === m
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
              }`}
            >
              {METHODS[m].label}
            </button>
          ))}
        </div>
      )}

      {verifyMethod === 'email' && (
        <button type="button" onClick={sendEmailCode} disabled={sending} className={ghostBtn}>
          {sending ? 'ກຳລັງສົ່ງ...' : sent ? 'ສົ່ງລະຫັດອີກຄັ້ງ' : 'ສົ່ງລະຫັດໄປທີ່ອີເມວ'}
        </button>
      )}
      {verifyMethod === 'email' && sent && <p className="text-xs text-emerald-700">ສົ່ງລະຫັດໄປທີ່ອີເມວຂອງທ່ານແລ້ວ</p>}

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          {verifyMethod === 'pin'
            ? 'ປ້ອນ PIN ສ່ວນຕົວຂອງທ່ານ'
            : verifyMethod === 'totp'
              ? 'ປ້ອນລະຫັດຈາກແອັບ Authenticator'
              : 'ປ້ອນລະຫັດ 6 ຫຼັກຈາກອີເມວ'}
        </label>
        <input
          type={verifyMethod === 'pin' ? 'password' : 'text'}
          inputMode="numeric"
          autoComplete="off"
          maxLength={verifyMethod === 'pin' ? 8 : 6}
          value={verifyCode}
          onChange={(e) => setVerifyCode(onlyDigits(e.target.value))}
          placeholder={verifyMethod === 'pin' ? '••••••' : '123456'}
          className={`${inputClass} tracking-widest`}
        />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

// ---------- ແຜງເປີດ / ປ່ຽນ / ປິດ ----------
function ActionPanel({ action, status, onClose, onDone }) {
  const { type, method } = action; // type: 'enable' | 'change' | 'disable'
  const verifiers = status.verifiers?.[method] || [];
  const needsVerify = verifiers.length > 0;

  const [verifyMethod, setVerifyMethod] = useState(verifiers[0] || '');
  const [verifyCode, setVerifyCode] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState('form'); // 'form' | 'confirm' (email / totp ລໍຖ້າລະຫັດຢືນຢັນ)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const verifyBody = needsVerify ? { verifyMethod, verifyCode } : {};
  const verifyReady = !needsVerify || verifyCode.length >= 6;

  const run = async (fn) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startEmailOrTotp = () => run(async () => {
    const result = await call('/auth/mfa/setup', { method: 'POST', body: { method, ...verifyBody } });
    if (method === 'totp') setQr(result.qrCodeDataUrl || '');
    setCode('');
    setPhase('confirm');
  });

  const savePin = (e) => {
    e.preventDefault();
    if (!/^\d{6,8}$/.test(pin)) return setErr('PIN ຕ້ອງເປັນຕົວເລກ 6–8 ຫຼັກ');
    if (pin !== pin2) return setErr('PIN ແລະ ການຢືນຢັນບໍ່ຕົງກັນ');
    return run(async () => {
      await call('/auth/mfa/setup', { method: 'POST', body: { method: 'pin', pin, confirmPin: pin2, ...verifyBody } });
      await call('/auth/mfa/enable', { method: 'POST', body: { code: pin } });
      onDone(type === 'change' ? 'ປ່ຽນ PIN ສຳເລັດແລ້ວ' : 'ເປີດໃຊ້ PIN ສຳເລັດແລ້ວ');
    });
  };

  const confirmEnable = (e) => {
    e.preventDefault();
    return run(async () => {
      await call('/auth/mfa/enable', { method: 'POST', body: { code } });
      onDone(method === 'totp' && type === 'change' ? 'ປ່ຽນ Authenticator ສຳເລັດແລ້ວ' : `ເປີດໃຊ້ ${METHODS[method].label} ສຳເລັດແລ້ວ`);
    });
  };

  const resendSetupEmail = () => run(async () => {
    await call('/auth/mfa/resend-code', { method: 'POST' });
  });

  const disable = () => run(async () => {
    await call('/auth/mfa/disable', { method: 'POST', body: { method, ...verifyBody } });
    onDone(`ປິດ ${METHODS[method].label} ແລ້ວ`);
  });

  const title = type === 'disable' ? `ປິດ ${METHODS[method].label}` : type === 'change' ? `ປ່ຽນ ${METHODS[method].label}` : `ເປີດໃຊ້ ${METHODS[method].label}`;

  return (
    <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-gray-800 text-sm">{title}</h4>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">ຍົກເລີກ</button>
      </div>

      {err && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">⚠️ {err}</div>}

      {phase === 'form' && needsVerify && (
        <VerifyBlock
          target={method}
          verifiers={verifiers}
          verifyMethod={verifyMethod}
          setVerifyMethod={setVerifyMethod}
          verifyCode={verifyCode}
          setVerifyCode={setVerifyCode}
        />
      )}

      {/* ປິດ */}
      {type === 'disable' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">ວິທີອື່ນທີ່ເປີດໃຊ້ຢູ່ຈະຍັງໃຊ້ໄດ້ຕາມເດີມ.</p>
          <button type="button" onClick={disable} disabled={busy || !verifyReady} className={`${primaryBtn} bg-red-500 hover:bg-red-400`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'ຢືນຢັນປິດ'}
          </button>
        </div>
      )}

      {/* PIN: ຕັ້ງ / ປ່ຽນ */}
      {type !== 'disable' && method === 'pin' && (
        <form onSubmit={savePin} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{type === 'change' ? 'PIN ໃໝ່ (6–8 ຫຼັກ)' : 'ຕັ້ງ PIN (6–8 ຫຼັກ)'}</label>
            <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin}
              onChange={(e) => setPin(onlyDigits(e.target.value))} className={`${inputClass} tracking-widest`} placeholder="••••••" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ຢືນຢັນ PIN</label>
            <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin2}
              onChange={(e) => setPin2(onlyDigits(e.target.value))} className={`${inputClass} tracking-widest`} placeholder="••••••" />
          </div>
          <button type="submit" disabled={busy || pin.length < 6 || pin !== pin2 || !verifyReady} className={primaryBtn}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : type === 'change' ? 'ບັນທຶກ PIN ໃໝ່' : 'ຕັ້ງ PIN ແລະ ເປີດໃຊ້'}
          </button>
        </form>
      )}

      {/* ອີເມວ / Authenticator: ຂັ້ນ 1 */}
      {type !== 'disable' && method !== 'pin' && phase === 'form' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            {method === 'email'
              ? 'ພວກເຮົາຈະສົ່ງລະຫັດ 6 ຫຼັກໄປທີ່ອີເມວຂອງບັນຊີ ເພື່ອຢືນຢັນການເປີດໃຊ້.'
              : 'ສະແກນ QR Code ດ້ວຍແອັບ Authenticator ແລ້ວປ້ອນລະຫັດ 6 ຫຼັກເພື່ອຢືນຢັນ.'}
          </p>
          <button type="button" onClick={startEmailOrTotp} disabled={busy || !verifyReady} className={primaryBtn}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : method === 'email' ? 'ສົ່ງລະຫັດຢືນຢັນ' : 'ສ້າງ QR Code'}
          </button>
        </div>
      )}

      {/* ອີເມວ / Authenticator: ຂັ້ນ 2 */}
      {type !== 'disable' && method !== 'pin' && phase === 'confirm' && (
        <form onSubmit={confirmEnable} className="space-y-3">
          {method === 'totp' && qr && (
            <img src={qr} alt="MFA QR code" className="rounded-xl bg-white p-2 border border-gray-200" style={{ width: 200, height: 200 }} />
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {method === 'email' ? 'ລະຫັດ 6 ຫຼັກທີ່ສົ່ງໄປທາງອີເມວ' : 'ລະຫັດ 6 ຫຼັກຈາກແອັບ Authenticator'}
            </label>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(onlyDigits(e.target.value))} className={`${inputClass} tracking-widest`} placeholder="123456" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'ຢືນຢັນ ແລະ ເປີດໃຊ້'}
            </button>
            {method === 'email' && (
              <button type="button" onClick={resendSetupEmail} disabled={busy} className="text-xs text-amber-600 underline disabled:opacity-50">
                ສົ່ງລະຫັດອີກຄັ້ງ
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

// ---------- ການ໌ດຫຼັກໃນໜ້າ Settings ----------
export default function MfaSettings() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState('');

  const load = () => {
    setLoadError('');
    return call('/auth/mfa/status')
      .then((data) => setStatus(data))
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDone = (msg) => {
    setAction(null);
    setMessage(msg);
    setLoading(true);
    load();
    setTimeout(() => setMessage(''), 4000);
  };

  const enabled = status?.methods || [];

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b pb-3">
        <ShieldCheck size={18} className="text-amber-500" />
        <h3 className="font-bold text-gray-800 text-base">ການຢືນຢັນຕົວຕົນ 2 ຊັ້ນ (MFA)</h3>
      </div>

      {message && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">✅ {message}</div>}
      {loadError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">⚠️ {loadError}</div>}

      {loading && !status ? (
        <div className="py-6 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
      ) : status ? (
        <>
          <p className="text-xs text-gray-500">
            {enabled.length === 0
              ? 'ຍັງບໍ່ໄດ້ເປີດໃຊ້ MFA — ເປີດໃຊ້ໄດ້ຫຼາຍວິທີພ້ອມກັນ.'
              : enabled.length === 1
                ? 'ເວລາເຂົ້າສູ່ລະບົບ ຈະໃຊ້ວິທີທີ່ເປີດໃຊ້ຢູ່. ເປີດເພີ່ມອີກວິທີໄດ້ ແລ້ວຈະໄດ້ເລືອກວິທີເວລາລັອກອິນ.'
                : 'ເວລາເຂົ້າສູ່ລະບົບ ທ່ານຈະໄດ້ເລືອກວິທີຢືນຢັນຈາກວິທີທີ່ເປີດໃຊ້ຢູ່.'}
            {' '}ການເພີ່ມ / ປ່ຽນ / ປິດ ແຕ່ລະວິທີ ຕ້ອງຢືນຢັນດ້ວຍວິທີອື່ນທີ່ເປີດຢູ່ກ່ອນ.
          </p>

          <div className="divide-y divide-gray-100">
            {ORDER.map((m) => {
              const { label, desc, Icon } = METHODS[m];
              const isOn = enabled.includes(m);
              const lastAndRequired = isOn && enabled.length === 1 && status.mfaRequired;
              return (
                <div key={m} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`p-2 rounded-lg ${isOn ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}><Icon size={16} /></span>
                    <div className="text-sm">
                      <p className="font-medium text-gray-800 flex items-center gap-2">
                        {label}
                        {isOn && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">ເປີດໃຊ້ແລ້ວ</span>}
                      </p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isOn && (
                      <button type="button" onClick={() => setAction({ type: 'enable', method: m })} className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-medium transition">
                        ເປີດໃຊ້
                      </button>
                    )}
                    {isOn && m !== 'email' && (
                      <button type="button" onClick={() => setAction({ type: 'change', method: m })} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium transition">
                        ປ່ຽນ
                      </button>
                    )}
                    {isOn && (
                      <button
                        type="button"
                        disabled={lastAndRequired}
                        title={lastAndRequired ? 'ສິດ (Role) ຂອງທ່ານບັງຄັບໃຫ້ມີ MFA ຢ່າງໜ້ອຍ 1 ວິທີ' : undefined}
                        onClick={() => setAction({ type: 'disable', method: m })}
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-40"
                      >
                        ປິດ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {action && (
            <ActionPanel
              key={`${action.type}-${action.method}`}
              action={action}
              status={status}
              onClose={() => setAction(null)}
              onDone={handleDone}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
