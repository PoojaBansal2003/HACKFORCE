import nodemailer, { Transporter } from "nodemailer";

require("dotenv").config({ path: "../config/config.env" });
import path from "path";

import ejs from "ejs";

interface EmailOption {
  email: string;
  subject: string;
  data: { [key: string]: any };
  template: string;
}

const sendMail = async (options: EmailOption): Promise<void> => {
  try {
    const tranporter: Transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      service: process.env.SMTP_SERVICE,
      auth: {
        user: process.env.SMTP_MAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const { email, subject, data, template } = options;

    // get the path to the email template file
    const templatePath = path.join(__dirname, "../templates", template);

    // Render the email template with EJS
    const html: string = await ejs.renderFile(templatePath, data);

    /* Mail Option to whom you have to send || content need to send */
    const mailOptions = {
      from: process.env.SMTP_MAIL,
      to: email,
      subject,
      html,
    };

    await tranporter.sendMail(mailOptions);
  } catch (error: any) {
    throw new Error("Cant Able to send mail || Error Occured = " + error);
  }
};
export default sendMail;
