import sgMail from '@sendgrid/mail';

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.FRONTEND_URL_PRODUCTION 
  : process.env.FRONTEND_URL || 'http://localhost:3000';

// Assure-toi que la clé API est définie dans tes variables d'environnement
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class EmailService {
  /**
   * Envoie un email de vérification lors de l'inscription
   */
  async sendVerificationEmail(userEmail, userName, verificationToken) {
    try {
      const verificationUrl = `${BASE_URL}/verify-email?token=${verificationToken}`;

      const msg = {
        to: userEmail,
        from: process.env.SUPPORT_EMAIL || 'no-reply@webai.com',
        subject: 'Vérifiez votre adresse email - Web AI',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0; }
              .container { max-width: 600px; margin:0 auto; padding:20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:40px 30px; text-align:center; border-radius:10px 10px 0 0; }
              .header h1 { margin:0; font-size:28px; }
              .content { background:#f9f9f9; padding:40px 30px; border-radius:0 0 10px 10px; }
              .button-container { text-align:center; margin:30px 0; }
              .button { display:inline-block; padding:15px 40px; background:#667eea; color:white !important; text-decoration:none; border-radius:5px; font-weight:bold; font-size:16px; }
              .button:hover { background:#5568d3; }
              .info-box { background:white; border-left:4px solid #667eea; padding:15px; margin:20px 0; border-radius:4px; }
              .footer { text-align:center; color:#666; font-size:12px; margin-top:30px; padding-top:20px; border-top:1px solid #ddd; }
              .alternative-link { color:#667eea; word-break:break-all; font-size:12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Vérification de votre email</h1>
              </div>
              <div class="content">
                <p>Bonjour <strong>${userName}</strong>,</p>
                <p>Merci de vous être inscrit sur <strong>Web AI</strong> !</p>
                <p>Pour finaliser votre inscription et accéder à votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
                <div class="button-container">
                  <a href="${verificationUrl}" class="button">Vérifier mon email</a>
                </div>
                <div class="info-box">
                  <p style="margin:0; font-size:14px;">
                    <strong>Note importante :</strong> Ce lien est valide pendant 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
                  </p>
                </div>
                <p style="margin-top:30px; font-size:14px; color:#666;">
                  <strong>Le bouton ne fonctionne pas ?</strong><br>
                  Copiez et collez ce lien dans votre navigateur :
                </p>
                <p class="alternative-link">${verificationUrl}</p>
              </div>
              <div class="footer">
                <p>Besoin d'aide ? Contactez-nous à <a href="mailto:${process.env.SUPPORT_EMAIL || 'rovarobel30@gmail.com'}">${process.env.SUPPORT_EMAIL || 'rovarobel30@gmail.com'}</a></p>
                <p>&copy; ${new Date().getFullYear()} Web AI. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await sgMail.send(msg);
      console.log(`📧 Email de vérification envoyé à ${userEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi email de vérification:', error);
      return false;
    }
  }

  /**
   * Envoie un code d'activation pour un plan payant
   */
  async sendActivationCode(userEmail, userName, activationCode, planName, durationDays) {
    try {
      const msg = {
        to: userEmail,
        from: process.env.SUPPORT_EMAIL || 'no-reply@startup.com',
        subject: `Code d'activation - ${planName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0; }
              .container { max-width: 600px; margin:0 auto; padding:20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:30px; text-align:center; border-radius:10px 10px 0 0; }
              .content { background:#f9f9f9; padding:30px; border-radius:0 0 10px 10px; }
              .code-box { background:white; border:2px dashed #667eea; padding:20px; text-align:center; margin:20px 0; border-radius:8px; }
              .code { font-size:32px; font-weight:bold; color:#667eea; letter-spacing:5px; }
              .button { display:inline-block; padding:12px 30px; background:#667eea; color:white; text-decoration:none; border-radius:5px; margin:20px 0; }
              .footer { text-align:center; color:#666; font-size:12px; margin-top:20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Bienvenue chez Web AI</h1>
              </div>
              <div class="content">
                <p>Bonjour <strong>${userName}</strong>,</p>
                <p>Félicitations ! Votre abonnement <strong>${planName}</strong> a été approuvé.</p>
                <div class="code-box">
                  <p style="margin:0 0 10px 0; color:#666;">Votre code d'activation :</p>
                  <div class="code">${activationCode}</div>
                </div>
                <p><strong>Durée de validité :</strong> ${durationDays} jours</p>
                <p style="color:#666; font-size:14px; margin-top:30px;">
                  <strong>Important :</strong> Ce code est personnel et confidentiel. Ne le partagez avec personne.
                </p>
              </div>
              <div class="footer">
                <p>Besoin d'aide ? Contactez-nous à ${process.env.SUPPORT_EMAIL || 'rovarobel30@gmail.com'}</p>
                <p>&copy; ${new Date().getFullYear()} Web AI. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await sgMail.send(msg);
      console.log(`📧 Email d'activation envoyé à ${userEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi email d\'activation:', error);
      return false;
    }
  }
}

export default new EmailService();
