const nodemailer = require('nodemailer');

// Email notifications are optional: without SMTP settings in .env the site
// works exactly as before and inquiries are only stored in the database.
function createNotifier(env = process.env) {
  if (!env.SMTP_HOST || !env.NOTIFY_EMAIL) {
    return { enabled: false, sendInquiryNotification: async () => {} };
  }

  const port = Number(env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
  });

  return {
    enabled: true,
    sendInquiryNotification: async (inquiry) => {
      const lines = [
        `Nom : ${inquiry.name}`,
        `Email : ${inquiry.email}`,
        inquiry.phone ? `Téléphone : ${inquiry.phone}` : null,
        inquiry.propertyRef ? `Bien concerné : #${inquiry.propertyRef}` : null,
        inquiry.projectType ? `Type de projet : ${inquiry.projectType}` : null,
        inquiry.budgetRange ? `Budget : ${inquiry.budgetRange}` : null,
        inquiry.hasPropertyToSell ? `A un bien à vendre : ${inquiry.hasPropertyToSell}` : null,
        '',
        'Message :',
        inquiry.message
      ].filter((l) => l !== null);

      try {
        await transport.sendMail({
          from: env.SMTP_FROM || env.SMTP_USER || env.NOTIFY_EMAIL,
          to: env.NOTIFY_EMAIL,
          subject: inquiry.propertyRef
            ? `EFIELD IMMO — Nouvelle demande pour le bien #${inquiry.propertyRef}`
            : 'EFIELD IMMO — Nouveau message de contact',
          text: lines.join('\n')
        });
      } catch (err) {
        console.error('Inquiry email notification failed:', err.message);
      }
    }
  };
}

module.exports = { createNotifier };
