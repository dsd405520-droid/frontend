import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Monitor,
  LogOut,
  Info,
  Save,
  Server,
  HardDrive,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { hasPermission } from '../utils/permissions';
import { getOrgSettings, cacheOrgSettings, applySystemName } from '../utils/orgSettings';

// ຕົງກັບ SECRET_MASK ຝັ່ງ backend — ຖ້າຄ່ານີ້ຖືກສົ່ງຄືນ ໝາຍຄວາມວ່າ "ຮັກສາຄ່າເກົ່າ"
const SECRET_MASK = '••••••••';

function decodeJwtSessionId(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sessionId || null;
  } catch {
    return null;
  }
}

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [error, setError] = useState('');

  const canReadOrg = hasPermission('settings', 'read');
  const canUpdateOrg = hasPermission('settings', 'update');

  // ສະຖານະການຕັ້ງຄ່າອົງກອນ (System Name / SMTP / S3 / Integration Keys)
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgMessage, setOrgMessage] = useState({ type: '', text: '' });
  const [secretSaved, setSecretSaved] = useState({ smtpPass: false, s3AccessKey: false, s3Secret: false });
  const [form, setForm] = useState({
    systemName: '',
    smtp: { host: '', port: '', secure: false, user: '', pass: '', fromEmail: '', fromName: '' },
    s3: { endpoint: '', region: '', bucket: '', accessKeyId: '', secretAccessKey: '', usePathStyle: false },
    integrations: [],
  });

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Authorization': `Bearer ${token}` };
  const currentSessionId = decodeJwtSessionId(token);

  const fetchSessions = () => {
    setLoadingSessions(true);
    fetch('http://localhost:3000/api/sessions/me', { headers })
      .then(res => res.json())
      .then(body => {
        const rows = body?.data ?? body;
        setSessions(Array.isArray(rows) ? rows : []);
        setLoadingSessions(false);
      })
      .catch(() => setLoadingSessions(false));
  };

  useEffect(() => {
    setLoadingProfile(true);
    fetch('http://localhost:3000/api/auth/me', { headers })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || `ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then(body => {
        setProfile(body?.data ?? body);
        setLoadingProfile(false);
      })
      .catch(err => {
        setError(err.message);
        setLoadingProfile(false);
      });

    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ດຶງການຕັ້ງຄ່າອົງກອນ (ສະເພາະຜູ້ທີ່ມີສິດ settings:read)
  useEffect(() => {
    if (!canReadOrg) return;
    setLoadingOrg(true);
    fetch('http://localhost:3000/api/settings/org', { headers })
      .then(async res => {
        if (!res.ok) throw new Error('ດຶງການຕັ້ງຄ່າອົງກອນບໍ່ສຳເລັດ');
        return res.json();
      })
      .then(body => {
        const data = body?.data ?? body ?? {};
        setForm({
          systemName: data.systemName || '',
          smtp: {
            host: data.smtp?.host || '',
            port: data.smtp?.port ?? '',
            secure: !!data.smtp?.secure,
            user: data.smtp?.user || '',
            pass: '',
            fromEmail: data.smtp?.fromEmail || '',
            fromName: data.smtp?.fromName || '',
          },
          s3: {
            endpoint: data.s3?.endpoint || '',
            region: data.s3?.region || '',
            bucket: data.s3?.bucket || '',
            accessKeyId: '',
            secretAccessKey: '',
            usePathStyle: !!data.s3?.usePathStyle,
          },
          integrations: Array.isArray(data.integrations)
            ? data.integrations.map(i => ({ ...i, value: i.secret ? '' : (i.value || ''), saved: !!i.value }))
            : [],
        });
        setSecretSaved({
          smtpPass: !!data.smtp?.pass,
          s3AccessKey: !!data.s3?.accessKeyId,
          s3Secret: !!data.s3?.secretAccessKey,
        });
        setLoadingOrg(false);
      })
      .catch(err => {
        setOrgMessage({ type: 'error', text: err.message });
        setLoadingOrg(false);
      });
  }, [canReadOrg]);

  const setTop = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const setSection = (section, key, value) =>
    setForm(prev => ({ ...prev, [section]: { ...(prev[section] || {}), [key]: value } }));

  const updateIntegration = (idx, field, value) =>
    setForm(prev => ({
      ...prev,
      integrations: prev.integrations.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    }));

  const addIntegration = () =>
    setForm(prev => ({
      ...prev,
      integrations: [...(prev.integrations || []), { key: '', label: '', value: '', secret: true, enabled: true, saved: false }],
    }));

  const removeIntegration = (idx) =>
    setForm(prev => ({ ...prev, integrations: prev.integrations.filter((_, i) => i !== idx) }));

  const saveOrgSettings = (e) => {
    e.preventDefault();
    if (!canUpdateOrg) return;
    setSavingOrg(true);
    setOrgMessage({ type: '', text: '' });

    const payload = {
      systemName: form.systemName.trim(),
      smtp: {
        host: form.smtp.host,
        port: form.smtp.port === '' || form.smtp.port == null ? undefined : Number(form.smtp.port),
        secure: !!form.smtp.secure,
        user: form.smtp.user,
        pass: form.smtp.pass || (secretSaved.smtpPass ? SECRET_MASK : undefined),
        fromEmail: form.smtp.fromEmail,
        fromName: form.smtp.fromName,
      },
      s3: {
        endpoint: form.s3.endpoint,
        region: form.s3.region,
        bucket: form.s3.bucket,
        accessKeyId: form.s3.accessKeyId || (secretSaved.s3AccessKey ? SECRET_MASK : undefined),
        secretAccessKey: form.s3.secretAccessKey || (secretSaved.s3Secret ? SECRET_MASK : undefined),
        usePathStyle: !!form.s3.usePathStyle,
      },
      integrations: form.integrations
        .filter(i => i.key && i.key.trim().length > 0)
        .map(i => ({
          key: i.key.trim(),
          label: i.label?.toString().trim() || undefined,
          value: i.value || (i.saved ? SECRET_MASK : undefined),
          secret: !!i.secret,
          enabled: !!i.enabled,
        })),
    };

    fetch('http://localhost:3000/api/settings/org', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    })
      .then(async res => {
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.message || result.msg || 'ບັນທຶກບໍ່ສຳເລັດ');
        return result;
      })
      .then(() => {
        setOrgMessage({ type: 'success', text: 'ບັນທຶກການຕັ້ງຄ່າອົງກອນສຳເລັດແລ້ວ!' });
        cacheOrgSettings({ systemName: form.systemName.trim() || 'Helpdesk Enterprise' });
        applySystemName(form.systemName.trim() || 'Helpdesk Enterprise');
        setForm(prev => ({
          ...prev,
          smtp: { ...prev.smtp, pass: '' },
          s3: { ...prev.s3, accessKeyId: '', secretAccessKey: '' },
          integrations: prev.integrations.map(i => ({ ...i, value: i.secret ? '' : i.value, saved: !!i.value || i.saved })),
        }));
        setTimeout(() => setOrgMessage({ type: '', text: '' }), 4000);
      })
      .catch(err => setOrgMessage({ type: 'error', text: err.message }))
      .finally(() => setSavingOrg(false));
  };

  const revokeSession = (id) => {
    if (!window.confirm('ຕ້ອງການອອກຈາກລະບົບອຸປະກອນນີ້ແທ້ບໍ?')) return;
    setRevokingId(id);
    fetch(`http://localhost:3000/api/sessions/me/${id}`, {
      method: 'DELETE',
      headers,
    })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || 'ອອກຈາກລະບົບບໍ່ສຳເລັດ');
        }
        fetchSessions();
      })
      .catch(err => alert(err.message))
      .finally(() => setRevokingId(null));
  };

  const fullName = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : '';

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white';
  const labelClass = 'text-xs text-gray-400 mb-1 block';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ການຕັ້ງຄ່າ</h1>
          <p className="text-sm text-gray-500 mt-1">ຂໍ້ມູນສ່ວນຕົວ, ອຸປະກອນທີ່ເຂົ້າສູ່ລະບົບ ແລະ ການຕັ້ງຄ່າອົງກອນ</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        {/* ຂໍ້ມູນສ່ວນຕົວ */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-800 text-base border-b pb-3">ຂໍ້ມູນສ່ວນຕົວ</h3>
          {loadingProfile ? (
            <div className="py-6 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
          ) : profile ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ຊື່</p>
                <p className="font-medium text-gray-800">{fullName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ອີເມວ</p>
                <p className="font-medium text-gray-800">{profile.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ສິດ (Role)</p>
                <p className="font-medium text-gray-800">{profile.role?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ພະແນກ</p>
                <p className="font-medium text-gray-800">{profile.departmentId?.name || '-'}</p>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-400">ບໍ່ສາມາດດຶງຂໍ້ມູນໄດ້</div>
          )}
        </div>

        {/* ອຸປະກອນທີ່ເຂົ້າສູ່ລະບົບ */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-800 text-base border-b pb-3">ອຸປະກອນທີ່ເຂົ້າສູ່ລະບົບຢູ່</h3>
          {loadingSessions ? (
            <div className="py-6 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
          ) : sessions.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {sessions.map((s) => {
                const isCurrent = s._id === currentSessionId;
                return (
                  <div key={s._id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-gray-100 text-gray-500 p-2 rounded-lg"><Monitor size={16} /></span>
                      <div className="text-sm">
                        <p className="font-medium text-gray-800 flex items-center gap-2">
                          {s.deviceInfo?.browser || 'ບໍ່ຮູ້ browser'} · {s.deviceInfo?.os || 'ບໍ່ຮູ້ OS'}
                          {isCurrent && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">ອຸປະກອນນີ້</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          IP: {s.deviceInfo?.ip || '-'} · ໃຊ້ຫຼ້າສຸດ: {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : '-'}
                        </p>
                      </div>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => revokeSession(s._id)}
                        disabled={revokingId === s._id}
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <LogOut size={14} />
                        {revokingId === s._id ? 'ກຳລັງອອກ...' : 'ອອກຈາກລະບົບ'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-400">ບໍ່ມີອຸປະກອນທີ່ເຂົ້າສູ່ລະບົບ</div>
          )}
        </div>

        {/* ການຕັ້ງຄ່າອົງກອນ (System Name / SMTP / S3 / Integration Keys) */}
        <form onSubmit={saveOrgSettings} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-gray-800 text-base">ການຕັ້ງຄ່າອົງກອນ</h3>
            {!loadingOrg && canReadOrg && (
              <button
                type="submit"
                disabled={!canUpdateOrg || savingOrg}
                className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {savingOrg ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
              </button>
            )}
          </div>

          {orgMessage.text && (
            <div className={`p-3 rounded-xl text-sm ${orgMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {orgMessage.text}
            </div>
          )}

          {!canReadOrg ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800">
              <Info size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm">
                ການຕັ້ງຄ່າອົງກອນລະດັບເລິກ (ຊື່ລະບົບ, S3, SMTP, Integration Keys) ຮຽກຮ້ອງສິດ
                <span className="font-medium"> settings:read</span> ເພື່ອເບິ່ງ ແລະ
                <span className="font-medium"> settings:update</span> ເພື່ອແກ້ໄຂ — ຕິດຕໍ່ຜູ້ດູແລລະບົບເພື່ອອະນຸມັດສິດ.
              </p>
            </div>
          ) : loadingOrg ? (
            <div className="py-8 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
          ) : (
            <div className="space-y-6">
              {/* System Name */}
              <div>
                <p className="flex items-center gap-2 font-semibold text-gray-700 text-sm mb-2"><SettingsIcon size={15} /> ຊື່ລະບົບ</p>
                <p className="text-xs text-gray-400 mb-2">ໃຊ້ສະແດງໃນໜ້າ Login, Sidebar, ແຖບຊື່ພາຍ ແລະ ເປັນຊື່ຜູ້ສົ່ງໃນອີເມວ</p>
                <input
                  type="text"
                  value={form.systemName}
                  onChange={(e) => setTop('systemName', e.target.value)}
                  disabled={!canUpdateOrg}
                  className={inputClass}
                  placeholder="Helpdesk Enterprise"
                />
              </div>

              {/* SMTP */}
              <div>
                <p className="flex items-center gap-2 font-semibold text-gray-700 text-sm mb-2"><Server size={15} /> SMTP (ສົ່ງອີເມວ)</p>
                <p className="text-xs text-gray-400 mb-2">ຖ້າ host ເປົ່າ, ລະບົບຈະໃຊ້ Gmail ຈາກການຕັ້ງຄ່າ env ຄືເດີມ</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Host (SMTP server)</label>
                    <input type="text" value={form.smtp.host} onChange={(e) => setSection('smtp', 'host', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="smtp.example.com" />
                  </div>
                  <div>
                    <label className={labelClass}>Port</label>
                    <input type="number" value={form.smtp.port} onChange={(e) => setSection('smtp', 'port', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="587" />
                  </div>
                  <div>
                    <label className={labelClass}>Username</label>
                    <input type="text" value={form.smtp.user} onChange={(e) => setSection('smtp', 'user', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="user@example.com" />
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <input type="password" value={form.smtp.pass} onChange={(e) => setSection('smtp', 'pass', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder={secretSaved.smtpPass ? `${SECRET_MASK} (ບັນທຶກແລ້ວ — ປ່ອຍເປົ່າເພື່ອຮັກສາ)` : '••••••••'} />
                  </div>
                  <div>
                    <label className={labelClass}>From Email</label>
                    <input type="text" value={form.smtp.fromEmail} onChange={(e) => setSection('smtp', 'fromEmail', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="no-reply@example.com" />
                  </div>
                  <div>
                    <label className={labelClass}>From Name</label>
                    <input type="text" value={form.smtp.fromName} onChange={(e) => setSection('smtp', 'fromName', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="Helpdesk" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 mt-2 cursor-pointer">
                  <input type="checkbox" checked={form.smtp.secure} onChange={(e) => setSection('smtp', 'secure', e.target.checked)} disabled={!canUpdateOrg} className="accent-amber-500" />
                  ໃຊ້ TLS/SSL (secure connection)
                </label>
              </div>

              {/* S3 */}
              <div>
                <p className="flex items-center gap-2 font-semibold text-gray-700 text-sm mb-2"><HardDrive size={15} /> S3 Object Storage</p>
                <p className="text-xs text-gray-400 mb-2">ການຕັ້ງຄ່າເກັບໄຟລ໌/ຮູບພາບແບບ S3-compatible (ໃຊ້ກັບຄຸນສົມບັດອັບໂຫຼດໄຟລ໌ໃນອະນາຄົດ)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Endpoint</label>
                    <input type="text" value={form.s3.endpoint} onChange={(e) => setSection('s3', 'endpoint', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="https://s3.example.com" />
                  </div>
                  <div>
                    <label className={labelClass}>Region</label>
                    <input type="text" value={form.s3.region} onChange={(e) => setSection('s3', 'region', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="ap-southeast-1" />
                  </div>
                  <div>
                    <label className={labelClass}>Bucket</label>
                    <input type="text" value={form.s3.bucket} onChange={(e) => setSection('s3', 'bucket', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="my-company-assets" />
                  </div>
                  <div>
                    <label className={labelClass}>Access Key ID</label>
                    <input type="password" value={form.s3.accessKeyId} onChange={(e) => setSection('s3', 'accessKeyId', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder={secretSaved.s3AccessKey ? `${SECRET_MASK} (ບັນທຶກແລ້ວ)` : '••••••••'} />
                  </div>
                  <div>
                    <label className={labelClass}>Secret Access Key</label>
                    <input type="password" value={form.s3.secretAccessKey} onChange={(e) => setSection('s3', 'secretAccessKey', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder={secretSaved.s3Secret ? `${SECRET_MASK} (ບັນທຶກແລ້ວ)` : '••••••••'} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 mt-2 cursor-pointer">
                  <input type="checkbox" checked={form.s3.usePathStyle} onChange={(e) => setSection('s3', 'usePathStyle', e.target.checked)} disabled={!canUpdateOrg} className="accent-amber-500" />
                  ໃຊ້ path-style ແທນ virtual-hosted style
                </label>
              </div>

              {/* Integration Keys */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="flex items-center gap-2 font-semibold text-gray-700 text-sm"><KeyRound size={15} /> Integration Keys</p>
                  {canUpdateOrg && (
                    <button type="button" onClick={addIntegration} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1">
                      <Plus size={14} /> ເພີ່ມ key
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-2">ຕົວຢ່າງ: Slack webhook URL, Telegram bot token ແລະ chat ID, ຫຼື key-value ອື່ນໆຕາມທີ່ຕ້ອງການ</p>

                {form.integrations.length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-400">ຍັງບໍ່ມີ Integration keys</div>
                ) : (
                  <div className="space-y-2">
                    {form.integrations.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="sm:col-span-3">
                          <input type="text" value={it.key} onChange={(e) => updateIntegration(idx, 'key', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="key (ເຊັ່ນ: SLACK_WEBHOOK)" />
                        </div>
                        <div className="sm:col-span-2">
                          <input type="text" value={it.label || ''} onChange={(e) => updateIntegration(idx, 'label', e.target.value)} disabled={!canUpdateOrg} className={inputClass} placeholder="label (ບໍ່ບັງຄັບ)" />
                        </div>
                        <div className="sm:col-span-4">
                          <input
                            type={it.secret ? 'password' : 'text'}
                            value={it.value}
                            onChange={(e) => updateIntegration(idx, 'value', e.target.value)}
                            disabled={!canUpdateOrg}
                            className={inputClass}
                            placeholder={it.saved ? `${SECRET_MASK} (ບັນທຶກແລ້ວ — ປ່ອຍເປົ່າເພື່ອຮັກສາ)` : 'value'}
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-3 justify-end text-xs text-gray-500">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={!!it.secret} onChange={(e) => updateIntegration(idx, 'secret', e.target.checked)} disabled={!canUpdateOrg} className="accent-amber-500" />
                            ລັບ
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={it.enabled !== false} onChange={(e) => updateIntegration(idx, 'enabled', e.target.checked)} disabled={!canUpdateOrg} className="accent-amber-500" />
                            ໃຊ້ງານ
                          </label>
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          {canUpdateOrg && (
                            <button type="button" onClick={() => removeIntegration(idx)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save bar (mobile/duplicate) */}
              <div className="flex justify-end border-t pt-4">
                <button
                  type="submit"
                  disabled={!canUpdateOrg || savingOrg}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2 rounded-xl transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  {savingOrg ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກການຕັ້ງຄ່າ'}
                </button>
              </div>
              {!canUpdateOrg && (
                <p className="text-xs text-gray-400 -mt-2">ທ່ານບໍ່ມີສິດ <span className="font-medium">settings:update</span> — ສາມາດເບິ່ງໄດ້ຢ່າງດຽວ</p>
              )}
            </div>
          )}
        </form>
      </div>
    </MainLayout>
  );
}