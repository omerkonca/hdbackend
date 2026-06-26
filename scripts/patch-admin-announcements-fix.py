# -*- coding: utf-8 -*-
"""Patch admin.html announcements section preserving UTF-8."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "public" / "admin.html"
text = path.read_text(encoding="utf-8")

html_old = """          <div id="announcementPublishResult" style="min-height:20px; margin-bottom:12px; font-size:13px; font-weight:600; color:var(--text-muted)"></div>
          <button type="button" class="btn btn-primary" id="announcementPublishBtn" onclick="publishAnnouncement()">🚀 Yayınla</button>"""

html_new = """          <div id="announcementPublishResult" style="min-height:20px; margin-bottom:12px; font-size:13px; font-weight:600; color:var(--text-muted)"></div>
          <div id="announcementEditBanner" style="display:none; margin-bottom:12px; padding:12px 14px; border-radius:12px; background:rgba(59,130,246,0.1); color:#1d4ed8; font-size:13px; font-weight:700">
            Düzenleme modu — değişiklikleri kaydetmek için Güncelle'ye basın.
          </div>
          <div class="row" style="gap:10px; flex-wrap:wrap">
            <button type="button" class="btn btn-primary" id="announcementPublishBtn" onclick="publishAnnouncement()">🚀 Yayınla</button>
            <button type="button" class="btn btn-secondary" id="announcementCancelEditBtn" style="display:none" onclick="cancelAnnouncementEdit()">Vazgeç</button>
          </div>"""

js_helpers_old = """    let announcementImageUrl = null;

    function setAnnouncementImagePreview(url) {"""

js_helpers_new = """    let announcementImageUrl = null;
    let editingAnnouncementId = null;
    const announcementsAdminCache = {};

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function resetAnnouncementForm() {
      editingAnnouncementId = null;
      document.getElementById('announcementTitle').value = '';
      document.getElementById('announcementSummary').value = '';
      document.getElementById('announcementBody').value = '';
      document.getElementById('announcementPinned').checked = false;
      document.getElementById('announcementSendPush').checked = true;
      clearAnnouncementImage();
      const banner = document.getElementById('announcementEditBanner');
      if (banner) banner.style.display = 'none';
      const btn = document.getElementById('announcementPublishBtn');
      if (btn) btn.textContent = '🚀 Yayınla';
      const cancelBtn = document.getElementById('announcementCancelEditBtn');
      if (cancelBtn) cancelBtn.style.display = 'none';
      const resultEl = document.getElementById('announcementPublishResult');
      if (resultEl) resultEl.textContent = '';
    }

    function startEditAnnouncement(id) {
      const item = announcementsAdminCache[id];
      if (!item) return;
      editingAnnouncementId = id;
      document.getElementById('announcementTitle').value = item.title || '';
      document.getElementById('announcementSummary').value = item.summary || '';
      document.getElementById('announcementBody').value = item.body || '';
      document.getElementById('announcementPinned').checked = item.isPinned === true;
      document.getElementById('announcementSendPush').checked = false;
      announcementImageUrl = item.imageUrl || null;
      setAnnouncementImagePreview(announcementImageUrl);
      const banner = document.getElementById('announcementEditBanner');
      if (banner) {
        banner.style.display = 'block';
        banner.textContent = 'Düzenleniyor: ' + (item.title || '');
      }
      const btn = document.getElementById('announcementPublishBtn');
      if (btn) btn.textContent = '💾 Güncelle';
      const cancelBtn = document.getElementById('announcementCancelEditBtn');
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';
      document.querySelector('#announcementsView .card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function cancelAnnouncementEdit() {
      resetAnnouncementForm();
      showToast('Düzenleme iptal edildi');
    }

    function setAnnouncementImagePreview(url) {"""

js_list_publish_old = """    async function loadAnnouncementsAdminList() {
      const list = document.getElementById('announcementsAdminList');
      if (!list || !currentToken) return;
      list.textContent = 'Yükleniyor...';
      try {
        const res = await fetch('/api/announcements/admin/all', {
          headers: { 'x-admin-token': currentToken },
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          list.textContent = data.message || 'Liste alınamadı';
          return;
        }
        const items = data.items || [];
        if (!items.length) {
          list.textContent = 'Henüz duyuru yok.';
          return;
        }
        list.innerHTML = items.map((item) => {
          const date = item.publishedAt ? new Date(item.publishedAt).toLocaleString('tr-TR') : '';
          const status = item.isActive === false ? 'Kaldırıldı' : 'Yayında';
          const img = item.imageUrl ? '<img src="' + item.imageUrl + '" style="width:52px;height:52px;object-fit:cover;border-radius:8px;margin-right:12px">' : '';
          return '<div class="list-item" style="align-items:center;margin-bottom:10px">' +
            img +
            '<div style="flex:1"><strong>' + (item.title || '') + '</strong><div style="font-size:12px;color:var(--text-muted)">' + date + ' · ' + status + '</div></div>' +
            '<div class="row" style="gap:8px">' +
            (item.isActive !== false ? '<button class="btn btn-secondary" onclick="resendAnnouncementPush(\\'' + item.id + '\\')">📲 Push</button>' : '') +
            (item.isActive !== false ? '<button class="btn btn-secondary" onclick="deactivateAnnouncement(\\'' + item.id + '\\')">🗑️ Kaldır</button>' : '') +
            '</div></div>';
        }).join('');
      } catch (e) {
        list.textContent = 'Bağlantı hatası';
      }
    }

    async function publishAnnouncement() {
      const title = document.getElementById('announcementTitle').value.trim();
      const summary = document.getElementById('announcementSummary').value.trim();
      const body = document.getElementById('announcementBody').value.trim();
      const sendPush = document.getElementById('announcementSendPush').checked;
      const isPinned = document.getElementById('announcementPinned').checked;
      const resultEl = document.getElementById('announcementPublishResult');
      const btn = document.getElementById('announcementPublishBtn');
      if (!title) return showToast('Başlık girin', true);
      if (!summary && !body) return showToast('Bildirim metni veya detay girin', true);
      btn.disabled = true;
      btn.textContent = 'Yayınlanıyor...';
      resultEl.textContent = '';
      try {
        const res = await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': currentToken },
          body: JSON.stringify({
            title,
            summary: summary || body,
            body,
            imageUrl: announcementImageUrl,
            isPinned,
            sendPush,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || 'Yayınlanamadı');
        resultEl.style.color = 'var(--success)';
        const pushInfo = data.push ? (' · Push: ' + (data.push.sent || 0) + ' cihaz') : '';
        resultEl.textContent = 'Yayınlandı' + pushInfo;
        showToast('Duyuru yayınlandı');
        document.getElementById('announcementTitle').value = '';
        document.getElementById('announcementSummary').value = '';
        document.getElementById('announcementBody').value = '';
        clearAnnouncementImage();
        loadAnnouncementsAdminList();
      } catch (e) {
        resultEl.style.color = 'var(--danger)';
        resultEl.textContent = e.message;
        showToast(e.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Yayınla';
      }
    }"""

js_list_publish_new = """    async function loadAnnouncementsAdminList() {
      const list = document.getElementById('announcementsAdminList');
      if (!list) return;
      if (!currentToken) {
        list.textContent = 'Giriş yapın';
        return;
      }
      list.textContent = 'Yükleniyor...';
      try {
        const res = await fetch('/api/announcements/admin/all', {
          headers: { 'x-admin-token': currentToken },
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          list.textContent = data.message || 'Liste alınamadı';
          return;
        }
        const items = data.items || [];
        Object.keys(announcementsAdminCache).forEach((key) => delete announcementsAdminCache[key]);
        items.forEach((item) => {
          if (item && item.id) announcementsAdminCache[item.id] = item;
        });
        if (!items.length) {
          list.textContent = 'Henüz duyuru yok.';
          return;
        }
        list.innerHTML = items.map((item) => {
          const date = item.publishedAt ? new Date(item.publishedAt).toLocaleString('tr-TR') : '';
          const status = item.isActive === false ? 'Kaldırıldı' : 'Yayında';
          const img = item.imageUrl
            ? '<img src="' + escapeHtml(item.imageUrl) + '" style="width:52px;height:52px;object-fit:cover;border-radius:8px;margin-right:12px">'
            : '<div style="width:52px;height:52px;border-radius:8px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;margin-right:12px">📣</div>';
          const actions = item.isActive !== false
            ? '<button type="button" class="btn btn-secondary" onclick="startEditAnnouncement(\\'' + item.id + '\\')">✏️ Düzenle</button>' +
              '<button type="button" class="btn btn-secondary" onclick="resendAnnouncementPush(\\'' + item.id + '\\')">📲 Push</button>' +
              '<button type="button" class="btn btn-secondary" onclick="deactivateAnnouncement(\\'' + item.id + '\\')">🗑️ Kaldır</button>'
            : '<span style="font-size:12px;color:var(--text-muted)">Yayından kaldırıldı</span>';
          return '<div class="list-item" style="align-items:center;margin-bottom:10px">' +
            img +
            '<div style="flex:1;min-width:0"><strong>' + escapeHtml(item.title || '') + '</strong><div style="font-size:12px;color:var(--text-muted)">' + escapeHtml(date) + ' · ' + status + '</div></div>' +
            '<div class="row" style="gap:8px;flex-wrap:wrap">' + actions + '</div></div>';
        }).join('');
      } catch (e) {
        list.textContent = 'Bağlantı hatası: ' + (e.message || 'sunucu yanıt vermedi');
      }
    }

    async function publishAnnouncement() {
      const title = document.getElementById('announcementTitle').value.trim();
      const summary = document.getElementById('announcementSummary').value.trim();
      const body = document.getElementById('announcementBody').value.trim();
      const sendPush = document.getElementById('announcementSendPush').checked;
      const isPinned = document.getElementById('announcementPinned').checked;
      const resultEl = document.getElementById('announcementPublishResult');
      const btn = document.getElementById('announcementPublishBtn');
      if (!title) return showToast('Başlık girin', true);
      if (!summary && !body) return showToast('Bildirim metni veya detay girin', true);
      const isEdit = Boolean(editingAnnouncementId);
      btn.disabled = true;
      btn.textContent = isEdit ? 'Güncelleniyor...' : 'Yayınlanıyor...';
      resultEl.textContent = '';
      try {
        const payload = {
          title,
          summary: summary || body,
          body,
          imageUrl: announcementImageUrl,
          isPinned,
        };
        if (!isEdit) payload.sendPush = sendPush;

        const res = await fetch(
          isEdit ? '/api/announcements/' + editingAnnouncementId : '/api/announcements',
          {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-token': currentToken },
            body: JSON.stringify(payload),
          },
        );
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || (isEdit ? 'Güncellenemedi' : 'Yayınlanamadı'));

        if (isEdit && sendPush) {
          await resendAnnouncementPush(editingAnnouncementId);
        }

        resultEl.style.color = 'var(--success)';
        if (isEdit) {
          resultEl.textContent = sendPush ? 'Güncellendi ve bildirim gönderildi' : 'Duyuru güncellendi';
          showToast('Duyuru güncellendi');
        } else {
          const pushInfo = data.push ? (' · Push: ' + (data.push.sent || 0) + ' cihaz') : '';
          resultEl.textContent = 'Yayınlandı' + pushInfo;
          showToast('Duyuru yayınlandı');
        }
        resetAnnouncementForm();
        loadAnnouncementsAdminList();
      } catch (e) {
        resultEl.style.color = 'var(--danger)';
        resultEl.textContent = e.message;
        showToast(e.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = editingAnnouncementId ? '💾 Güncelle' : '🚀 Yayınla';
      }
    }"""

switch_old = """      if (view === 'push') {
        loadPushStatus();
      }
      if (view === 'json') {"""

switch_new = """      if (view === 'push') {
        loadPushStatus();
      }
      if (view === 'announcements') {
        loadAnnouncementsAdminList();
      }
      if (view === 'json') {"""

replacements = [
    (html_old, html_new),
    (js_helpers_old, js_helpers_new),
    (js_list_publish_old, js_list_publish_new),
    (switch_old, switch_new),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f"Patch block not found:\n{old[:120]}...")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("Patched", path)
