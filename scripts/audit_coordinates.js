const fs = require('fs');
const path = require('path');
const http = require('http');

// Paths
const correctionsPath = path.resolve(__dirname, '../data/map_corrections.json');

if (!fs.existsSync(correctionsPath)) {
  console.error('Hata: map_corrections.json bulunamadı!');
  process.exit(1);
}

// Global data loading function
function loadData() {
  const fileData = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));
  const places = fileData.places || {};
  const pharmacies = fileData.pharmacies || {};
  
  // Approximate Düziçi/Osmaniye bounds for outlier flag
  const minLat = 37.0;
  const maxLat = 37.5;
  const minLng = 36.0;
  const maxLng = 36.6;

  const placesList = Object.entries(places).map(([name, c]) => {
    const lat = parseFloat(c.lat);
    const lng = parseFloat(c.lng);
    const isOutlier = isNaN(lat) || isNaN(lng) || lat < minLat || lat > maxLat || lng < minLng || lng > maxLng;
    return { name, lat, lng, isOutlier, type: 'places', googleMapsUrl: c.googleMapsUrl };
  });

  const pharmaciesList = Object.entries(pharmacies).map(([name, c]) => {
    const lat = parseFloat(c.lat);
    const lng = parseFloat(c.lng);
    const isOutlier = isNaN(lat) || isNaN(lng) || lat < minLat || lat > maxLat || lng < minLng || lng > maxLng;
    return { name, lat, lng, isOutlier, type: 'pharmacies', googleMapsUrl: c.googleMapsUrl };
  });

  return { placesList, pharmaciesList };
}

// Generate the Editor HTML
function getHtml() {
  const { placesList, pharmaciesList } = loadData();
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Düziçi Harita Editörü & Denetleyici</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      display: flex;
      height: 100vh;
      color: #333;
      overflow: hidden;
    }
    #sidebar {
      width: 400px;
      background: #f8f9fa;
      border-right: 1px solid #dee2e6;
      display: flex;
      flex-direction: column;
      height: 100%;
      z-index: 100;
    }
    #sidebar-header {
      padding: 16px;
      background: #1e3a8a;
      color: white;
    }
    #sidebar-header h2 {
      margin: 0 0 12px 0;
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tabs {
      display: flex;
      background: rgba(255,255,255,0.1);
      padding: 4px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .tab {
      flex: 1;
      padding: 6px 12px;
      text-align: center;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
      border-radius: 4px;
      color: #bfdbfe;
      transition: all 0.2s;
    }
    .tab.active {
      background: white;
      color: #1e3a8a;
    }
    #search-box {
      width: 100%;
      padding: 8px 12px;
      box-sizing: border-box;
      border: 1px solid #ced4da;
      border-radius: 6px;
      outline: none;
      font-size: 13px;
    }
    #places-list {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .place-item {
      padding: 12px 16px;
      border-bottom: 1px solid #e9ecef;
      cursor: pointer;
      transition: background 0.2s;
    }
    .place-item:hover {
      background: #e9ecef;
    }
    .place-item.outlier {
      border-left: 4px solid #dc3545;
      background: #fff5f5;
    }
    .place-item.selected {
      background: #cfe2ff;
      border-left: 4px solid #0d6efd;
    }
    .place-title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 4px;
      word-break: break-word;
    }
    .place-coords {
      font-size: 12px;
      color: #6c757d;
    }
    .badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: bold;
      display: inline-block;
      margin-top: 4px;
    }
    .badge-outlier {
      background: #f8d7da;
      color: #842029;
    }
    #edit-panel {
      padding: 16px;
      background: #fff;
      border-top: 2px solid #dee2e6;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
      display: none;
    }
    #edit-panel h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #495057;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .place-name-display {
      font-weight: bold;
      font-size: 15px;
      color: #1e3a8a;
      margin-bottom: 12px;
    }
    .coord-inputs {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .input-group {
      flex: 1;
    }
    .input-group label {
      display: block;
      font-size: 11px;
      color: #6c757d;
      margin-bottom: 4px;
      font-weight: bold;
    }
    .input-group input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      box-sizing: border-box;
      font-size: 13px;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    .btn {
      flex: 1;
      padding: 8px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      text-align: center;
      border: none;
      text-decoration: none;
    }
    .btn-save {
      background: #198754;
      color: white;
    }
    .btn-save:hover {
      background: #157347;
    }
    .btn-maps {
      background: #e9ecef;
      color: #495057;
      border: 1px solid #ced4da;
    }
    .btn-maps:hover {
      background: #dee2e6;
    }
    #map-container {
      flex: 1;
      position: relative;
    }
    #map {
      width: 100%;
      height: 100%;
    }
    #search-map-container {
      position: absolute;
      top: 10px;
      left: 60px;
      z-index: 1000;
      display: flex;
      gap: 6px;
    }
    #map-search-box {
      width: 250px;
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      outline: none;
      font-size: 13px;
    }
    #map-search-btn {
      padding: 8px 16px;
      background: #0d6efd;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      font-weight: bold;
      font-size: 13px;
    }
    #map-search-btn:hover {
      background: #0b5ed7;
    }
    .notification {
      position: absolute;
      top: 15px;
      right: 15px;
      background: #198754;
      color: white;
      padding: 10px 18px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 2000;
      font-weight: bold;
      display: none;
      animation: fadeIn 0.3s;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>

  <div id="notification" class="notification">✅ Konum Başarıyla Kaydedildi!</div>

  <div id="sidebar">
    <div id="sidebar-header">
      <h2>📍 Düziçi Harita Editörü</h2>
      <div class="tabs">
        <div id="tab-places" class="tab active" onclick="switchTab('places')">Gezi Yerleri</div>
        <div id="tab-pharmacies" class="tab" onclick="switchTab('pharmacies')">Eczaneler</div>
      </div>
      <input type="text" id="search-box" placeholder="Ara..." onkeyup="filterList()">
    </div>
    
    <ul id="places-list">
      <!-- Dynamic List -->
    </ul>

    <div id="edit-panel">
      <h3>📍 KONUMU DÜZENLE</h3>
      <div id="place-name" class="place-name-display">Yer Adı</div>
      
      <div style="font-size: 12px; color: #6c757d; margin-bottom: 12px; line-height: 1.4;">
        💡 Harita üzerindeki mavi pimi sürükleyerek veya haritada bir yere tıklayarak konumu güncelleyebilirsiniz.
      </div>

      <div class="coord-inputs">
        <div class="input-group">
          <label>Enlem (Latitude)</label>
          <input type="number" id="input-lat" step="0.000001" oninput="onInputCoordsChange()">
        </div>
        <div class="input-group">
          <label>Boylam (Longitude)</label>
          <input type="number" id="input-lng" step="0.000001" oninput="onInputCoordsChange()">
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-save" onclick="saveLocation()">Disk'e Kaydet</button>
        <a id="btn-maps-link" href="#" target="_blank" class="btn btn-maps">Maps'te Gör</a>
      </div>
    </div>
  </div>

  <div id="map-container">
    <div id="search-map-container">
      <input type="text" id="map-search-box" placeholder="Haritada adres/mahalle ara...">
      <button id="map-search-btn" onclick="searchAddress()">Git</button>
    </div>
    <div id="map"></div>
  </div>

  <!-- Leaflet JS -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const places = ${JSON.stringify(placesList)};
    const pharmacies = ${JSON.stringify(pharmaciesList)};
    
    let currentTab = 'places';
    let currentItems = places;
    let selectedIndex = null;
    let activeMarker = null;
    let searchMarker = null;

    const map = L.map('map').setView([37.24, 36.45], 13); // Center of Düziçi
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Map click handler to relocate selected marker
    map.on('click', function(e) {
      if (selectedIndex === null) return;
      updateMarkerPosition(e.latlng.lat, e.latlng.lng);
    });

    const listElement = document.getElementById('places-list');

    function switchTab(tab) {
      currentTab = tab;
      document.getElementById('tab-places').classList.toggle('active', tab === 'places');
      document.getElementById('tab-pharmacies').classList.toggle('active', tab === 'pharmacies');
      currentItems = tab === 'places' ? places : pharmacies;
      selectedIndex = null;
      document.getElementById('edit-panel').style.display = 'none';
      if (activeMarker) {
        map.removeLayer(activeMarker);
        activeMarker = null;
      }
      if (searchMarker) {
        map.removeLayer(searchMarker);
        searchMarker = null;
      }
      document.getElementById('search-box').value = '';
      renderList();
    }

    function renderList() {
      listElement.innerHTML = '';
      currentItems.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'place-item' + (item.isOutlier ? ' outlier' : '');
        li.id = 'item-' + index;
        li.onclick = () => selectItem(index);
        
        li.innerHTML = \`
          <div class="place-title">\${item.name}</div>
          <div class="place-coords">\${item.lat}, \${item.lng}</div>
          \${item.isOutlier ? '<span class="badge badge-outlier">Olası Hata (Bölge Dışı)</span>' : ''}
        \`;
        listElement.appendChild(li);
      });
    }

    function selectItem(index) {
      if (selectedIndex !== null) {
        document.getElementById('item-' + selectedIndex)?.classList.remove('selected');
      }
      
      selectedIndex = index;
      const item = currentItems[index];
      
      document.getElementById('item-' + index)?.classList.add('selected');
      
      // Update inputs
      document.getElementById('place-name').innerText = item.name;
      document.getElementById('input-lat').value = item.lat.toFixed(6);
      document.getElementById('input-lng').value = item.lng.toFixed(6);
      document.getElementById('btn-maps-link').href = \`https://www.google.com/maps/search/?api=1&query=\${item.lat},\&lng=\${item.lng}\`;
      document.getElementById('edit-panel').style.display = 'block';

      // Place Marker
      if (activeMarker) map.removeLayer(activeMarker);

      activeMarker = L.marker([item.lat, item.lng], { draggable: true }).addTo(map);
      activeMarker.bindPopup(\`<b>\${item.name}</b><br>Konumu değiştirmek için sürükleyin.\`).openPopup();

      activeMarker.on('drag', function(e) {
        const pos = activeMarker.getLatLng();
        document.getElementById('input-lat').value = pos.lat.toFixed(6);
        document.getElementById('input-lng').value = pos.lng.toFixed(6);
      });

      activeMarker.on('dragend', function(e) {
        const pos = activeMarker.getLatLng();
        updateMarkerPosition(pos.lat, pos.lng);
      });

      map.setView([item.lat, item.lng], 16);
    }

    function updateMarkerPosition(lat, lng) {
      if (!activeMarker) return;
      activeMarker.setLatLng([lat, lng]);
      document.getElementById('input-lat').value = lat.toFixed(6);
      document.getElementById('input-lng').value = lng.toFixed(6);
      document.getElementById('btn-maps-link').href = \`https://www.google.com/maps/search/?api=1&query=\${lat.toFixed(6)},\${lng.toFixed(6)}\`;
    }

    function onInputCoordsChange() {
      const lat = parseFloat(document.getElementById('input-lat').value);
      const lng = parseFloat(document.getElementById('input-lng').value);
      if (!isNaN(lat) && !isNaN(lng)) {
        updateMarkerPosition(lat, lng);
      }
    }

    function filterList() {
      const query = document.getElementById('search-box').value.toLowerCase();
      currentItems.forEach((item, index) => {
        const match = item.name.toLowerCase().includes(query);
        const el = document.getElementById('item-' + index);
        if (el) el.style.display = match ? 'block' : 'none';
      });
    }

    async function searchAddress() {
      const query = document.getElementById('map-search-box').value;
      if (!query.trim()) return;
      
      const btn = document.getElementById('map-search-btn');
      btn.innerText = 'Aranıyor...';
      btn.disabled = true;

      try {
        const res = await fetch(\`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(query + ', Düziçi, Osmaniye')}&limit=1\`);
        const results = await res.json();
        if (results && results.length > 0) {
          const hit = results[0];
          const lat = parseFloat(hit.lat);
          const lng = parseFloat(hit.lon);
          
          if (searchMarker) map.removeLayer(searchMarker);
          
          searchMarker = L.circleMarker([lat, lng], { color: 'red', radius: 10 }).addTo(map);
          searchMarker.bindPopup(\`<b>Arama Sonucu:</b> \${hit.display_name}<br><button onclick="moveSelectedHere(\${lat}, \${lng})" style="margin-top:6px; cursor:pointer;">Seçili Yeri Buraya Taşı</button>\`).openPopup();
          
          map.setView([lat, lng], 15);
        } else {
          alert('Adres bulunamadı! Lütfen mahalle veya cadde adını netleştirin.');
        }
      } catch (err) {
        alert('Arama hatası: ' + err.message);
      } finally {
        btn.innerText = 'Git';
        btn.disabled = false;
      }
    }

    function moveSelectedHere(lat, lng) {
      if (selectedIndex === null) {
        alert('Lütfen önce sol menüden değiştirmek istediğiniz yeri seçin!');
        return;
      }
      updateMarkerPosition(lat, lng);
      if (searchMarker) {
        map.removeLayer(searchMarker);
        searchMarker = null;
      }
    }

    async function saveLocation() {
      if (selectedIndex === null) return;
      const item = currentItems[selectedIndex];
      const lat = parseFloat(document.getElementById('input-lat').value);
      const lng = parseFloat(document.getElementById('input-lng').value);

      if (isNaN(lat) || isNaN(lng)) {
        alert('Geçersiz koordinat değeri!');
        return;
      }

      try {
        const res = await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: currentTab,
            name: item.name,
            lat: lat,
            lng: lng
          })
        });
        const result = await res.json();
        if (result.success) {
          // Update local state
          item.lat = lat;
          item.lng = lng;
          item.isOutlier = false; // Reset warning
          
          // Re-render
          renderList();
          document.getElementById('item-' + selectedIndex)?.classList.add('selected');
          
          // Show Toast notification
          const toast = document.getElementById('notification');
          toast.style.display = 'block';
          setTimeout(() => { toast.style.display = 'none'; }, 3000);
        } else {
          alert('Kayıt başarısız: ' + result.error);
        }
      } catch (err) {
        alert('Bağlantı hatası: ' + err.message);
      }
    }

    // Init list
    renderList();
  </script>
</body>
</html>`;
}

// Start local HTTP server
const PORT = 3000;
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtml());
  } else if (req.method === 'GET' && req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
  } else if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { type, name, lat, lng } = payload;
        
        if (!type || !name || isNaN(lat) || isNaN(lng)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Geçersiz parametreler' }));
          return;
        }

        const fileData = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));
        if (!fileData[type]) fileData[type] = {};
        
        // Update data
        fileData[type][name] = {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`
        };

        // Write map_corrections.json
        fs.writeFileSync(correctionsPath, JSON.stringify(fileData, null, 2) + '\n', 'utf8');
        console.log(`\n💾 map_corrections.json güncellendi: ${name} -> [${lat.toFixed(6)}, ${lng.toFixed(6)}]`);

        // Synchronize directly with Flutter asset JSONs
        if (type === 'places') {
          const placeCoordsPath = path.resolve(__dirname, '../../assets/data/place_coords.json');
          fs.writeFileSync(placeCoordsPath, JSON.stringify({ places: fileData.places }, null, 2) + '\n', 'utf8');
          console.log(`💾 assets/data/place_coords.json güncellendi!`);
        } else if (type === 'pharmacies') {
          const pharmacyCoordsPath = path.resolve(__dirname, '../../assets/data/pharmacy_coords.json');
          fs.writeFileSync(pharmacyCoordsPath, JSON.stringify({ pharmacies: fileData.pharmacies }, null, 2) + '\n', 'utf8');
          console.log(`💾 assets/data/pharmacy_coords.json güncellendi!`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Kayıt Hatası:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log('🚀 DÜZİÇİ HARİTA EDİTÖRÜ HİZMETE HAZIR!');
  console.log(`\n👉 Web panelini açmak için tarayıcınızda şu adrese gidin:`);
  console.log(`   http://localhost:${PORT}`);
  console.log('====================================================');
  console.log('Kapatmak için: Terminalde Ctrl + C tuşlarına basın.');
  console.log('----------------------------------------------------');
});
