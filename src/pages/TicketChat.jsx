import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

const POLL_INTERVAL_MS = 5000;

export default function TicketChat() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Authorization': `Bearer ${token}` };
  const scrollRef = useRef(null);

  const currentUserId = (() => {
    try {
      return JSON.parse(atob(token.split('.')[1])).sub;
    } catch {
      return null;
    }
  })();

  const fetchMessages = (silent) => {
    if (!silent) setLoading(true);
    fetch(`http://localhost:3000/api/ticket-messages?ticketId=${id}`, { headers })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || `ດຶງຂໍ້ຄວາມບໍ່ສຳເລັດ (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then(resBody => {
        const rows = resBody?.data ?? resBody;
        setMessages(Array.isArray(rows) ? rows : []);
        if (!silent) setLoading(false);
      })
      .catch(err => {
        if (!silent) {
          setError(err.message);
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    fetch(`http://localhost:3000/api/tickets/${id}`, { headers })
      .then(res => res.json())
      .then(b => setTicket(b?.data ?? b))
      .catch(() => {});

    fetchMessages(false);
    const interval = setInterval(() => fetchMessages(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    fetch('http://localhost:3000/api/ticket-messages', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: id, body: body.trim() }),
    })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || 'ສົ່ງຂໍ້ຄວາມບໍ່ສຳເລັດ');
        }
        setBody('');
        fetchMessages(true);
      })
      .catch(err => alert(err.message))
      .finally(() => setSending(false));
  };

  const senderName = (senderId) => {
    if (!senderId) return 'ບໍ່ລະບຸ';
    if (typeof senderId === 'object') {
      const fullName = [senderId.firstName, senderId.lastName].filter(Boolean).join(' ');
      return fullName || senderId.email || 'ບໍ່ລະບຸ';
    }
    return senderId;
  };
  const senderIdOf = (senderId) => {
    const raw = typeof senderId === 'object' && senderId !== null ? senderId._id : senderId;
    return raw != null ? String(raw) : null;
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/issues')}
            className="p-2 rounded-xl hover:bg-gray-200 text-gray-600 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              {ticket ? ticket.title : 'ກຳລັງໂຫຼດ...'}
            </h1>
            <p className="text-xs text-gray-400">{ticket?.ticketNumber || id}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3">
            ⚠️ {error}
          </div>
        )}

        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 overflow-y-auto space-y-3">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              ກຳລັງໂຫຼດຂໍ້ຄວາມ...
            </div>
          ) : messages.length > 0 ? (
            <>
              {messages.map((m) => {
                const isMine = senderIdOf(m.senderId) === currentUserId;
                return (
                  <div key={m._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      {!isMine && (
                        <p className="text-xs font-semibold mb-0.5 opacity-70">{senderName(m.senderId)}</p>
                      )}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={`text-[10px] mt-1 ${isMine ? 'text-amber-100' : 'text-gray-400'}`}>
                        {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              ຍັງບໍ່ມີຂໍ້ຄວາມ — ເລີ່ມການສົນທະນາໄດ້ເລີຍ
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="ພິມຂໍ້ຄວາມ..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white p-2.5 rounded-xl transition disabled:opacity-50"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </MainLayout>
  );
}
