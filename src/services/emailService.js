const nodemailer = require('nodemailer');

const CATEGORY_LABELS = {
  problem: 'Sorun / Arıza',
  suggestion: 'Öneri',
  tip: 'Tavsiye',
  other: 'Diğer',
};

/** Önerilen: kendi Gmail hesabın + Apps Script (ücretsiz, yeni kayıt yok). */
function isGmailWebhookConfigured() {
  return Boolean(process.env.GMAIL_WEBHOOK_URL && process.env.GMAIL_WEBHOOK_SECRET);
}

function isBrevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY);
}

function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function isEmailConfigured() {
  return (
    isGmailWebhookConfigured() ||
    isBrevoConfigured() ||
    isResendConfigured() ||
    isSmtpConfigured()
  );
}

function getNotifyEmail() {
  return String(process.env.NOTIFY_EMAIL || 'hepsiduzici@gmail.com').trim();
}

function getFromAddress() {
  if (isBrevoConfigured()) {
    return process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || 'hepsiduzici@gmail.com';
  }
  if (isResendConfigured()) {
    return process.env.RESEND_FROM || 'onboarding@resend.dev';
  }
  return process.env.SMTP_FROM || process.env.SMTP_USER;
}

function getFromName() {
  return process.env.EMAIL_FROM_NAME || 'Hepsi Duzici';
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
  const isPlus = report.is_plus === true;
  const isSupporter = report.is_supporter === true;
  const userBadge = report.user_badge || (isPlus && isSupporter ? '👑 Plus & Destekçi' : (isPlus ? '👑 Plus Üye' : (isSupporter ? '🎖️ Destekçi' : null)));

  const photos = (report.image_urls || [])
    .map((url, i) => {
      const full = url.startsWith('http') ? url : `https://hdbackend-vo99.onrender.com${url}`;
      return `<li><a href="${full}">Fotoğraf ${i + 1}</a></li>`;
    })
    .join('');

  const vipBadgeHtml = userBadge
    ? `<div style="display:inline-block;background:#FEF3C7;border:1.5px solid #F59E0B;color:#92400E;font-weight:bold;padding:6px 12px;border-radius:8px;font-size:13px;margin-bottom:12px">⭐ ${userBadge} — ÖNCELİKLİ İHBAR</div>`
    : '';

  const locUrl = report.location_url || (report.latitude && report.longitude ? `https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}` : null);
  const locationHtml = (report.address || locUrl)
    ? `<div style="background:#EFF6FF;border:1px solid #BFDBFE;padding:10px 14px;border-radius:8px;margin:12px 0">
        <p style="margin:0 0 6px 0;font-weight:bold;color:#1E40AF">📍 Olay Yeri / Konum Bilgisi:</p>
        ${report.address ? `<p style="margin:0 0 6px 0;color:#1E293B"><strong>Açık Adres:</strong> ${report.address}</p>` : ''}
        ${locUrl ? `<p style="margin:0"><a href="${locUrl}" target="_blank" style="display:inline-block;background:#2563EB;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:12px">🗺️ Google Haritalarda Aç</a></p>` : ''}
       </div>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px">
      <h2 style="color:#0F2744">Yeni İhbar / Öneri</h2>
      ${vipBadgeHtml}
      <p><strong>Tür:</strong> ${category}</p>
      <p><strong>Tarih:</strong> ${new Date(report.created_at).toLocaleString('tr-TR')}</p>
      <p><strong>Platform:</strong> ${report.platform || '-'} · v${report.app_version || '-'}</p>
      ${locationHtml}
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
  const isPlus = report.is_plus === true;
  const isSupporter = report.is_supporter === true;
  const userBadge = report.user_badge || (isPlus && isSupporter ? '👑 Plus & Destekçi' : (isPlus ? '👑 Plus Üye' : (isSupporter ? '🎖️ Destekçi' : '')));
  const locUrl = report.location_url || (report.latitude && report.longitude ? `https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}` : '');

  return [
    userBadge ? `[⭐ ${userBadge} - ÖNCELİKLİ İHBAR]` : '',
    `Tür: ${category}`,
    report.address ? `Adres: ${report.address}` : '',
    locUrl ? `Harita: ${locUrl}` : '',
    `Mesaj: ${report.message}`,
    `İsim: ${report.contact_name || '-'}`,
    `E-posta: ${report.contact_email || '-'}`,
    `Fotoğraflar: ${(report.image_urls || []).join(', ') || '-'}`,
  ].filter(Boolean).join('\n');
}

async function sendViaGmailWebhook({ to, subject, html, text, replyTo }) {
  const response = await fetch(process.env.GMAIL_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.GMAIL_WEBHOOK_SECRET,
      to,
      subject,
      html,
      text,
      replyTo: replyTo || undefined,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const detail = body?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return { id: body?.id || null, provider: 'gmail-webhook' };
}

async function sendViaBrevo({ to, subject, html, text, replyTo }) {
  const fromEmail = getFromAddress();
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: getFromName(), email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      replyTo: replyTo ? { email: replyTo } : undefined,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.message || body?.error || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return { id: body?.messageId || null, provider: 'brevo' };
}

async function sendViaResend({ to, subject, html, text, replyTo }) {
  const from = getFromAddress();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from.includes('<') ? from : `${getFromName()} <${from}>`,
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
  return { id: body?.id || null, provider: 'resend' };
}

async function sendViaSmtp({ to, subject, html, text, replyTo }) {
  const transporter = buildTransporter();
  await transporter.verify();
  const info = await transporter.sendMail({
    from: `"${getFromName()}" <${getFromAddress()}>`,
    to,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
  });
  return { id: info?.messageId || null, provider: 'smtp' };
}

async function deliverEmail({ subject, html, text, replyTo }) {
  const to = getNotifyEmail();

  if (isGmailWebhookConfigured()) {
    const result = await sendViaGmailWebhook({ to, subject, html, text, replyTo });
    console.log(`[email] Gmail (Apps Script) ile gönderildi → ${to}`);
    return { ok: true, ...result };
  }

  if (isBrevoConfigured()) {
    const result = await sendViaBrevo({ to, subject, html, text, replyTo });
    console.log(`[email] Brevo ile gönderildi → ${to}`);
    return { ok: true, ...result };
  }

  if (isResendConfigured()) {
    const result = await sendViaResend({ to, subject, html, text, replyTo });
    console.log(`[email] Resend ile gönderildi → ${to}`);
    return { ok: true, ...result };
  }

  if (isSmtpConfigured()) {
    try {
      const result = await sendViaSmtp({ to, subject, html, text, replyTo });
      console.log(`[email] SMTP ile gönderildi → ${to}`);
      return { ok: true, ...result };
    } catch (err) {
      const blockedOnRender =
        /ETIMEDOUT|ECONNREFUSED|ETIMEOUT|ENETUNREACH|Network is unreachable/i.test(err.message);
      if (blockedOnRender) {
        return {
          ok: false,
          reason: 'smtp_blocked',
          detail: 'Render ücretsiz planda SMTP kapalı. GMAIL_WEBHOOK_URL kullanın (docs/IHBAR_EPOSTA_KURULUM.md).',
        };
      }
      throw err;
    }
  }

  console.warn('[email] E-posta yapılandırılmamış.');
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
  const provider = isGmailWebhookConfigured()
    ? 'gmail-webhook'
    : isBrevoConfigured()
      ? 'brevo'
      : isResendConfigured()
        ? 'resend'
        : isSmtpConfigured()
          ? 'smtp'
          : null;

  return {
    emailConfigured: isEmailConfigured(),
    provider,
    recommended: 'gmail-webhook',
    gmailWebhookConfigured: isGmailWebhookConfigured(),
    brevoConfigured: isBrevoConfigured(),
    resendConfigured: isResendConfigured(),
    smtpConfigured: isSmtpConfigured(),
    notifyEmail: getNotifyEmail(),
    hint: isGmailWebhookConfigured()
      ? 'Gmail Apps Script aktif — en güvenilir ücretsiz yol.'
      : 'GMAIL_WEBHOOK_URL + GMAIL_WEBHOOK_SECRET ekleyin (yeni kayıt gerekmez).',
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
