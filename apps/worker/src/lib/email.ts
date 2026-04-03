import { Resend } from 'resend'
import { config } from './config'
import { createLogger } from './logger'

const log = createLogger('email')
const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    log.warn({ to, subject }, 'RESEND_API_KEY not set, skipping')
    return
  }
  const { data, error } = await resend.emails.send({
    from: config.resend.fromEmail,
    to,
    subject,
    html,
  })
  if (error) {
    log.error({ error, to, subject }, 'Email send failed')
  } else {
    log.info({ emailId: data?.id, to }, 'Email sent')
  }
}

// ── Templates ──────────────────────────────────────────

function wrap(body: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;padding:40px;border:1px solid #e5e7eb;"><tr><td>
  <div style="font-size:20px;font-weight:700;margin-bottom:24px;color:#111;">Surgent</div>
  ${body}
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
    Surgent &middot; Build your business with AI
  </div>
</td></tr></table>
</td></tr></table>
</body></html>`
}

function btn(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;padding:12px 28px;background:#000;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">${label}</a>`
}

export function verifyEmailHtml(url: string) {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#111;">Verify your email</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">Thanks for signing up! Click the button below to verify your email address.</p>
    ${btn(url, 'Verify Email')}
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">If you didn't create an account, you can safely ignore this email.</p>`)
}

export function welcomeHtml(name: string, dashboardUrl: string) {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#111;">Welcome to Surgent, ${name}!</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">Your account is ready. Create your first AI-powered website in seconds — just describe your business and we'll handle the rest.</p>
    ${btn(dashboardUrl, 'Create Your First Site')}
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">Questions? Just reply to this email — we read every one.</p>`)
}

export function resetPasswordHtml(url: string) {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#111;">Reset your password</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">Click the button below to reset your password. This link expires in 1 hour.</p>
    ${btn(url, 'Reset Password')}
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">If you didn't request this, you can safely ignore this email.</p>`)
}
