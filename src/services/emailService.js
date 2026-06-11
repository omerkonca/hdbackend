const nodemailer = require('nodemailer');

const CATEGORY_LABELS = {
  problem: 'Sorun / Arıza',
  suggestion: 'Öneri',
  tip: 'Tavsiye',
  other: 'Diğer',
};

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
  return isBrevoConfigured() || isResendConfigured() || isSmtpConfigured();
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

  if (isBrevoConfigured()) {
    const result = await sendViaBrevo({ to, subject, html, text, replyTo });
    console.log(`[email] Brevo ile gönderildi → ${to} (id: ${result.id || '-'})`);
    return { ok: true, ...result };
  }

  if (isResendConfigured()) {
    const result = await sendViaResend({ to, subject, html, text, replyTo });
    console.log(`[email] Resend ile gönderildi → ${to} (id: ${result.id || '-'})`);
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
          detail:
            'Render ücretsiz planda SMTP portları kapalı. BREVO_API_KEY veya RESEND_API_KEY kullanın.',
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
  const provider = isBrevoConfigured()
    ? 'brevo'
    : isResendConfigured()
      ? 'resend'
      : isSmtpConfigured()
        ? 'smtp'
        : null;

  return {
    emailConfigured: isEmailConfigured(),
    provider,
    brevoConfigured: isBrevoConfigured(),
    resendConfigured: isResendConfigured(),
    smtpConfigured: isSmtpConfigured(),
    fromAddress: getFromAddress(),
    notifyEmail: getNotifyEmail(),
    resendHint:
      'Resend onboarding@resend.dev yalnızca Resend hesap e-postasına gider; spam klasörünü kontrol edin.',
    brevoHint:
      'Gmail kutusuna güvenilir teslimat için Brevo + doğrulanmış gönderici önerilir.',
    renderSmtpBlockedHint:
      'Render ücretsiz planda SMTP (587/465) engellenir.',
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
