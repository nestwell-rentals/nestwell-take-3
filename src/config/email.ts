import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

/**
 * Sends email over SMTP when SMTP_HOST is set (password resets, form notifications, ...).
 * Without it, Payload writes outgoing emails to the server log instead.
 */
export const email = process.env.SMTP_HOST
  ? nodemailerAdapter({
      defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@example.com',
      defaultFromName: process.env.EMAIL_FROM_NAME || 'Payload',
      transportOptions: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      },
    })
  : undefined
