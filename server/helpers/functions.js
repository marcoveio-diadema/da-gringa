import dotenv from 'dotenv';
dotenv.config();
import { Storage } from '@google-cloud/storage';
import path from 'path';
import sanitizeHtml from 'sanitize-html';
import slugify from 'slugify';

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
  
      // Generate a signed URL for the uploaded file
      const [url] = await uploadedFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 3, // 3 hours
      });
  
      return url;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
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

const config = { uploadImage, customSanitizeHtml, generateSlug };
export default config;