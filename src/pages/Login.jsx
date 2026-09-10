import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

      const token = result.data.accessToken;
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

      // ໄປທີ່ໜ້າຫຼັກ ຫຼື Reload ຫນ້າເພື່ອໃຫ້ Router ເຮັດວຽກສົມບູນ
      navigate('/');
      window.location.reload();
    } catch (err) {
      setError(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    } finally {
      setLoading(false);
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
            <h1 className="text-lg font-bold text-white tracking-wide">Agricultural Promotion Bank CO.,LTD</h1>
            <p className="text-base text-yellow-400 font-medium mt-0.5">ທະນາຄານສົ່ງເສີມກະສິກຳ ຈຳກົດ</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

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

      </div>
    </div>
  );
}