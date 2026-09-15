import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Plus, Loader2, X, ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import mammoth from 'mammoth';
import DOMPurify from 'dompurify';

export default function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    body: '',
    departmentId: '',
    tags: '',
    attachments: []
  });

  // Live KB suggestions while typing the ticket title
  const [suggestedArticles, setSuggestedArticles] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Article detail modal
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showUnpublished, setShowUnpublished] = useState(false); // managers only
  const [departments, setDepartments] = useState([]);
  const [knownCategories, setKnownCategories] = useState(new Set());
  const [knownTags, setKnownTags] = useState(new Set());
  const [tagFilter, setTagFilter] = useState('');

  const token = localStorage.getItem('token');

  const hasPermission = (module, action) => {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const perms = payload.permissions || [];
      const entry = perms.find(p => p.module === module);
      return !!entry?.actions?.includes(action);
    } catch (err) {
      return false;
    }
  };
  const canCreateArticle = hasPermission('kb', 'create');
  // Backend only reveals DRAFT/UNPUBLISHED articles to users with kb:publish
  const canManageKb = hasPermission('kb', 'publish');
  const canUpdateArticle = hasPermission('kb', 'update');
  const canDeleteArticle = hasPermission('kb', 'delete');

  const [editingId, setEditingId] = useState(null); // null = create mode, else PATCH this id
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);

  const [docxHtml, setDocxHtml] = useState({});

  const renderDocxPreview = async (url) => {
    if (docxHtml[url]) return; // already converted
    try {
      const res = await fetch(`http://localhost:3000${url}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const buffer = await res.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
      setDocxHtml(prev => ({ ...prev, [url]: DOMPurify.sanitize(result.value) }));
    } catch (error) {
      console.error('Error converting docx:', error);
      setDocxHtml(prev => ({ ...prev, [url]: '<p class="text-red-500 text-sm">ບໍ່ສາມາດສະແດງໄຟລ໌ນີ້ໄດ້</p>' }));
    }
  };

  useEffect(() => {
    (selectedArticle?.attachments || [])
      .filter(url => url.endsWith('.docx'))
      .forEach(renderDocxPreview);
  }, [selectedArticle]);

  const extractArrayData = (resData) => {
    if (Array.isArray(resData)) return resData;
    if (resData && Array.isArray(resData.data)) return resData.data;
    if (resData && Array.isArray(resData.articles)) return resData.articles;
    return [];
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (departmentFilter) params.set('departmentId', departmentFilter);
      if (canManageKb && showUnpublished) params.set('includeUnpublished', 'true');
      const endpoint = `http://localhost:3000/api/kb-articles${params.toString() ? `?${params}` : ''}`;

      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setArticles(extractArrayData(data));
      }
    } catch (error) {
      console.error('Error fetching kb-articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayedArticles = articles.filter(a => {
    const matchesQuery = !searchQuery.trim() || a.title?.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesTag = !tagFilter || (a.tags || []).includes(tagFilter);
    return matchesQuery && matchesTag;
  });

  const openDetail = async (id) => {
    setIsDetailOpen(true);
    setSelectedArticle(null); // shows a loading state in the modal
    try {
      const res = await fetch(`http://localhost:3000/api/kb-articles/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedArticle(data.data);
      } else {
        setIsDetailOpen(false);
        alert('ບໍ່ພົບບົດຄວາມນີ້');
      }
    } catch (error) {
      console.error('Error fetching article:', error);
      setIsDetailOpen(false);
    }
  };

  const submitFeedback = async (helpful) => {
    if (!selectedArticle) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/kb-articles/${selectedArticle._id}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ helpful })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedArticle(data.data);
        fetchArticles(); // keep list counts in sync
      } else {
        alert('ບໍ່ສາມາດສົ່ງຄຳຄິດເຫັນໄດ້');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setFeedbackSubmitting(false);
    }
  };


  const openEdit = () => {
    if (!selectedArticle) return;
    setFormData({
      title: selectedArticle.title || '',
      category: selectedArticle.category || '',
      body: selectedArticle.body || '',
      departmentId: selectedArticle.departmentId || '',
      tags: (selectedArticle.tags || []).join(', '),
      attachments: selectedArticle.attachments || []
    });
    setEditingId(selectedArticle._id);
    setIsDetailOpen(false);
    setIsModalOpen(true);
  };

  const togglePublish = async () => {
    if (!selectedArticle) return;
    const action = selectedArticle.status === 'PUBLISHED' ? 'unpublish' : 'publish';
    setStatusSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/kb-articles/${selectedArticle._id}/${action}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedArticle(data.data);
        fetchArticles();
      } else {
        alert('ບໍ່ສາມາດປ່ຽນສະຖານະໄດ້');
      }
    } catch (error) {
      console.error('Error toggling publish:', error);
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    const allowedExt = ['.pdf', '.docx'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExt.includes(ext)) {
      alert('ຮອງຮັບສະເພາະໄຟລ໌ PDF ແລະ DOCX (.docx)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('ໄຟລ໌ໃຫຍ່ເກີນໄປ (ຈຳກັດ 10MB)');
      return;
    }

    setFileUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // no Content-Type — browser sets multipart boundary
        body
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, attachments: [...prev.attachments, data.data.url] }));
      } else {
        const err = await res.json();
        alert(err.message || 'ອັບໂຫລດບໍ່ສຳເລັດ');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('ເກີດຂໍ້ຜິດພາດໃນການອັບໂຫລດ');
    } finally {
      setFileUploading(false);
    }
  };

  const removeAttachment = async (url) => {
    const filename = url.split('/').pop();
    setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(a => a !== url) }));
    try {
      await fetch(`http://localhost:3000/api/uploads/${filename}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const deleteArticle = async () => {
    if (!selectedArticle) return;
    if (!confirm(`ລຶບບົດຄວາມ "${selectedArticle.title}"? ການກະທຳນີ້ບໍ່ສາມາດຍົກເລີກໄດ້`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/kb-articles/${selectedArticle._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await Promise.all(
          (selectedArticle.attachments || []).map(url =>
            fetch(`http://localhost:3000/api/uploads/${url.split('/').pop()}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            }).catch(err => console.error('Error deleting attachment file:', err))
          )
        );
        setIsDetailOpen(false);
        setSelectedArticle(null);
        fetchArticles();
      } else {
        alert('ບໍ່ສາມາດລຶບໄດ້');
      }
    } catch (error) {
      console.error('Error deleting article:', error);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [categoryFilter, departmentFilter, showUnpublished]);

  useEffect(() => {
    fetch('http://localhost:3000/api/departments', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setDepartments(extractArrayData(data)))
      .catch(err => console.error('Error fetching departments:', err));
  }, []);

  useEffect(() => {
    setKnownCategories(prev => {
      const next = new Set(prev);
      articles.forEach(a => a.category && next.add(a.category));
      return next;
    });
    setKnownTags(prev => {
      const next = new Set(prev);
      articles.forEach(a => (a.tags || []).forEach(t => next.add(t)));
      return next;
    });
  }, [articles]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // ຈັດການແປງ tags ຈາກ string (ຂັ້ນດ້ວຍ comma) ໃຫ້ເປັນ Array
      const formattedTags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      const payload = {
        title: formData.title,
        category: formData.category,
        body: formData.body,
        departmentId: formData.departmentId,
        tags: formattedTags,
        attachments: formData.attachments
      };

      const isEdit = !!editingId;
      const res = await fetch(
        isEdit
          ? `http://localhost:3000/api/kb-articles/${editingId}`
          : 'http://localhost:3000/api/kb-articles',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (res.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ title: '', category: '', body: '', departmentId: '', tags: '', attachments: [] });
        fetchArticles();
        if (!isEdit) {
          alert(canManageKb
            ? 'ບົດຄວາມຖືກບັນທຶກເປັນສະບັບຮ່າງ (Draft) — ກົດ Publish ເພື່ອໃຫ້ພະນັກງານຄົນອື່ນເຫັນ'
            : 'ບົດຄວາມຖືກສົ່ງເປັນສະບັບຮ່າງ (Draft) — ລໍຖ້າຜູ້ດູແລ Publish ກ່ອນຈຶ່ງຈະສະແດງ');
        }
      } else {
        const err = await res.json();
        alert(err.message || 'ບໍ່ສາມາດສ້າງບົດຄວາມໄດ້');
      }
    } catch (error) {
      console.error('Error creating article:', error);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ເຊີບເວີ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຖານຂໍ້ມູນຄວາມຮູ້ / FAQ</h1>
            <p className="text-sm text-gray-500 mt-1">ຄູ່ມື ແລະ ວິທີແກ້ໄຂບັນຫາເບື້ອງຕົ້ນໃນລະບົບ (MongoDB)</p>
          </div>
          {canCreateArticle && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span>ເພີ່ມບົດຄວາມ</span>
            </button>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ຄົ້ນຫາຫົວຂໍ້ຄູ່ມື, ວິທີໃຊ້ງານ..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
            >
              <option value="">-- ທຸກໝວດໝູ່ --</option>
              {[...knownCategories].sort().map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
            >
              <option value="">-- ທຸກພະແນກ --</option>
              {departments.map(dept => (
                <option key={dept._id || dept.id} value={dept._id || dept.id}>{dept.name}</option>
              ))}
            </select>

            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
            >
              <option value="">-- ທຸກ Tag --</option>
              {[...knownTags].sort().map(tag => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>

            {canManageKb && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUnpublished}
                  onChange={(e) => setShowUnpublished(e.target.checked)}
                  className="rounded"
                />
                ສະແດງບົດຄວາມທີ່ຍັງບໍ່ Publish
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-12 text-center text-gray-400 flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-200">
              <Loader2 className="animate-spin" size={20} />
              <span>ກຳລັງໂຫລດຂໍ້ມູນ...</span>
            </div>
          ) : displayedArticles.length > 0 ? (
            displayedArticles.map((item) => (
              <div
                key={item._id}
                onClick={() => openDetail(item._id)}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3 hover:shadow-md transition flex flex-col justify-between cursor-pointer"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
                      <BookOpen size={16} />
                      {item.category || 'ທົ່ວໄປ'}
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono text-[10px]">
                      {item._id}
                    </span>
                    {item.status !== 'PUBLISHED' && (
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-medium">
                        {item.status === 'DRAFT' ? 'ຮ່າງ' : 'ຖອນອອກ'}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 text-base">{item.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-3">{item.body}</p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Eye size={14} /> {item.viewCount || 0}</span>
                    <span className="flex items-center gap-1 text-emerald-600"><ThumbsUp size={14} /> {item.helpfulCount || 0}</span>
                    <span className="flex items-center gap-1 text-rose-600"><ThumbsDown size={14} /> {item.notHelpfulCount || 0}</span>
                  </div>
                  <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-medium">
                    {item.departmentId}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              ຍັງບໍ່ມີບົດຄວາມໃນລະບົບ
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg">{editingId ? 'ແກ້ໄຂບົດຄວາມ' : 'ເພີ່ມບົດຄວາມຄວາມຮູ້ໃໝ່'}</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຫົວຂໍ້ບົດຄວາມ (Title)</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="ລະບຸຫົວຂໍ້..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ໝວດໝູ່ (Category)</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="ເຊັ່ນ: Networking"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ລະຫັດພະແນກ (Department ID)</label>
                  <input
                    type="text"
                    required
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    placeholder="DX001"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ເນື້ອໃນ (Body)</label>
                <textarea
                  rows="4"
                  required
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="ຂຽນຄູ່ມື ຫຼື ວິທີແກ້ໄຂບັນຫາ..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tags (ຂັ້ນດ້ວຍຈໍ້າເມັດ comma)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="vpn, network, connection"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ໄຟລ໌ແນບ (PDF, DOCX)</label>
                <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition">
                  {fileUploading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>ກຳລັງອັບໂຫລດ...</span>
                    </>
                  ) : (
                    <span>ກົດເພື່ອເລືອກໄຟລ໌ (ສູງສຸດ 10MB)</span>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleFileSelect}
                    disabled={fileUploading}
                    className="hidden"
                  />
                </label>

                {formData.attachments.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {formData.attachments.map(url => (
                      <div key={url} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg text-xs text-gray-600">
                        <span className="truncate">{url.split('/').pop()}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(url)}
                          className="text-red-500 hover:text-red-700 ml-2 shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingId(null); }}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  <span>ບັນທຶກ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
            {!selectedArticle ? (
              <div className="p-10 text-center text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                <span>ກຳລັງໂຫລດ...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
                  <div>
                    <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                      <BookOpen size={14} /> {selectedArticle.category || 'ທົ່ວໄປ'}
                    </span>
                    <h3 className="font-bold text-gray-800 text-lg mt-1">{selectedArticle.title}</h3>
                  </div>
                  <button onClick={() => setIsDetailOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedArticle.body}</p>

                  {selectedArticle.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedArticle.tags.map(tag => (
                        <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[11px]">#{tag}</span>
                      ))}
                    </div>
                  )}

                  {selectedArticle.attachments?.map(url => (
                    <div key={url} className="border border-gray-200 rounded-xl overflow-hidden">
                      {url.endsWith('.pdf') ? (
                        <iframe
                          src={`http://localhost:3000${url}`}
                          title={url}
                          className="w-full h-[75vh]"
                        />
                      ) : url.endsWith('.docx') ? (
                        docxHtml[url] ? (
                          <div
                            className="prose prose-sm max-w-none p-6 max-h-[75vh] overflow-y-auto"
                            dangerouslySetInnerHTML={{ __html: docxHtml[url] }}
                          />
                        ) : (
                          <div className="p-4 text-sm text-gray-400 flex items-center gap-2">
                            <Loader2 className="animate-spin" size={16} /> ກຳລັງແປງໄຟລ໌...
                          </div>
                        )
                      ) : (
                        <a href={`http://localhost:3000${url}`} target="_blank" rel="noreferrer" className="block p-3 text-sm text-blue-600 underline">
                          ເປີດໄຟລ໌
                        </a>
                      )}
                    </div>
                  ))}

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Eye size={14} /> {selectedArticle.viewCount || 0} ຄັ້ງ
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">ບົດຄວາມນີ້ເປັນປະໂຫຍດບໍ່?</span>
                      <button
                        disabled={feedbackSubmitting}
                        onClick={() => submitFeedback(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                      >
                        <ThumbsUp size={14} /> {selectedArticle.helpfulCount || 0}
                      </button>
                      <button
                        disabled={feedbackSubmitting}
                        onClick={() => submitFeedback(false)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                      >
                        <ThumbsDown size={14} /> {selectedArticle.notHelpfulCount || 0}
                      </button>
                    </div>
                  </div>

                  {(canUpdateArticle || canManageKb || canDeleteArticle) && (
                    <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                      {canUpdateArticle && (
                        <button onClick={openEdit} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                          ແກ້ໄຂ
                        </button>
                      )}
                      {canManageKb && (
                        <button
                          disabled={statusSubmitting}
                          onClick={togglePublish}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
                        >
                          {selectedArticle.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                        </button>
                      )}
                      {canDeleteArticle && (
                        <button
                          disabled={deleting}
                          onClick={deleteArticle}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50 ml-auto"
                        >
                          ລຶບ
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
}