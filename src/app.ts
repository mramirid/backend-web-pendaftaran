import Path from 'path';

import ejs from 'ejs';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';

const app = express();

app.use(bodyParser.json());
app.use(helmet());
app.use(cors());

dotenv.config();

/*
 * EmailSendedResponse adalah struktur response data balikan dari Gmail API
 * ketika email konfirmasi berhasil dikirim
 */
type EmailSendedResponse = {
  accepted: string[];
  rejected: string[];
  envelopeTime: number;
  messageTime: number;
  messageSize: number;
  response: string;
  envelope: {
    from: string;
    to: string[];
  };
  messageId: string;
};

/*
 * RegConfirmBody adalah struktur request body yang akan dikirim oleh frontend
 * ke backend ketika user melakukan pendaftaran (untuk mengirim email konfirmasi)
 *
 * Struktur RegConfirmBody disini HARUS MIRIP dengan
 * struktur RegConfirmBody yang ada di projek frontend
 */
type RegConfirmBody = {
  destEmail: string;
  confirmationURL: string;
};

/*
 * Gmailer Middleware
 * Berisikan kode untuk melakukan pengiriman email konfirmasi pendaftaran kepada
 * member baru melalui Gmail API.
 *
 * Adapun akun gmail yang digunakan untuk mengirim email adalah akun gmail yang
 * anda telah anda set konfigurasi API nya.
 * Silahkan lihat tata cara buat dapetin akses ke APInya dengan
 * membaca file CATATAN_GMAIL_MAILER.md di root folder. Jangan lupa set .env nya
 */
app.use(async (req, res) => {
  try {
    const { destEmail, confirmationURL } = req.body as RegConfirmBody;

    const emailTemplate = await ejs.renderFile(
      Path.join(__dirname, '/templates/confirmation.ejs'),
      { confirmationURL },
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_EMAIL,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: process.env.GMAIL_ACCESS_TOKEN,
      },
    });

    transporter
      .sendMail({
        from: process.env.MAILGUN_SENDER,
        to: destEmail,
        subject: 'Konfirmasi Pendaftaran KoLU',
        html: emailTemplate,
      })
      .then(
        (infoSended: EmailSendedResponse) => {
          res.status(200).json({
            message:
              'Silahkan cek emailmu untuk melakukan konfirmasi pendaftaran. Jika tidak ada, mohon cek spam atau hubungi admin',
            moreInfo: infoSended,
          });
        },
        (infoRejected) => {
          /*
           * Sepertinya pengiriman email tidak mungkin gagal
           * karena gmail bakal selalu ngirim email walaupun email tujuan salah
           * Jadi kode ini tidak guna.
           *
           * Mungkin bakal berguna kalau kamu pakai 3rd party mailer lain
           * seperti Mailgun, dll.
           */
          res.status(400).json({
            message:
              'Tidak dapat mengirim konfirmasi pendaftaran ke email anda! Coba lagi nanti',
            moreInfo: infoRejected,
          });
        },
      )
      .catch((error) => {
        res.status(500).json({
          message: 'Terjadi kesalahan di sisi server!',
          moreInfo: error,
        });
      });
  } catch (err: any) {
    res.status(400).send({
      message: err.message || 'An error occurred',
    });
  }
});

app.listen(8080);
