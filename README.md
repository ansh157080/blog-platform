# ✍️ Ink & Insight — Full-Stack Blog Platform with Comments

A modern, responsive, full-stack blogging platform with user authentication, rich article publishing, local image uploads with Multer, dynamic comments, search, category filtering, and MySQL persistence.

Built with **HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and MySQL (via XAMPP)**.

---

## 🌟 Key Features

### 1. User Authentication & Security
- **Registration, Login & Logout**: Secure user accounts with session management via `express-session`.
- **Bcrypt Password Hashing**: Passwords securely hashed with 10 salt rounds (`bcryptjs`).
- **Authorization & Ownership Enforcement**: Users can only modify or delete their own blog posts and comments. Unauthorized actions strictly return `403 Forbidden`.
- **Anti-CSRF Protection**: Cryptographic CSRF token validation protects all state-changing requests (`POST`, `PUT`, `DELETE`).
- **Input Sanitization & Parameterized SQL**: Parameterized queries with `mysql2` prevent SQL injection attacks. HTML escaping on the frontend prevents cross-site scripting (XSS).

### 2. Blog Post Management
- **Homepage & Feed**: Displays published articles with category badges, author names, publication dates, estimated reading times, and comment counts.
- **Featured Story Banner**: Dynamically highlights top stories on the homepage.
- **Search & Filters**: Instant live search by title/keywords and category filtering pills.
- **Dedicated Article Details Page**: Clean typography, full cover image, author card, and interactive discussion section.
- **CRUD Operations**: Authenticated users can create, view, edit, and delete their own stories.
- **Modern Dialog Modal**: Safe confirmation dialogs (`<dialog>`) with CSS overscroll containment before deleting articles.

### 3. Real Image Uploads (Multer)
- **Local Storage**: Stores uploaded images inside the dedicated `uploads/` directory during local development.
- **MIME & Extension Validation**: Validates file types on the server (`image/jpeg`, `image/png`, `image/webp`). Disguised or invalid file types are rejected with `400 Bad Request`.
- **Size Limitation**: Restricts uploads to **5 MB maximum**. Oversized files return clean, descriptive error messages.
- **Unique Safe Filenames**: Safe, randomized unique filenames (`post-<timestamp>-<randomHex>.<ext>`) prevent collisions and path traversal.
- **Static Serving**: Express securely serves uploads via `/uploads/<filename>`.
- **Live Image Previews**: Real-time client-side image preview before publishing.
- **Image Replacement & Deletion**: When editing a post, users can replace or remove their cover image. Old/removed image files are safely unlinked from disk without affecting any other posts.
- **Fallback Placeholders**: Optional cover image — posts without images display beautiful, categorized CSS gradient placeholders.

> **Production Deployment Note**: Local file storage inside `uploads/` is designed for local development. For production deployments with ephemeral containers (such as Render, Heroku, or AWS Lambda), configure an object storage service like AWS S3, Cloudflare R2, or Google Cloud Storage to preserve uploaded media persistently across server restarts.

### 4. Interactive Comments System
- **Dynamic Discussion Thread**: Authenticated users can post comments without a full page reload.
- **Inline Editing**: Comment authors can edit their comments directly in-place.
- **Safe Deletion**: Authors can delete their comments with modal confirmation.
- **Empty States**: Clear, encouraging empty state message when a post has no comments yet.

---

## 📁 Project Structure

```
blog-platform/
├── .env                  # Local environment configuration
├── .env.example          # Environment variables template
├── .gitignore            # Git exclusion rules
├── database.sql          # MySQL database schema script
├── package.json          # Node dependencies and npm scripts
├── README.md             # Project documentation and setup guide
├── public/               # Client-side static assets
│   ├── index.html        # Main SPA HTML entry point
│   ├── css/
│   │   └── style.css     # Design system, responsive layout, animations
│   └── js/
│       ├── api.js        # REST client, CSRF handling, credentials
│       ├── auth.js       # Authentication state, login, registration
│       ├── posts.js      # Post cards, filters, previews, delete dialog
│       ├── comments.js   # Dynamic comments, inline edit, delete
│       └── app.js        # Router, UI orchestration, and toast notifications
├── src/                  # Express backend source
│   ├── config/
│   │   ├── db.js         # MySQL2 promise connection pool
│   │   └── seed.js       # Sample demo data seeder
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── post.controller.js
│   │   └── comment.controller.js
│   ├── middleware/
│   │   ├── auth.js       # requireAuth guard
│   │   ├── csrf.js       # CSRF token generator & validator
│   │   ├── errorHandler.js # 404 & global exception handler
│   │   └── upload.js     # Multer storage, limits, and safe deletion
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── post.routes.js
│   │   └── comment.routes.js
│   └── server.js         # Express app entrypoint
├── test/
│   └── run-tests.js      # Automated end-to-end integration test suite
└── uploads/              # Local image storage folder
```

---

## 🛠️ Step-by-Step Local Setup (Windows with XAMPP)

### Prerequisites
- **Node.js** (v18 or higher; tested on v22)
- **XAMPP** (with MySQL service running on port 3306)

### 1. Install Dependencies
Open PowerShell inside the project directory:
```powershell
npm install
```

### 2. Start MySQL and Create Database
1. Open the **XAMPP Control Panel** and click **Start** next to **MySQL**.
2. Run the provided database schema script:
```powershell
Get-Content -Raw database.sql | & "C:\xampp\mysql\bin\mysql.exe" -u root
```
*(If your MySQL `mysql.exe` is in your system PATH, you can simply run: `mysql -u root < database.sql`)*

3. (Optional) Seed initial sample posts and comments:
```powershell
node src/config/seed.js
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` (already pre-configured for default XAMPP settings):
```powershell
Copy-Item .env.example .env
```
Default `.env` settings:
```ini
PORT=3000
NODE_ENV=development
SESSION_SECRET=super_secret_blog_platform_key_change_me_in_production
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=blog_platform
MAX_FILE_SIZE_MB=5
UPLOAD_DIR=uploads
```

### 4. Start the Express Server
```powershell
npm start
```
Or for auto-reloading during development:
```powershell
npm run dev
```

The server will output:
```
===============================================
🚀 Blog Platform Server is running!
📡 URL: http://localhost:3000
⚙️  Environment: development
===============================================
[Database] Connected successfully to MySQL database "blog_platform" at localhost:3306
```

### 5. Open and Use the Website
Open your browser and navigate to:
```
http://localhost:3000
```

#### Demo Credentials (from seeder)
- **User 1**: `elena@example.com` / `password123`
- **User 2**: `david@example.com` / `password123`
- Or click **Get Started** in the top navigation bar to register a new account!

---

## 🧪 Running Automated Tests

The project includes an automated end-to-end test suite (`test/run-tests.js`) that verifies:
- CSRF token acquisition and validation
- User registration, duplicate checks, login, and logout
- Post creation without images
- Real image uploads with Multer (PNG buffer)
- Rejection of invalid file types (e.g., `.txt`)
- Rejection of oversized files (> 5 MB)
- Image replacement (verifying old file cleanup on disk)
- Image removal (verifying disk unlinking)
- Post listing, category filtering, search, and pagination
- Comments CRUD (create, read, update, delete)
- Strict ownership checks (User B forbidden from editing/deleting User A's post or comment)

Run the test suite with:
```powershell
npm test
```
Result:
```
===============================================
🎉 ALL 50 TESTS PASSED SUCCESSFULLY! (0 failures)
===============================================
```

---

## 🔒 Security Best Practices Implemented

1. **Password Safety**: Salted hashes generated with `bcryptjs`. Passwords are never stored in plain text or returned in API responses.
2. **Session Hardening**: Cookies marked with `httpOnly: true`, `sameSite: 'lax'`, and configurable `secure` for production HTTPS.
3. **Anti-CSRF**: Cryptographically random 32-byte tokens verified for every state-changing HTTP request.
4. **Strict Path Traversal Prevention**: File deletions resolve strictly within the canonical `uploads` directory.
5. **Ownership Guards**: Every modification or deletion query verifies `req.session.user.id === resource.user_id`.
6. **Graceful Error Recovery**: If a database error occurs during post creation or update, newly uploaded files are automatically unlinked to avoid orphaned files on disk.

---

## 📄 License
ISC License. Free for educational and commercial use.
