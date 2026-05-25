/**
 * Email Service — Nodemailer
 * All transactional emails sent by NexusCRM
 */

'use strict';

const nodemailer = require('nodemailer');
const logger = require('./logger');

const createTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

const FROM = process.env.EMAIL_FROM || 'NexusCRM <noreply@nexuscrm.io>';

const baseTemplate = (title, bodyHTML) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
    .header { background: #2563EB; padding: 28px 32px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 28px 32px; color: #374151; line-height: 1.6; font-size: 14px; }
    .btn { display: inline-block; background: #2563EB; color: #fff; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0; }
    .footer { background: #f1f5f9; padding: 16px 32px; font-size: 12px; color: #94a3b8; text-align: center; }
    .badge { display: inline-block; background: #EFF6FF; color: #1D4ED8; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    table.info { width: 100%; border-collapse: collapse; margin: 12px 0; }
    table.info td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    table.info td:first-child { color: #6b7280; width: 130px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>⚡ NexusCRM</h1></div>
    <div class="body">
      <h2 style="margin-top:0;font-size:18px;color:#111827">${title}</h2>
      ${bodyHTML}
    </div>
    <div class="footer">© ${new Date().getFullYear()} NexusCRM · This is an automated message, please do not reply.</div>
  </div>
</body>
</html>`;

const send = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn(`[EmailService] SMTP not configured — skipping email to ${to}: "${subject}"`);
    return;
  }
  const transporter = createTransport();
  const info = await transporter.sendMail({ from: FROM, to, subject, html });
  logger.info(`[EmailService] Email sent to ${to}: ${info.messageId}`);
  return info;
};

// ── Welcome / password reset ──────────────────────────────────────────────────

exports.sendPasswordReset = (email, name, resetURL) =>
  send({
    to: email,
    subject: 'Reset your NexusCRM password',
    html: baseTemplate('Password Reset Request', `
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below to set a new one:</p>
      <a href="${resetURL}" class="btn">Reset Password</a>
      <p style="color:#6b7280;font-size:12px">This link expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    `),
  });

// ── Lead assignment notification ──────────────────────────────────────────────

exports.sendLeadAssignmentNotification = (lead, assignee, assignedBy) =>
  send({
    to: assignee.email,
    subject: `New lead assigned to you: ${lead.fullName}`,
    html: baseTemplate(`New Lead: ${lead.fullName}`, `
      <p>Hi ${assignee.name},</p>
      <p><strong>${assignedBy.name}</strong> assigned a new lead to you:</p>
      <table class="info">
        <tr><td>Name</td><td><strong>${lead.fullName}</strong></td></tr>
        <tr><td>Company</td><td>${lead.company || '—'}</td></tr>
        <tr><td>Email</td><td>${lead.email}</td></tr>
        <tr><td>Phone</td><td>${lead.phone || '—'}</td></tr>
        <tr><td>Source</td><td><span class="badge">${lead.source}</span></td></tr>
        <tr><td>Status</td><td><span class="badge">${lead.status}</span></td></tr>
      </table>
      ${lead.message ? `<p><strong>Message:</strong><br><em>"${lead.message}"</em></p>` : ''}
      <p>Log in to NexusCRM to view full details and add notes.</p>
    `),
  });

// ── New public contact form lead ──────────────────────────────────────────────

exports.sendNewLeadNotification = (lead, admin) =>
  send({
    to: admin.email,
    subject: `New contact form submission: ${lead.fullName}`,
    html: baseTemplate('New Inquiry Received', `
      <p>Hi ${admin.name},</p>
      <p>A new lead submitted an inquiry through the contact form:</p>
      <table class="info">
        <tr><td>Name</td><td><strong>${lead.fullName}</strong></td></tr>
        <tr><td>Email</td><td>${lead.email}</td></tr>
        <tr><td>Phone</td><td>${lead.phone || '—'}</td></tr>
        <tr><td>Company</td><td>${lead.company || '—'}</td></tr>
        <tr><td>Source</td><td><span class="badge">${lead.source}</span></td></tr>
      </table>
      ${lead.message ? `<p><strong>Message:</strong><br><em>"${lead.message}"</em></p>` : ''}
      <p>Log in to CRM to respond promptly.</p>
    `),
  });
