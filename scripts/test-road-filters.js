const { isValidRoadClosureRecord } = require('../src/services/roadClosureFilters');

const cases = [
  {
    label: 'Adana ceza',
    item: {
      title: "Adana'da trafik uygulamasında 274 motosiklet sürücüsüne para cezası",
      kind: 'news',
      source: 'Google News',
    },
    expect: false,
  },
  {
    label: 'Sakarya bayram',
    item: {
      title: 'Otoyollarda Bayram Yoğunluğu Sakarya Geçişinde araç kuyrukları',
      kind: 'news',
      source: 'Google News Düziçi Yol',
    },
    expect: false,
  },
  {
    label: 'Trafik komisyonu',
    item: {
      title: 'İl Trafik Komisyonu Kararı (2025/27)',
      subtitle: 'İrfanlı güzergah',
      kind: 'municipality',
      source: 'BELEDİYE DUYURUSU',
    },
    expect: true,
  },
  {
    label: 'Sulama kapali sistem',
    item: {
      title: 'Bostanlar Köyü Kapalı Sistem Sulama Altyapısı Hizmete Hazır',
      kind: 'municipality',
      source: 'BELEDİYE DUYURUSU',
    },
    expect: false,
  },
  {
    label: 'Bulvar yenileniyor',
    item: {
      title: 'Recep Tayyip Erdoğan Bulvarı Yenileniyor',
      subtitle: 'asfalt çalışması Düziçi',
      kind: 'municipality',
      source: 'BELEDİYE DUYURUSU',
    },
    expect: true,
  },
];

let ok = true;
for (const c of cases) {
  const got = isValidRoadClosureRecord(c.item);
  const pass = got === c.expect;
  console.log(`${pass ? 'OK' : 'FAIL'} ${c.label}: ${got}`);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
