/**
 * Automated End-to-End API Test Suite
 * Tests authentication, posts CRUD, image uploads/replacements/deletions,
 * comments CRUD, file validations, and ownership enforcement.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

const app = require('../src/server');
const db = require('../src/config/db');

let server;
const BASE_URL = 'http://localhost:3001';

let userACookie = '';
let userBCookie = '';
let userACsrf = '';
let userBCsrf = '';

let userAPostId = null;
let userAPostWithImgId = null;
let userACommentId = null;

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function request(urlPath, options = {}) {
  const url = `${BASE_URL}${urlPath}`;
  const headers = options.headers || {};
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }
  if (options.csrf) {
    headers['x-csrf-token'] = options.csrf;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  // Extract set-cookie
  const setCookie = res.headers.get('set-cookie');
  let cookieVal = null;
  if (setCookie) {
    cookieVal = setCookie.split(';')[0];
  }

  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    // not JSON
  }

  return {
    status: res.status,
    headers: res.headers,
    cookie: cookieVal,
    body
  };
}

async function runAllTests() {
  console.log('\n===============================================');
  console.log('🧪 Starting Blog Platform Automated Test Suite');
  console.log('===============================================\n');

  try {
    // Start test server on port 3001
    await new Promise((resolve) => {
      server = app.listen(3001, () => {
        console.log(`[Test Server] Running on ${BASE_URL}`);
        resolve();
      });
    });

    // Clean up test data if any
    await db.execute("DELETE FROM users WHERE email IN ('test_user_a@example.com', 'test_user_b@example.com')");

    // TEST 1: CSRF Token retrieval
    console.log('\n--- 1. Testing CSRF Protection ---');
    const csrfRes = await request('/api/csrf-token');
    assert(csrfRes.status === 200, 'GET /api/csrf-token returns 200');
    assert(csrfRes.body.success === true, 'CSRF response reports success');
    assert(typeof csrfRes.body.csrfToken === 'string', 'CSRF token is a valid string');
    userACsrf = csrfRes.body.csrfToken;
    userACookie = csrfRes.cookie;

    // TEST 2: User Registration (User A)
    console.log('\n--- 2. Testing User Registration ---');
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      cookie: userACookie,
      csrf: userACsrf,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Developer',
        email: 'test_user_a@example.com',
        password: 'password123'
      })
    });
    assert(regRes.status === 201, 'POST /api/auth/register returns 201 Created');
    assert(regRes.body.data.user.email === 'test_user_a@example.com', 'Registered user email matches');
    if (regRes.cookie) userACookie = regRes.cookie;

    // TEST 3: Duplicate Registration rejection
    console.log('\n--- 3. Testing Duplicate Registration Rejection ---');
    const dupRegRes = await request('/api/auth/register', {
      method: 'POST',
      cookie: userACookie,
      csrf: userACsrf,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Duplicate',
        email: 'test_user_a@example.com',
        password: 'password123'
      })
    });
    assert(dupRegRes.status === 409, 'Duplicate email registration returns 409 Conflict');

    // TEST 4: Register User B (for authorization checks)
    console.log('\n--- 4. Registering User B for Permission Testing ---');
    const csrfBRes = await request('/api/csrf-token');
    userBCookie = csrfBRes.cookie;
    userBCsrf = csrfBRes.body.csrfToken;

    const regBRes = await request('/api/auth/register', {
      method: 'POST',
      cookie: userBCookie,
      csrf: userBCsrf,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Tester',
        email: 'test_user_b@example.com',
        password: 'password456'
      })
    });
    assert(regBRes.status === 201, 'User B registered successfully');
    if (regBRes.cookie) userBCookie = regBRes.cookie;

    // TEST 5: Login with User A
    console.log('\n--- 5. Testing Login ---');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      cookie: userACookie,
      csrf: userACsrf,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_user_a@example.com',
        password: 'password123'
      })
    });
    assert(loginRes.status === 200, 'POST /api/auth/login returns 200 OK');
    assert(loginRes.body.data.user.name === 'Alice Developer', 'Logged in user name matches');
    if (loginRes.cookie) userACookie = loginRes.cookie;

    // Update CSRF for Alice after login
    const csrfAliceAfter = await request('/api/csrf-token', { cookie: userACookie });
    userACsrf = csrfAliceAfter.body.csrfToken;

    // TEST 6: Get Current User (GET /api/auth/me)
    console.log('\n--- 6. Testing Current User Verification ---');
    const meRes = await request('/api/auth/me', { cookie: userACookie });
    assert(meRes.status === 200, 'GET /api/auth/me returns 200');
    assert(meRes.body.data.user.email === 'test_user_a@example.com', 'Current user matches active session');

    // TEST 7: Create Post without Image
    console.log('\n--- 7. Testing Post Creation (Text Only) ---');
    const postForm = new FormData();
    postForm.append('title', 'Building Web Apps with Vanilla JS');
    postForm.append('category', 'Technology');
    postForm.append('content', 'Vanilla JavaScript provides unmatched performance and flexibility without bloated build pipelines.');

    const createPostRes = await request('/api/posts', {
      method: 'POST',
      cookie: userACookie,
      csrf: userACsrf,
      body: postForm
    });
    assert(createPostRes.status === 201, 'POST /api/posts returns 201 Created');
    assert(createPostRes.body.data.post.title === 'Building Web Apps with Vanilla JS', 'Post title stored correctly');
    assert(createPostRes.body.data.post.image_url === null, 'Cover image is null when not provided');
    userAPostId = createPostRes.body.data.post.id;

    // TEST 8: Create Post with Real Image Upload (PNG)
    console.log('\n--- 8. Testing Post Creation with Image Upload ---');
    // Create a 1x1 test PNG buffer
    const testPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const pngBlob = new Blob([testPngBuffer], { type: 'image/png' });

    const postImgForm = new FormData();
    postImgForm.append('title', 'Modern CSS Architecture in 2026');
    postImgForm.append('category', 'Design');
    postImgForm.append('content', 'Explore modern features like container queries, native dialogs, and overscroll containment.');
    postImgForm.append('image', pngBlob, 'test-cover.png');

    const createPostImgRes = await request('/api/posts', {
      method: 'POST',
      cookie: userACookie,
      csrf: userACsrf,
      body: postImgForm
    });
    assert(createPostImgRes.status === 201, 'POST /api/posts with image returns 201 Created');
    assert(createPostImgRes.body.data.post.image_url !== null, 'Cover image path is populated');
    assert(createPostImgRes.body.data.post.image_url.startsWith('/uploads/post-'), 'Cover image is in /uploads/ with unique safe prefix');
    userAPostWithImgId = createPostImgRes.body.data.post.id;
    const uploadedImagePath = createPostImgRes.body.data.post.image_url;

    // Verify file exists on local filesystem
    const diskPath = path.join(__dirname, '..', uploadedImagePath);
    assert(fs.existsSync(diskPath), 'Uploaded image exists on disk in uploads directory');

    // TEST 9: Reject Invalid File Type (Text file disguised as .txt)
    console.log('\n--- 9. Testing Validation: Invalid File Type Rejection ---');
    const badFileBlob = new Blob(['Not an image!'], { type: 'text/plain' });
    const badForm = new FormData();
    badForm.append('title', 'Hacking Attempts');
    badForm.append('content', 'This should be rejected due to bad mime type.');
    badForm.append('image', badFileBlob, 'malicious.txt');

    const badFileRes = await request('/api/posts', {
      method: 'POST',
      cookie: userACookie,
      csrf: userACsrf,
      body: badForm
    });
    assert(badFileRes.status === 400, 'Invalid file type returns 400 Bad Request');
    assert(badFileRes.body.message.includes('Only JPEG, PNG, and WebP'), 'Error message specifies allowed file types');

    // TEST 10: Reject Oversized File (> 5 MB)
    console.log('\n--- 10. Testing Validation: Oversized File (> 5 MB) Rejection ---');
    // Create dummy oversized buffer (5.2 MB)
    const largeBuffer = Buffer.alloc(5.2 * 1024 * 1024);
    const largeBlob = new Blob([largeBuffer], { type: 'image/jpeg' });
    const largeForm = new FormData();
    largeForm.append('title', 'Giant Image Post');
    largeForm.append('content', 'This should be rejected due to size limit exceeding 5 MB.');
    largeForm.append('image', largeBlob, 'oversized.jpg');

    const largeFileRes = await request('/api/posts', {
      method: 'POST',
      cookie: userACookie,
      csrf: userACsrf,
      body: largeForm
    });
    assert(largeFileRes.status === 400, 'Oversized file returns 400 Bad Request');
    assert(largeFileRes.body.message.includes('5 MB limit'), 'Error message mentions 5 MB limit');

    // TEST 11: List Posts with Search and Category Filtering
    console.log('\n--- 11. Testing Post Listing, Search, and Filtering ---');
    const listRes = await request('/api/posts?category=Design');
    assert(listRes.status === 200, 'GET /api/posts?category=Design returns 200');
    assert(listRes.body.data.posts.length >= 1, 'Filter by category returns matching posts');

    const searchRes = await request('/api/posts?search=Vanilla');
    assert(searchRes.status === 200, 'GET /api/posts?search=Vanilla returns 200');
    assert(searchRes.body.data.posts.some(p => p.title.includes('Vanilla')), 'Search query returns relevant posts');

    // TEST 12: Get Single Post Details
    console.log('\n--- 12. Testing Get Single Post Details ---');
    const singleRes = await request(`/api/posts/${userAPostWithImgId}`);
    assert(singleRes.status === 200, 'GET /api/posts/:id returns 200');
    assert(singleRes.body.data.post.author_name === 'Alice Developer', 'Post details include author name');

    // TEST 13: Replace Post Image (Update Post)
    console.log('\n--- 13. Testing Image Replacement & Cleanup of Old Image ---');
    const newTestPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const newPngBlob = new Blob([newTestPngBuffer], { type: 'image/png' });
    const replaceForm = new FormData();
    replaceForm.append('title', 'Modern CSS Architecture in 2026 (Updated)');
    replaceForm.append('category', 'Design');
    replaceForm.append('content', 'Updated article with brand new insights and replaced cover image.');
    replaceForm.append('image', newPngBlob, 'replaced-cover.png');

    const replaceRes = await request(`/api/posts/${userAPostWithImgId}`, {
      method: 'PUT',
      cookie: userACookie,
      csrf: userACsrf,
      body: replaceForm
    });
    assert(replaceRes.status === 200, 'PUT /api/posts/:id returns 200');
    const newImagePath = replaceRes.body.data.post.image_url;
    assert(newImagePath !== uploadedImagePath, 'Image URL updated to new file');
    assert(fs.existsSync(path.join(__dirname, '..', newImagePath)), 'New image exists on disk');
    assert(!fs.existsSync(diskPath), 'Old replaced image was safely deleted from disk');

    // TEST 14: Remove Post Image (Update Post with remove_image)
    console.log('\n--- 14. Testing Explicit Cover Image Removal ---');
    const removeImgForm = new FormData();
    removeImgForm.append('title', 'Modern CSS Architecture in 2026 (No Cover)');
    removeImgForm.append('category', 'Design');
    removeImgForm.append('content', 'Cover image removed.');
    removeImgForm.append('remove_image', 'true');

    const removeImgRes = await request(`/api/posts/${userAPostWithImgId}`, {
      method: 'PUT',
      cookie: userACookie,
      csrf: userACsrf,
      body: removeImgForm
    });
    assert(removeImgRes.status === 200, 'PUT /api/posts/:id with remove_image returns 200');
    assert(removeImgRes.body.data.post.image_url === null, 'Cover image field is now null in DB');
    assert(!fs.existsSync(path.join(__dirname, '..', newImagePath)), 'Removed image file safely deleted from disk');

    // TEST 15: Create Comment
    console.log('\n--- 15. Testing Comments Creation ---');
    const createCommentRes = await request(`/api/posts/${userAPostId}/comments`, {
      method: 'POST',
      cookie: userACookie,
      csrf: userACsrf,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Outstanding article! Highly recommended.' })
    });
    assert(createCommentRes.status === 201, 'POST /api/posts/:id/comments returns 201');
    assert(createCommentRes.body.data.comment.content === 'Outstanding article! Highly recommended.', 'Comment content matches');
    assert(createCommentRes.body.data.comment.author_name === 'Alice Developer', 'Comment author populated');
    userACommentId = createCommentRes.body.data.comment.id;

    // TEST 16: List Comments
    console.log('\n--- 16. Testing Comments Listing ---');
    const listCommentsRes = await request(`/api/posts/${userAPostId}/comments`);
    assert(listCommentsRes.status === 200, 'GET /api/posts/:id/comments returns 200');
    assert(listCommentsRes.body.data.comments.length >= 1, 'Comments list returned successfully');

    // TEST 17: Update Comment
    console.log('\n--- 17. Testing Comment Update ---');
    const updateCommentRes = await request(`/api/comments/${userACommentId}`, {
      method: 'PUT',
      cookie: userACookie,
      csrf: userACsrf,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Outstanding article! (Updated comment with extra notes)' })
    });
    assert(updateCommentRes.status === 200, 'PUT /api/comments/:id returns 200');
    assert(updateCommentRes.body.data.comment.content.includes('(Updated'), 'Comment content updated');

    // TEST 18: Ownership Enforcement - User B attempting to edit User A's post
    console.log('\n--- 18. Testing Ownership Enforcement (Post Modification) ---');
    const unauthorizedPostEditRes = await request(`/api/posts/${userAPostId}`, {
      method: 'PUT',
      cookie: userBCookie,
      csrf: userBCsrf,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Hacked by Bob',
        category: 'Technology',
        content: 'This should be forbidden!'
      })
    });
    assert(unauthorizedPostEditRes.status === 403, 'Unauthorized post edit returns 403 Forbidden');

    // TEST 19: Ownership Enforcement - User B attempting to delete User A's post
    console.log('\n--- 19. Testing Ownership Enforcement (Post Deletion) ---');
    const unauthorizedPostDeleteRes = await request(`/api/posts/${userAPostId}`, {
      method: 'DELETE',
      cookie: userBCookie,
      csrf: userBCsrf
    });
    assert(unauthorizedPostDeleteRes.status === 403, 'Unauthorized post delete returns 403 Forbidden');

    // TEST 20: Ownership Enforcement - User B attempting to edit User A's comment
    console.log('\n--- 20. Testing Ownership Enforcement (Comment Modification) ---');
    const unauthorizedCommentEditRes = await request(`/api/comments/${userACommentId}`, {
      method: 'PUT',
      cookie: userBCookie,
      csrf: userBCsrf,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Bob editing Alice comment' })
    });
    assert(unauthorizedCommentEditRes.status === 403, 'Unauthorized comment edit returns 403 Forbidden');

    // TEST 21: Ownership Enforcement - User B attempting to delete User A's comment
    console.log('\n--- 21. Testing Ownership Enforcement (Comment Deletion) ---');
    const unauthorizedCommentDeleteRes = await request(`/api/comments/${userACommentId}`, {
      method: 'DELETE',
      cookie: userBCookie,
      csrf: userBCsrf
    });
    assert(unauthorizedCommentDeleteRes.status === 403, 'Unauthorized comment delete returns 403 Forbidden');

    // TEST 22: Delete Comment by Author
    console.log('\n--- 22. Testing Comment Deletion by Owner ---');
    const deleteCommentRes = await request(`/api/comments/${userACommentId}`, {
      method: 'DELETE',
      cookie: userACookie,
      csrf: userACsrf
    });
    assert(deleteCommentRes.status === 200, 'DELETE /api/comments/:id by owner returns 200');

    // TEST 23: Delete Post by Author
    console.log('\n--- 23. Testing Post Deletion by Owner ---');
    const deletePostRes = await request(`/api/posts/${userAPostId}`, {
      method: 'DELETE',
      cookie: userACookie,
      csrf: userACsrf
    });
    assert(deletePostRes.status === 200, 'DELETE /api/posts/:id by owner returns 200');

    // TEST 24: User Logout
    console.log('\n--- 24. Testing Logout ---');
    const logoutRes = await request('/api/auth/logout', {
      method: 'POST',
      cookie: userACookie,
      csrf: userACsrf
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200');

    const meAfterLogout = await request('/api/auth/me', { cookie: userACookie });
    assert(meAfterLogout.body.data.user === null, 'Session destroyed and current user is null');

    console.log('\n===============================================');
    console.log(`🎉 ALL ${passedTests} TESTS PASSED SUCCESSFULLY! (0 failures)`);
    console.log('===============================================\n');

  } catch (err) {
    console.error('\n❌ Test suite failed with error:', err.message);
    process.exitCode = 1;
  } finally {
    // Clean up test data
    try {
      await db.execute("DELETE FROM users WHERE email IN ('test_user_a@example.com', 'test_user_b@example.com')");
    } catch (e) {}

    if (server) {
      server.close();
    }
    // Close db pool so process can terminate
    await db.end();
  }
}

runAllTests();
