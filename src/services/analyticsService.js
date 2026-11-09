const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');

class AnalyticsService {
  async getDetailedAnalytics() {
    const db = requireSupabaseAdmin();
    const startTime = Date.now();

    const [tokensRes, subsRes, reportsRes] = await Promise.all([
      db.from('device_tokens').select('platform, created_at, updated_at, mahalle, app_version'),
      db.from('pro_subscriptions').select('*'),
      db.from('citizen_reports').select('id, status, created_at')
    ]);

    if (tokensRes.error) throw new Error(tokensRes.error.message);
    if (subsRes.error) throw new Error(subsRes.error.message);
    if (reportsRes.error) throw new Error(reportsRes.error.message);

    const tokens = tokensRes.data || [];
    const subs = subsRes.data || [];
    const reports = reportsRes.data || [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const d7Ago = now.getTime() - 7 * 86400000;
    const d14Ago = now.getTime() - 14 * 86400000;
    const d30Ago = now.getTime() - 30 * 86400000;

    let iosCount = 0;
    let androidCount = 0;
    let installsToday = 0;
    let installs7d = 0;
    let installs30d = 0;
    let dauToday = 0;
    let wau7d = 0;
    let mau30d = 0;

    const monthlyGrowthMap = {};
    const dailyActiveMap = {};
    const mahallesMap = {};
    const versionsMap = {};

    for (const t of tokens) {
      const isIos = (t.platform || '').toLowerCase() === 'ios';
      if (isIos) iosCount++;
      else androidCount++;

      const cTime = t.created_at ? new Date(t.created_at).getTime() : 0;
      const uTime = t.updated_at ? new Date(t.updated_at).getTime() : cTime;

      if (cTime >= todayStart) installsToday++;
      if (cTime >= d7Ago) installs7d++;
      if (cTime >= d30Ago) installs30d++;

      if (uTime >= todayStart) dauToday++;
      if (uTime >= d7Ago) wau7d++;
      if (uTime >= d30Ago) mau30d++;

      // Monthly registrations
      if (t.created_at) {
        const ym = t.created_at.slice(0, 7);
        if (!monthlyGrowthMap[ym]) monthlyGrowthMap[ym] = { month: ym, total: 0, ios: 0, android: 0 };
        monthlyGrowthMap[ym].total++;
        if (isIos) monthlyGrowthMap[ym].ios++;
        else monthlyGrowthMap[ym].android++;
      }

      // Daily active in last 14 days
      if (uTime >= d14Ago && t.updated_at) {
        const ymd = t.updated_at.slice(0, 10);
        if (!dailyActiveMap[ymd]) dailyActiveMap[ymd] = { date: ymd, count: 0, ios: 0, android: 0 };
        dailyActiveMap[ymd].count++;
        if (isIos) dailyActiveMap[ymd].ios++;
        else dailyActiveMap[ymd].android++;
      }

      // Mahalle
      const m = (t.mahalle || '').trim();
      if (m) {
        mahallesMap[m] = (mahallesMap[m] || 0) + 1;
      }

      // Version
      const v = (t.app_version || '').trim();
      if (v) {
        versionsMap[v] = (versionsMap[v] || 0) + 1;
      }
    }

    const totalDevices = tokens.length;
    const iosPercent = totalDevices > 0 ? Math.round((iosCount / totalDevices) * 100) : 0;
    const androidPercent = totalDevices > 0 ? (100 - iosPercent) : 0;

    // Monthly growth array sorted chronologically
    const monthlyGrowth = Object.values(monthlyGrowthMap).sort((a, b) => a.month.localeCompare(b.month));

    // Daily active array sorted descending
    const dailyActive14d = Object.values(dailyActiveMap).sort((a, b) => b.date.localeCompare(a.date));

    // Top neighborhoods
    const topNeighborhoods = Object.entries(mahallesMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top versions
    const topVersions = Object.entries(versionsMap)
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Subscriptions
    const prodSubs = subs.filter(s => s.is_sandbox === false && s.is_active === true);
    const monthlySubs = prodSubs.filter(s => s.plan === 'monthly');
    const yearlySubs = prodSubs.filter(s => s.plan === 'yearly');
    const totalRev = prodSubs.reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const estMrr = monthlySubs.reduce((acc, s) => acc + Number(s.amount || 0), 0) +
                   yearlySubs.reduce((acc, s) => acc + (Number(s.amount || 0) / 12), 0);

    // Citizen Reports
    const resolvedReports = reports.filter(r => r.status === 'resolved' || r.status === 'dismissed').length;
    const reviewingReports = reports.filter(r => r.status === 'reviewing').length;
    const newReports = reports.filter(r => r.status === 'new').length;
    const totalReports = reports.length;
    const resolutionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 100;

    return {
      ok: true,
      executionMs: Date.now() - startTime,
      devices: {
        total: totalDevices,
        ios: iosCount,
        android: androidCount,
        iosPercent,
        androidPercent,
        installsToday,
        installs7d,
        installs30d,
        estimatedStoreDownloads: Math.round(totalDevices * 1.25),
      },
      activity: {
        dauToday,
        wau7d,
        mau30d,
        dailyActive14d,
      },
      growth: monthlyGrowth,
      subscriptions: {
        activeCount: prodSubs.length,
        monthlyCount: monthlySubs.length,
        yearlyCount: yearlySubs.length,
        totalRevenue: Math.round(totalRev * 100) / 100,
        estMrr: Math.round(estMrr * 100) / 100,
        churnRate: 0,
      },
      reports: {
        total: totalReports,
        resolved: resolvedReports,
        reviewing: reviewingReports,
        newCount: newReports,
        resolutionRate,
      },
      neighborhoods: topNeighborhoods,
      versions: topVersions,
      generatedAt: now.toISOString(),
    };
  }
}

module.exports = new AnalyticsService();

