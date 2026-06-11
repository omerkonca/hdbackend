const nodemailer = require('nodemailer');

const CATEGORY_LABELS = {
  problem: 'Sorun / Arıza',
  suggestion: 'Öneri',
  tip: 'Tavsiye',
  other: 'Diğer',
};

function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function isEmailConfigured() {
  return isResendConfigured() || isSmtpConfigured();
}

function getNotifyEmail() {
  return process.env.NOTIFY_EMAIL || 'hepsiduzici@gmail.com';
}

function getFromAddress() {
  if (isResendConfigured()) {
    return process.env.RESEND_FROM || 'Hepsi Düziçi <onboarding@resend.dev>';
  }
  return `"Hepsi Düziçi" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
}

function buildTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 15000,
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_PASS || '').replace(/\s+/g, ''),
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

function buildText(report) {
  const category = CATEGORY_LABELS[report.category] || report.category;
  return [
    `Tür: ${category}`,
    `Mesaj: ${report.message}`,
    `İsim: ${report.contact_name || '-'}`,
    `E-posta: ${report.contact_email || '-'}`,
    `Fotoğraflar: ${(report.image_urls || []).join(', ') || '-'}`,
  ].join('\n');
}

async function sendViaResend({ to, subject, html, text, replyTo }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo || undefined,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.message || body?.error || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return body;
}

async function sendViaSmtp({ to, subject, html, text, replyTo }) {
  const transporter = buildTransporter();
  await transporter.verify();
  await transporter.sendMail({
    from: getFromAddress(),
    to,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
  });
}

async function deliverEmail({ subject, html, text, replyTo }) {
  const to = getNotifyEmail();

  if (isResendConfigured()) {
    await sendViaResend({ to, subject, html, text, replyTo });
    console.log(`[email] Resend ile gönderildi → ${to}`);
    return { ok: true, provider: 'resend' };
  }

  if (isSmtpConfigured()) {
    try {
      await sendViaSmtp({ to, subject, html, text, replyTo });
      console.log(`[email] SMTP ile gönderildi → ${to}`);
      return { ok: true, provider: 'smtp' };
    } catch (err) {
      const blockedOnRender =
        /ETIMEDOUT|ECONNREFUSED|ETIMEOUT|Network is unreachable/i.test(err.message);
      if (blockedOnRender) {
        return {
          ok: false,
          reason: 'smtp_blocked',
          detail:
            'Render ücretsiz planda SMTP portları kapalı. RESEND_API_KEY ekleyin veya ücretli plana geçin.',
        };
      }
      throw err;
    }
  }

  console.warn('[email] E-posta sağlayıcısı yapılandırılmamış.');
  return { ok: false, reason: 'email_not_configured' };
}

async function sendCitizenReportEmail(report) {
  if (!isEmailConfigured()) {
    return { ok: false, reason: 'email_not_configured' };
  }

  const category = CATEGORY_LABELS[report.category] || report.category;

  try {
    return await deliverEmail({
      subject: `[Hepsi Düziçi] Yeni ${category}`,
      text: buildText(report),
      html: buildHtml(report),
      replyTo: report.contact_email || undefined,
    });
  } catch (err) {
    console.error('[email] İhbar maili gönderilemedi:', err.message);
    return { ok: false, reason: 'send_failed', detail: err.message };
  }
}

async function sendTestEmail() {
  if (!isEmailConfigured()) {
    return { ok: false, reason: 'email_not_configured' };
  }

  try {
    const result = await deliverEmail({
      subject: '[Hepsi Düziçi] Test e-postası',
      text: 'E-posta yapılandırması çalışıyor.',
      html: '<p>E-posta yapılandırması çalışıyor.</p>',
    });
    return { ...result, to: getNotifyEmail() };
  } catch (err) {
    return { ok: false, reason: 'send_failed', detail: err.message };
  }
}

function getEmailStatus() {
  return {
    emailConfigured: isEmailConfigured(),
    provider: isResendConfigured() ? 'resend' : isSmtpConfigured() ? 'smtp' : null,
    resendConfigured: isResendConfigured(),
    smtpConfigured: isSmtpConfigured(),
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpUser: process.env.SMTP_USER || null,
    notifyEmail: getNotifyEmail(),
    renderSmtpBlockedHint:
      'Render ücretsiz planda SMTP (587/465) engellenir; RESEND_API_KEY kullanın.',
  };
}

module.exports = {
  sendCitizenReportEmail,
  sendTestEmail,
  getEmailStatus,
  isEmailConfigured,
  isSmtpConfigured,
  getNotifyEmail,
};
