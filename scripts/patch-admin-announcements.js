const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../public/admin.html');
let html = fs.readFileSync(file, 'utf8');

const sidebarInsert = `      <div class="nav-item active" onclick="switchView('dashboard')">🏠 Dashboard</div>

      <div class="menu-group-title" onclick="toggleMenuGroup('groupAnnounce')">📢 Duyurular &amp; Bildirim <span class="arrow">▼</span></div>
      <div class="menu-group-items" id="groupAnnounce">
        <div class="nav-item" onclick="switchView('announcements')">📣 Duyuru Yayınla (Canva + Push)</div>
        <div class="nav-item" onclick="switchView('push')">📲 Sadece Bildirim Gönder</div>
      </div>
      
      <!-- Ana Sayfa Grubu -->`;

if (!html.includes('groupAnnounce')) {
  html = html.replace(
    /      <div class="nav-item active" onclick="switchView\('dashboard'\)">🏠 Dashboard<\/div>\s*\n\s*<!-- Ana Sayfa Grubu -->/,
    sidebarInsert,
  );
  html = html.replace(
    /<div class="nav-item" onclick="switchView\('newsSources'\)">📡 Haber Kaynakları<\/div>\s*\n\s*<div class="nav-item" onclick="refreshSystem\('news'\)">🔄 Haberleri Yenile<\/div>/,
    `<div class="nav-item" onclick="switchView('newsSources')">📡 Haber Kaynakları</div>
        <div class="nav-item" onclick="switchView('announcements')">📣 Yayıncı Duyuruları</div>
        <div class="nav-item" onclick="refreshSystem('news')">🔄 Haberleri Yenile</div>`,
  );
  html = html.replace(
    /<div class="nav-item" onclick="switchView\('push'\)">📲 Toplu Bildirim<\/div>\s*\n\s*<div class="nav-item" onclick="switchView\('backups'\)">/,
    `<div class="nav-item" onclick="switchView('backups')">`,
  );
  html = html.replace(
    /(<button class="btn btn-secondary" onclick="refreshSystem\('pharmacies'\)">💊 Eczaneleri Tara<\/button>\s*\n\s*<button class="btn btn-secondary" onclick="refreshSystem\('news'\)">📰 Haberleri Tara<\/button>)/,
    `$1
            <button class="btn btn-primary" onclick="switchView('announcements')">📣 Duyuru Yayınla</button>`,
  );
}

const announcementsView = `
      <!-- Publisher Announcements -->
      <div id="announcementsView" class="view-section">
        <div class="card">
          <div class="section-title">📣 Yayıncı Duyurusu Yayınla</div>
          <p style="color:var(--text-muted); font-size:14px; margin-top:0">
            Canva'dan hazırladığınız görseli yükleyin, metni yazın ve yayınlayın.
            Kullanıcılar <strong>Düziçi Duyuruları</strong> sayfasında görür; bildirim açıksa push gider.
          </p>
          <div id="announcementImagePreview" style="margin:16px 0; height:180px; border-radius:14px; background:#f1f5f9; border:1px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; overflow:hidden; color:var(--text-muted); font-size:13px; font-weight:600">
            Görsel önizlemesi (Canva PNG/JPG)
          </div>
          <div class="row" style="margin-bottom:16px">
            <input type="file" id="announcementImageFile" accept="image/*" style="display:none" onchange="uploadAnnouncementImageFile()">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('announcementImageFile').click()">🖼️ Canva görseli seç</button>
            <button type="button" class="btn btn-secondary" onclick="clearAnnouncementImage()">✕ Görseli kaldır</button>
          </div>
          <div class="form-group">
            <label>Başlık</label>
            <input id="announcementTitle" placeholder="Örn: Akşam Karne Şenliği">
          </div>
          <div class="form-group">
            <label>Bildirim metni (kısa)</label>
            <input id="announcementSummary" placeholder="Push bildiriminde görünen kısa yazı">
          </div>
          <div class="form-group">
            <label>Detay metin (sayfada görünür)</label>
            <textarea id="announcementBody" rows="5" placeholder="Saat, yer, program..." style="width:100%; padding:12px; border-radius:12px; border:1px solid var(--border); font-family:inherit; font-size:14px"></textarea>
          </div>
          <div class="row" style="margin-bottom:12px">
            <label style="display:flex; align-items:center; gap:8px; margin:0; cursor:pointer">
              <input type="checkbox" id="announcementSendPush" checked> Bildirim gönder
            </label>
            <label style="display:flex; align-items:center; gap:8px; margin:0; cursor:pointer">
              <input type="checkbox" id="announcementPinned"> Öne çıkar
            </label>
          </div>
          <div id="announcementPublishResult" style="min-height:20px; margin-bottom:12px; font-size:13px; font-weight:600; color:var(--text-muted)"></div>
          <button type="button" class="btn btn-primary" id="announcementPublishBtn" onclick="publishAnnouncement()">🚀 Yayınla</button>
        </div>
        <div class="card">
          <div class="section-title">📋 Geçmiş duyurular</div>
          <div id="announcementsAdminList" style="font-size:14px; color:var(--text-muted)">Yükleniyor...</div>
        </div>
      </div>

`;

if (!html.includes('id="announcementsView"')) {
  html = html.replace('      <!-- Push Notifications -->', announcementsView + '      <!-- Push Notifications -->');
}

const jsBlock = `
    let announcementImageUrl = null;

    function setAnnouncementImagePreview(url) {
      const box = document.getElementById('announcementImagePreview');
      if (!box) return;
      if (!url) {
        box.innerHTML = 'Görsel önizlemesi (Canva PNG/JPG)';
        return;
      }
      box.innerHTML = '<img src="' + url.replace(/"/g, '&quot;') + '" alt="önizleme" style="width:100%;height:100%;object-fit:cover">';
    }

    function clearAnnouncementImage() {
      announcementImageUrl = null;
      const input = document.getElementById('announcementImageFile');
      if (input) input.value = '';
      setAnnouncementImagePreview(null);
    }

    async function uploadAnnouncementImageFile() {
      const fileInput = document.getElementById('announcementImageFile');
      if (!fileInput || !fileInput.files.length) return;
      const file = fileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      showToast('Görsel yükleniyor...');
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'x-admin-token': currentToken },
          body: formData,
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || 'Yükleme başarısız');
        let url = data.fileUrl;
        if (url.startsWith('/uploads/')) url = window.location.origin + url;
        announcementImageUrl = url;
        setAnnouncementImagePreview(url);
        showToast('Görsel hazır');
      } catch (e) {
        showToast(e.message || 'Yükleme hatası', true);
      }
    }

    async function loadAnnouncementsAdminList() {
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
    }

    async function resendAnnouncementPush(id) {
      try {
        const res = await fetch('/api/announcements/' + id + '/push', {
          method: 'POST',
          headers: { 'x-admin-token': currentToken },
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || 'Gönderilemedi');
        showToast('Bildirim gönderildi: ' + (data.push?.sent || 0) + ' cihaz');
      } catch (e) {
        showToast(e.message, true);
      }
    }

    async function deactivateAnnouncement(id) {
      if (!confirm('Bu duyuru yayından kaldırılsın mı?')) return;
      try {
        const res = await fetch('/api/announcements/' + id, {
          method: 'DELETE',
          headers: { 'x-admin-token': currentToken },
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || 'Kaldırılamadı');
        showToast('Duyuru kaldırıldı');
        loadAnnouncementsAdminList();
      } catch (e) {
        showToast(e.message, true);
      }
    }

`;

if (!html.includes('announcementImageUrl')) {
  html = html.replace('    async function loadPushStatus() {', jsBlock + '    async function loadPushStatus() {');
}

if (!html.includes("announcements:")) {
  html = html.replace(
    "        push: ['Toplu Bildirim', 'Tüm kullanıcılara push bildirim gönderin.'],",
    "        announcements: ['Yayıncı Duyuruları', 'Canva görseli ve metin ile duyuru yayınlayın; isteğe bağlı push gönderin.'],\n        push: ['Toplu Bildirim', 'Tüm kullanıcılara push bildirim gönderin.'],",
  );
}

if (!html.includes("view === 'announcements'")) {
  html = html.replace(
    `      if (view === 'push') {
        loadPushStatus();
      }`,
    `      if (view === 'announcements') {
        loadAnnouncementsAdminList();
      }
      if (view === 'push') {
        loadPushStatus();
      }`,
  );
}

if (!html.includes('screen:publisher_announcements')) {
  html = html.replace(
    '<option value="">Haber Akışı (Varsayılan)</option>',
    '<option value="">Haber Akışı (Varsayılan)</option>\n              <option value="screen:publisher_announcements">📣 Düziçi Duyuruları</option>',
  );
}

fs.writeFileSync(file, html, 'utf8');
console.log('admin.html patched OK');
