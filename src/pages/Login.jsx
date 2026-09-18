import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { getOrgSettings, applySystemName, DEFAULT_SYSTEM_NAME } from '../utils/orgSettings';

export default function Login() {
  const [systemName, setSystemName] = useState('Agricultural Promotion Bank CO.,LTD');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // MFA challenge step (shown after login returns mfaRequired)
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMethod, setMfaMethod] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const [setupToken, setSetupToken] = useState('');
  const [mfaSetupStep, setMfaSetupStep] = useState(null); // null | 'choose' | 'totp' | 'email'
  const [setupQr, setSetupQr] = useState('');
  const [setupOtpauthUrl, setSetupOtpauthUrl] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [resendingSetup, setResendingSetup] = useState(false);

  // ດຶງຊື່ລະບົບຈາກການຕັ້ງຄ່າອົງກອນ ມາສະແດງໃນໜ້າ Login
  useEffect(() => {
    let cancelled = false;
    getOrgSettings().then((settings) => {
      if (cancelled) return;
      setSystemName(settings.systemName);
      applySystemName(settings.systemName);
    });
    return () => { cancelled = true; };
  }, []);

  const handleChooseSetupMethod = async (method) => {
    setError('');
    setSetupSubmitting(true);
    try {
      const response = await fetch('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${setupToken}`,
        },
        body: JSON.stringify({ method }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || 'ຕັ້ງຄ່າ MFA ບໍ່ສຳເລັດ');

      if (method === 'totp') {
        setSetupQr(result.data.qrCodeDataUrl);
        setSetupOtpauthUrl(result.data.otpauthUrl);
        setMfaSetupStep('totp');
      } else {
        setMfaSetupStep('email');
      }
    } catch (err) {
      setError(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    } finally {
      setSetupSubmitting(false);
    }
  };

  const handleEnableMfa = async (e) => {
    e.preventDefault();
    setError('');
    setSetupSubmitting(true);
    try {
      const response = await fetch('http://localhost:3000/api/auth/mfa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${setupToken}`,
        },
        body: JSON.stringify({ code: setupCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || 'ລະຫັດບໍ່ຖືກຕ້ອງ');

      completeLoginWithToken(result.data.accessToken);
    } catch (err) {
      setError(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    } finally {
      setSetupSubmitting(false);
    }
  };

  const handleResendSetupCode = async () => {
    setResendingSetup(true);
    setError('');
    try {
      const response = await fetch('http://localhost:3000/api/auth/mfa/resend-code', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${setupToken}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || 'ສົ່ງລະຫັດຄືນບໍ່ສຳເລັດ');
    } catch (err) {
      setError(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    } finally {
      setResendingSetup(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.msg || 'ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
      }

      if (result.data.mfaSetupRequired) {
        setSetupToken(result.data.setupToken);
        setMfaSetupStep('choose');
        setLoading(false);
        return;
      }

      if (result.data.mfaRequired) {
        setMfaToken(result.data.mfaToken);
        setMfaMethod(result.data.mfaMethod);
        setMfaStep(true);
        setLoading(false);
        return;
      }

      completeLoginWithToken(result.data.accessToken);
    } catch (err) {
      setError(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    } finally {
      setLoading(false);
    }
  };

  // Shared by normal login and MFA-verified login — both end up with an accessToken.
  const completeLoginWithToken = (token) => {
    localStorage.setItem('token', token);

    // Backend doesn't return a separate user object — decode the JWT
    // payload (just base64, not encrypted) to get email/role/permissions
    // for the sidebar/navbar to use.
    const payload = JSON.parse(atob(token.split('.')[1]));
    localStorage.setItem('user', JSON.stringify({
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
    }));

    navigate('/');
    window.location.reload();
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setError('');
    setMfaSubmitting(true);
    try {
      const response = await fetch('http://localhost:3000/api/auth/mfa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.msg || 'ລະຫັດບໍ່ຖືກຕ້ອງ');
      }
      completeLoginWithToken(result.data.accessToken);
    } catch (err) {
      setError(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    } finally {
      setMfaSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    setError('');
    try {
      const response = await fetch('http://localhost:3000/api/auth/mfa/login/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.msg || 'ສົ່ງລະຫັດຄືນບໍ່ສຳເລັດ');
      }
    } catch (err) {
      setError(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-emerald-900/50 border border-yellow-500/30 backdrop-blur-xl rounded-2xl w-full max-w-md p-8 shadow-2xl space-y-6 relative z-10">

        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-500 via-amber-400 to-yellow-600 text-emerald-950 font-black flex items-center justify-center text-xl mx-auto shadow-lg shadow-yellow-500/20 border-2 border-yellow-300">
            APB
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">{systemName}</h1>
            <p className="text-base text-yellow-400 font-medium mt-0.5">ທະນາຄານສົ່ງເສີມກະສິກຳ ຈຳກົດ</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mfaSetupStep ? (
          <div className="space-y-4">
            {mfaSetupStep === 'choose' && (
              <>
                <p className="text-sm text-yellow-200/90">ບັນຊີນີ້ຕ້ອງການຕັ້ງຄ່າ MFA ກ່ອນເຂົ້າສູ່ລະບົບ — ເລືອກວິທີ:</p>
                <button
                  type="button"
                  disabled={setupSubmitting}
                  onClick={() => handleChooseSetupMethod('totp')}
                  className="w-full bg-emerald-950/80 border border-emerald-600/60 hover:border-yellow-400 text-white py-3 rounded-xl text-sm transition disabled:opacity-50"
                >
                  ແອັບ Authenticator (Google Authenticator, Authy...)
                </button>
                <button
                  type="button"
                  disabled={setupSubmitting}
                  onClick={() => handleChooseSetupMethod('email')}
                  className="w-full bg-emerald-950/80 border border-emerald-600/60 hover:border-yellow-400 text-white py-3 rounded-xl text-sm transition disabled:opacity-50"
                >
                  ອີເມວ
                </button>
              </>
            )}

            {mfaSetupStep === 'totp' && (
              <form onSubmit={handleEnableMfa} className="space-y-4">
                <p className="text-sm text-yellow-200/90">ສະແກນ QR ນີ້ດ້ວຍແອັບ Authenticator ຂອງທ່ານ:</p>
                {setupQr && (
                  <img src={setupQr} alt="MFA QR code" className="mx-auto rounded-xl bg-white p-2" style={{ width: 200, height: 200 }} />
                )}
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-emerald-950/80 border border-emerald-600/60 rounded-xl px-4 py-2.5 text-center tracking-[0.5em] text-lg text-white placeholder-emerald-400/50 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                />
                <button
                  type="submit"
                  disabled={setupSubmitting || setupCode.length !== 6}
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-emerald-950 font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 disabled:opacity-50"
                >
                  {setupSubmitting ? <Loader2 className="animate-spin" size={18} /> : <span>ຢືນຢັນ ແລະ ເປີດໃຊ້ MFA</span>}
                </button>
              </form>
            )}

            {mfaSetupStep === 'email' && (
              <form onSubmit={handleEnableMfa} className="space-y-4">
                <p className="text-sm text-yellow-200/90">ພວກເຮົາໄດ້ສົ່ງລະຫັດໄປທາງອີເມວຂອງທ່ານແລ້ວ</p>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-emerald-950/80 border border-emerald-600/60 rounded-xl px-4 py-2.5 text-center tracking-[0.5em] text-lg text-white placeholder-emerald-400/50 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                />
                <button
                  type="submit"
                  disabled={setupSubmitting || setupCode.length !== 6}
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-emerald-950 font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 disabled:opacity-50"
                >
                  {setupSubmitting ? <Loader2 className="animate-spin" size={18} /> : <span>ຢືນຢັນ ແລະ ເປີດໃຊ້ MFA</span>}
                </button>
                <button
                  type="button"
                  onClick={handleResendSetupCode}
                  disabled={resendingSetup}
                  className="w-full text-yellow-300 text-xs underline disabled:opacity-50"
                >
                  {resendingSetup ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງລະຫັດອີກຄັ້ງ'}
                </button>
              </form>
            )}
          </div>
        ) : !mfaStep ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-yellow-200/90 mb-1">ອີເມວ (Email)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-yellow-400" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jano@example.com"
                  className="w-full bg-emerald-950/80 border border-emerald-600/60 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-emerald-400/50 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-yellow-200/90 mb-1">ລະຫັດຜ່ານ (Password)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-yellow-400" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-emerald-950/80 border border-emerald-600/60 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-emerald-400/50 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-emerald-950 font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 disabled:opacity-50 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <span>ເຂົ້າສູ່ລະບົບ</span>}
            </button>
          </form>

        ) : (
          <form onSubmit={handleMfaVerify} className="space-y-4">
            <p className="text-sm text-yellow-200/90">
              {mfaMethod === 'email'
                ? 'ພວກເຮົາໄດ້ສົ່ງລະຫັດໄປທາງອີເມວຂອງທ່ານແລ້ວ'
                : 'ປ້ອນລະຫັດຈາກແອັບ Authenticator ຂອງທ່ານ'}
            </p>
            <input
              type="text"
              required
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full bg-emerald-950/80 border border-emerald-600/60 rounded-xl px-4 py-2.5 text-center tracking-[0.5em] text-lg text-white placeholder-emerald-400/50 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
            />
            <button
              type="submit"
              disabled={mfaSubmitting || mfaCode.length !== 6}
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-emerald-950 font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 disabled:opacity-50"
            >
              {mfaSubmitting ? <Loader2 className="animate-spin" size={18} /> : <span>ຢືນຢັນ</span>}
            </button>
            {mfaMethod === 'email' && (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending}
                className="w-full text-yellow-300 text-xs underline disabled:opacity-50"
              >
                {resending ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງລະຫັດອີກຄັ້ງ'}
              </button>
            )}
          </form>
        )}

      </div>
    </div>
  );
}