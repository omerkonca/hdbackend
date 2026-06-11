const nodemailer = require('nodemailer');

const CATEGORY_LABELS = {
  problem: 'Sorun / Arıza',
  suggestion: 'Öneri',
  tip: 'Tavsiye',
  other: 'Diğer',
};

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getNotifyEmail() {
  return process.env.NOTIFY_EMAIL || 'hepsiduzici@gmail.com';
}

function buildTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildHtml(report) {
  const category = CATEGORY_LABELS[report.category] || report.category;
  const photos = (report.image_urls || [])
    .map((url, i) => {
      const full = url.startsWith('http') ? url : `https://hdbackend-vo99.onrender.com${url}`;
      return `<li><a href="${full}">Fotoğraf ${i + 1}</a></li>`;
    })
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px">
      <h2 style="color:#0F2744">Yeni İhbar / Öneri</h2>
      <p><strong>Tür:</strong> ${category}</p>
      <p><strong>Tarih:</strong> ${new Date(report.created_at).toLocaleString('tr-TR')}</p>
      <p><strong>Platform:</strong> ${report.platform || '-'} · v${report.app_version || '-'}</p>
      <hr/>
      <p style="white-space:pre-wrap;line-height:1.5">${report.message}</p>
      <hr/>
      <p><strong>İsim:</strong> ${report.contact_name || 'Belirtilmedi'}</p>
      <p><strong>E-posta:</strong> ${report.contact_email || 'Belirtilmedi'}</p>
      ${photos ? `<p><strong>Fotoğraflar:</strong></p><ul>${photos}</ul>` : '<p>Fotoğraf yok.</p>'}
      <p style="color:#666;font-size:12px">Hepsi Düziçi · Bildirim ID: ${report.id}</p>
    </div>
  `;
}

async function sendCitizenReportEmail(report) {
  if (!isSmtpConfigured()) {
    console.warn('[email] SMTP yapılandırılmamış — bildirim maili gönderilmedi.');
    return false;
  }

  const to = getNotifyEmail();
  const category = CATEGORY_LABELS[report.category] || report.category;
  const transporter = buildTransporter();

  await transporter.sendMail({
    from: `"Hepsi Düziçi" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    replyTo: report.contact_email || undefined,
    subject: `[Hepsi Düziçi] Yeni ${category}`,
    text: [
      `Tür: ${category}`,
      `Mesaj: ${report.message}`,
      `İsim: ${report.contact_name || '-'}`,
      `E-posta: ${report.contact_email || '-'}`,
      `Fotoğraflar: ${(report.image_urls || []).join(', ') || '-'}`,
    ].join('\n'),
    html: buildHtml(report),
  });

  console.log(`[email] İhbar bildirimi gönderildi → ${to}`);
  return true;
}

module.exports = {
  sendCitizenReportEmail,
  isSmtpConfigured,
  getNotifyEmail,
};
