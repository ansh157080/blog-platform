/**
 * Application Core & Routing Engine
 */

let editPostCurrentId = null;
let editPostRemoveImageFlag = false;

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${window.posts.escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Router & View Management
const views = {
  home: document.getElementById('viewHome'),
  explore: document.getElementById('viewExplore'),
  postDetails: document.getElementById('viewPostDetails'),
  createPost: document.getElementById('viewCreatePost'),
  editPost: document.getElementById('viewEditPost'),
  login: document.getElementById('viewLogin'),
  register: document.getElementById('viewRegister'),
  myPosts: document.getElementById('viewMyPosts')
};

function hideAllViews() {
  Object.values(views).forEach(v => {
    if (v) v.style.display = 'none';
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateActiveNav(route) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === route || (route.startsWith('#post/') && href === '#home')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Close mobile menu if open
  const navLinks = document.getElementById('navLinks');
  if (navLinks) navLinks.classList.remove('mobile-open');
}

/**
 * Handle route changes
 */
async function handleRoute() {
  const hash = window.location.hash || '#home';
  hideAllViews();

  const isAuth = window.auth.isAuthenticated();

  // Protected route check
  if (['#create', '#my-posts'].includes(hash) || hash.startsWith('#edit/')) {
    if (!isAuth) {
      showToast('Please log in to access this page.', 'info');
      window.location.hash = '#login';
      return;
    }
  }

  // Guest-only check
  if (['#login', '#register'].includes(hash) && isAuth) {
    window.location.hash = '#home';
    return;
  }

  if (hash === '#home' || hash === '') {
    updateActiveNav('#home');
    if (views.home) views.home.style.display = 'block';
    await window.posts.loadFeaturedPost();
    await window.posts.loadCategories('All', 'homeCategoryPills', (cat) => {
      window.posts.loadPosts({ category: cat, containerId: 'homePostsGrid', paginationId: 'homePostsPagination' });
    });
    await window.posts.loadPosts({ containerId: 'homePostsGrid', paginationId: 'homePostsPagination' });

  } else if (hash === '#explore') {
    updateActiveNav('#explore');
    if (views.explore) views.explore.style.display = 'block';
    const searchInput = document.getElementById('exploreSearchInput');
    const searchTerm = searchInput ? searchInput.value.trim() : '';

    await window.posts.loadCategories('All', 'exploreCategoryPills', (cat) => {
      window.posts.loadPosts({ category: cat, search: searchTerm, containerId: 'explorePostsGrid', paginationId: 'explorePostsPagination' });
    });
    await window.posts.loadPosts({ containerId: 'explorePostsGrid', paginationId: 'explorePostsPagination' });

  } else if (hash.startsWith('#post/')) {
    updateActiveNav('#post');
    const postId = hash.split('/')[1];
    if (views.postDetails) views.postDetails.style.display = 'block';
    await window.posts.loadPostDetails(postId);

  } else if (hash === '#create') {
    updateActiveNav('#create');
    if (views.createPost) views.createPost.style.display = 'block';
    resetCreateForm();

  } else if (hash.startsWith('#edit/')) {
    const postId = hash.split('/')[1];
    if (views.editPost) views.editPost.style.display = 'block';
    await loadEditFormData(postId);

  } else if (hash === '#my-posts') {
    updateActiveNav('#my-posts');
    if (views.myPosts) views.myPosts.style.display = 'block';
    await loadMyPosts();

  } else if (hash === '#login') {
    updateActiveNav('#login');
    if (views.login) views.login.style.display = 'block';

  } else if (hash === '#register') {
    updateActiveNav('#register');
    if (views.register) views.register.style.display = 'block';
  }
}

/**
 * Reset create post form
 */
function resetCreateForm() {
  const form = document.getElementById('createPostForm');
  if (form) form.reset();
  const previewContainer = document.getElementById('createImagePreview');
  if (previewContainer) previewContainer.style.display = 'none';
  const previewImg = document.getElementById('createPreviewImg');
  if (previewImg) previewImg.src = '';
}

/**
 * Load post data for editing
 */
async function loadEditFormData(postId) {
  editPostCurrentId = postId;
  editPostRemoveImageFlag = false;

  const form = document.getElementById('editPostForm');
  const previewContainer = document.getElementById('editImagePreview');
  const previewImg = document.getElementById('editPreviewImg');
  const removeBtn = document.getElementById('editRemoveImageBtn');
  const fileInput = document.getElementById('editPostImage');

  if (fileInput) fileInput.value = '';

  try {
    const res = await window.api.get(`/api/posts/${postId}`);
    const post = res.data.post;

    const user = window.auth.getCurrentUser();
    if (!user || user.id !== post.user_id) {
      showToast('You are only authorized to edit your own posts.', 'error');
      window.location.hash = `#post/${postId}`;
      return;
    }

    document.getElementById('editPostTitle').value = post.title;
    document.getElementById('editPostCategory').value = post.category;
    document.getElementById('editPostContent').value = post.content;

    if (post.image_url) {
      previewImg.src = post.image_url;
      previewContainer.style.display = 'block';
      if (removeBtn) removeBtn.style.display = 'inline-block';
    } else {
      previewContainer.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'none';
    }
  } catch (err) {
    showToast(err.message || 'Failed to load post for editing.', 'error');
    window.location.hash = '#home';
  }
}

/**
 * Load current user's posts
 */
async function loadMyPosts() {
  const user = window.auth.getCurrentUser();
  if (!user) return;

  const container = document.getElementById('myPostsGrid');
  if (!container) return;

  container.innerHTML = '<div class="spinner"></div>';

  try {
    // Fetch all posts and filter client-side by user_id
    const res = await window.api.get('/api/posts?limit=50');
    const myPosts = (res.data.posts || []).filter(p => p.user_id === user.id);

    if (myPosts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📝</div>
          <h3 class="empty-title">You haven't published any stories yet</h3>
          <p class="empty-text">Share your ideas, guides, and thoughts with our community.</p>
          <a href="#create" class="btn btn-primary">Write Your First Story</a>
        </div>
      `;
      return;
    }

    container.innerHTML = myPosts.map(p => {
      return window.posts.escapeHtml ? window.posts.createPostCardHtml ? window.posts.createPostCardHtml(p) : '' : '';
    }).join('') || myPosts.map(p => {
      // Direct render fallback
      return `
        <article class="post-card" data-id="${p.id}">
          <a href="#post/${p.id}">
            <div class="card-image-box">
              <span class="card-category-badge">${p.category}</span>
              ${p.image_url ? `<img src="${p.image_url}" class="card-image" alt="${p.title}">` : `<div class="card-placeholder-image"><div class="placeholder-category-icon">📝</div></div>`}
            </div>
          </a>
          <div class="card-body">
            <h3 class="card-title"><a href="#post/${p.id}">${p.title}</a></h3>
            <p class="card-excerpt">${p.content}</p>
            <div class="card-footer">
              <span>Published ${window.posts.formatDate(p.created_at)}</span>
              <div style="display: flex; gap: 0.5rem;">
                <a href="#edit/${p.id}" class="btn btn-secondary btn-sm">Edit</a>
                <button onclick="window.posts.confirmDelete(${p.id})" class="btn btn-outline-danger btn-sm">Delete</button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">Failed to load your posts.</p>`;
  }
}

/**
 * Update UI according to authentication status
 */
function updateAuthUI(user) {
  const guestNav = document.getElementById('navGuestActions');
  const userNav = document.getElementById('navUserActions');
  const navUserName = document.getElementById('navUserName');
  const navUserAvatar = document.getElementById('navUserAvatar');
  const createNavBtn = document.getElementById('navCreatePostBtn');

  if (user) {
    if (guestNav) guestNav.style.display = 'none';
    if (userNav) userNav.style.display = 'flex';
    if (createNavBtn) createNavBtn.style.display = 'inline-flex';
    if (navUserName) navUserName.textContent = user.name;
    if (navUserAvatar) navUserAvatar.textContent = user.name.charAt(0).toUpperCase();
  } else {
    if (guestNav) guestNav.style.display = 'flex';
    if (userNav) userNav.style.display = 'none';
    if (createNavBtn) createNavBtn.style.display = 'none';
  }
}

/**
 * Setup forms and interactive listeners
 */
function setupEventListeners() {
  // Hash change navigation
  window.addEventListener('hashchange', handleRoute);

  // Auth changes
  window.addEventListener('authChange', (e) => {
    updateAuthUI(e.detail.user);
  });

  // Mobile menu button
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.auth.logout();
      showToast('You have been logged out.', 'info');
      window.location.hash = '#home';
    });
  }

  // Login form submission
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const submitBtn = document.getElementById('loginSubmitBtn');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';

      try {
        await window.auth.login(email, password);
        showToast('Welcome back!', 'success');
        loginForm.reset();
        window.location.hash = '#home';
      } catch (err) {
        showToast(err.message || 'Login failed.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  }

  // Register form submission
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirmPassword = document.getElementById('regConfirmPassword').value;
      const submitBtn = document.getElementById('regSubmitBtn');

      if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      try {
        await window.auth.register(name, email, password);
        showToast('Account created successfully!', 'success');
        registerForm.reset();
        window.location.hash = '#home';
      } catch (err) {
        showToast(err.message || 'Registration failed.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    });
  }

  // Setup Image Pickers
  window.posts.setupImageInput(
    'createPostImage',
    'createImagePreview',
    'createPreviewImg',
    'createRemoveImageBtn'
  );

  window.posts.setupImageInput(
    'editPostImage',
    'editImagePreview',
    'editPreviewImg',
    'editRemoveImageBtn',
    (removed) => {
      editPostRemoveImageFlag = removed;
    }
  );

  // Create Post form submission
  const createForm = document.getElementById('createPostForm');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('createPostTitle').value.trim();
      const category = document.getElementById('createPostCategory').value;
      const content = document.getElementById('createPostContent').value.trim();
      const imageFile = document.getElementById('createPostImage').files[0];
      const submitBtn = document.getElementById('createSubmitBtn');

      if (!title || !content) {
        showToast('Title and content are required.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Publishing...';

      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('content', content);
      if (imageFile) {
        formData.append('image', imageFile);
      }

      try {
        const res = await window.api.post('/api/posts', formData);
        showToast('Post published successfully!', 'success');
        resetCreateForm();
        window.location.hash = `#post/${res.data.post.id}`;
      } catch (err) {
        showToast(err.message || 'Failed to publish post.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Story';
      }
    });
  }

  // Edit Post form submission
  const editForm = document.getElementById('editPostForm');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!editPostCurrentId) return;

      const title = document.getElementById('editPostTitle').value.trim();
      const category = document.getElementById('editPostCategory').value;
      const content = document.getElementById('editPostContent').value.trim();
      const imageFile = document.getElementById('editPostImage').files[0];
      const submitBtn = document.getElementById('editSubmitBtn');

      if (!title || !content) {
        showToast('Title and content are required.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving changes...';

      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('content', content);

      if (imageFile) {
        formData.append('image', imageFile);
      } else if (editPostRemoveImageFlag) {
        formData.append('remove_image', 'true');
      }

      try {
        const res = await window.api.put(`/api/posts/${editPostCurrentId}`, formData);
        showToast('Story updated successfully!', 'success');
        window.location.hash = `#post/${editPostCurrentId}`;
      } catch (err) {
        showToast(err.message || 'Failed to update story.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
  }

  // Search input listeners (Homepage and Explore)
  const homeSearch = document.getElementById('homeSearchInput');
  if (homeSearch) {
    let timeout;
    homeSearch.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        window.posts.loadPosts({
          search: homeSearch.value.trim(),
          containerId: 'homePostsGrid',
          paginationId: 'homePostsPagination'
        });
      }, 350);
    });
  }

  const exploreSearch = document.getElementById('exploreSearchInput');
  if (exploreSearch) {
    let timeout;
    exploreSearch.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        window.posts.loadPosts({
          search: exploreSearch.value.trim(),
          containerId: 'explorePostsGrid',
          paginationId: 'explorePostsPagination'
        });
      }, 350);
    });
  }
}

// Bootstrap Application
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Initial auth status check
  const user = await window.auth.checkAuthStatus();
  updateAuthUI(user);

  // Initial route execution
  await handleRoute();
});

window.app = {
  showToast,
  handleRoute
};
