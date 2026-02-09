import * as emailjs from "emailjs";

const server = emailjs.server.connect({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  host: process.env.EMAIL_HOST,
  ssl: true,
});

export const sendVerificationEmail = async (userName, verificationUrl, toEmail) => {
  try {
    const message = {
      text: `Bonjour ${userName},\n\nMerci de vérifier votre email en cliquant sur ce lien : ${verificationUrl}`,
      from: `Mon App <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Vérification de votre adresse email",
    };

    await server.send(message);
    console.log("✅ Email envoyé avec succès !");
  } catch (err) {
    console.error("❌ Erreur envoi email:", err);
  }
};
