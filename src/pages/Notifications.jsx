import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Loader2, MailOpen } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function Notifications() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');

  const extractArrayData = (resData) => {
    if (Array.isArray(resData)) return resData;
    if (resData && Array.isArray(resData.data)) return resData.data;
    return [];
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // ປ່ຽນມາໃຊ້ Endpoint /notifications/my ໃຫ້ກົງກັບ Backend Controller
      const res = await fetch('http://localhost:3000/api/notifications/my', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifs(extractArrayData(data));
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        setNotifs(notifs.map(n => n._id === id ? { ...n, isRead: true } : n));
        window.dispatchEvent(new Event('unread-counts-changed'));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/notifications/read-all', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        setNotifs(notifs.map(n => ({ ...n, isRead: true })));
        window.dispatchEvent(new Event('unread-counts-changed'));
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ການແຈ້ງເຕືອນ</h1>
            <p className="text-sm text-gray-500 mt-1">ສູນລວມການແຈ້ງເຕືອນທັງໝົດໃນລະບົບ</p>
          </div>
          {notifs.some(n => !n.isRead) && (
            <button
              onClick={handleMarkAllAsRead}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm"
            >
              <CheckCheck size={16} className="text-amber-500" />
              <span>ໝາຍວ່າອ່ານທັງໝົດແລ້ວ</span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={20} />
              <span>ກຳລັງໂຫລດການແຈ້ງເຕືອນ...</span>
            </div>
          ) : notifs.length > 0 ? (
            notifs.map((item) => (
              <div
                key={item._id}
                onClick={() => !item.isRead && handleMarkAsRead(item._id)}
                className={`p-4 flex items-center justify-between transition cursor-pointer ${!item.isRead ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${!item.isRead ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                    <Bell size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!item.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {item.title}
                      </p>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.body || item.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                  {!item.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkAsRead(item._id); }}
                      className="text-gray-400 hover:text-amber-600 transition p-1"
                      title="ໝາຍວ່າອ່ານແລ້ວ"
                    >
                      <MailOpen size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">
              ບໍ່ມີການແຈ້ງເຕືອນໃໝ່ໃນຂະນະນີ້
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}