import dotenv from 'dotenv';
dotenv.config();
import { Storage } from '@google-cloud/storage';
import path from 'path';
import sanitizeHtml from 'sanitize-html';
import slugify from 'slugify';
import nodemailer from 'nodemailer';

// Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GCLOUD_CLIENT_EMAIL,
    private_key: process.env.GCLOUD_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

async function uploadImage(file, folderName = '') {
  // Check if file is valid
    if (!file || !file.path) {
      throw new Error('Invalid file object');
  }
    try {
      const bucketName = 'manual_posts_images';
      const filename = file.path;
      let uploadedFile;

      try {
      // Uploads a local file to the bucket
      [uploadedFile] = await storage.bucket(bucketName).upload(filename, {
        destination: folderName + path.basename(filename),
        gzip: true,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Error uploading file');
    }
  
      // Generate the public URL for the uploaded file
      const url = `https://storage.googleapis.com/${bucketName}/${folderName}${path.basename(filename)}`;
  
      return url;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
}

// delete old image and upload new image
async function handleImageUpload(oldImageUrl, newImageFile, directory) {
  let imageUrl;

  // Check if a new image file has been uploaded
  if (newImageFile) {
      // Delete the old image from Google Cloud Storage
      if (oldImageUrl) {
          const oldImageName = oldImageUrl.split('?')[0].split('/').pop();
          await storage.bucket('manual_posts_images').file(directory + oldImageName).delete();
      }

      // Upload the new image to Google Cloud Storage
      imageUrl = await uploadImage(newImageFile, directory);
  } else {
      // Use the existing image URL
      imageUrl = oldImageUrl;
  }

  return imageUrl;
}

// sanitize-html.js
const customSanitizeHtml = (html) => {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
      allowedAttributes: {
        img: ['src', 'alt', 'width', 'height']
      }
    });
};


// slug title
function generateSlug(title) {
    return slugify(title, {
        lower: true,
        strict: true,
        replacement: '-'
    });
}

// email sender
async function sendPasswordResetEmail(userEmail, token) {
    let transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Reinicialização de senha',
        text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n
        https://manual-da-gringa-tcx8.onrender.com/user/reset-password/${token}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    let info = await transporter.sendMail(mailOptions)

    console.log("Message sent: %s", info.messageId);
}

// contact form email sender
async function sendContactEmail(name, email, phone, message) {
    let transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'Nova mensagem recebida',
        text: `Você recebeu um novo formulario de contato:\n\n
        Nome: ${name}\n
        Email: ${email}\n
        Telefone: ${phone}\n
        Mensagem: ${message}\n`
    };

    let info = await transporter.sendMail(mailOptions)

    console.log("Message sent: %s", info.messageId);
}

const config = { uploadImage, customSanitizeHtml, generateSlug, sendPasswordResetEmail, sendContactEmail, handleImageUpload, storage };
export default config;