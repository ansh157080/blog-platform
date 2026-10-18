const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// Configure disk storage with unique, sanitized filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
    const randomHex = crypto.randomBytes(8).toString('hex');
    const uniqueFilename = `post-${Date.now()}-${randomHex}${safeExt}`;
    cb(null, uniqueFilename);
  }
});

// File filter validation
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isValidMime = ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase());
  const isValidExt = ALLOWED_EXTENSIONS.has(ext);

  if (isValidMime && isValidExt) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  },
  fileFilter
});

/**
 * Middleware wrapper for single image upload with user-friendly error handling
 */
function handleImageUpload(req, res, next) {
  const uploadSingle = upload.single('image');

  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the 5 MB limit. Please choose a smaller image.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading image.'
      });
    }
    next();
  });
}

/**
 * Safely delete an uploaded file without path traversal
 * @param {string} imageUrl - e.g. "/uploads/post-12345.jpg"
 */
async function deleteUploadedImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return;

  // Only handle files in the /uploads/ path
  if (!imageUrl.startsWith('/uploads/')) return;

  try {
    // Strip query strings if any, then get strict basename
    const cleanPath = imageUrl.split('?')[0];
    const filename = path.basename(cleanPath);

    // Ensure it's not empty, not current/parent dir
    if (!filename || filename === '.' || filename === '..') return;

    const fullPath = path.join(UPLOADS_DIR, filename);

    // Verify resolved path stays strictly within UPLOADS_DIR
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(UPLOADS_DIR)) {
      console.warn(`[Security] Prevented path traversal attempt on file deletion: ${imageUrl}`);
      return;
    }

    // Check if file exists and remove
    await fs.promises.access(resolvedPath, fs.constants.F_OK);
    await fs.promises.unlink(resolvedPath);
    console.log(`[Uploads] Cleaned up file: ${filename}`);
  } catch (err) {
    // Ignore ENOENT (file not found), log other errors
    if (err.code !== 'ENOENT') {
      console.error(`[Uploads Error] Failed to delete file for ${imageUrl}:`, err.message);
    }
  }
}

module.exports = {
  handleImageUpload,
  deleteUploadedImage,
  UPLOADS_DIR
};
