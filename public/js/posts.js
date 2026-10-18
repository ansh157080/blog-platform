/**
 * Blog Posts Module: CRUD, filtering, searching, image handling
 */

// Helper to sanitize HTML content from user input
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Category icons map for visual appeal
const categoryIcons = {
  Technology: '💻',
  Tech: '💻',
  Design: '🎨',
  Lifestyle: '🌿',
  Business: '💼',
  Science: '🔬',
  Health: '🍎',
  General: '📝',
  Travel: '✈️',
  Education: '📚'
};

function getCategoryIcon(cat) {
  return categoryIcons[cat] || '💡';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function estimateReadingTime(text) {
  const words = (text || '').trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

/**
 * Render a single blog post card
 */
function createPostCardHtml(post) {
  const icon = getCategoryIcon(post.category);
  const formattedDate = formatDate(post.created_at);
  const readTime = estimateReadingTime(post.content);
  const initial = (post.author_name || 'U').charAt(0).toUpperCase();

  let imageHtml = '';
  if (post.image_url) {
    imageHtml = `
      <div class="card-image-box">
        <span class="card-category-badge">${icon} ${escapeHtml(post.category)}</span>
        <img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title)}" class="card-image" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'card-placeholder-image\'><div class=\'placeholder-category-icon\'>${icon}</div><div class=\'placeholder-title-hint\'>${escapeHtml(post.category)}</div></div>';" />
      </div>
    `;
  } else {
    imageHtml = `
      <div class="card-image-box">
        <span class="card-category-badge">${icon} ${escapeHtml(post.category)}</span>
        <div class="card-placeholder-image">
          <div class="placeholder-category-icon">${icon}</div>
          <div class="placeholder-title-hint">${escapeHtml(post.category)} Article</div>
        </div>
      </div>
    `;
  }

  return `
    <article class="post-card" data-id="${post.id}">
      <a href="#post/${post.id}" class="card-link">
        ${imageHtml}
      </a>
      <div class="card-body">
        <div class="card-meta-row">
          <span>${formattedDate}</span>
          <span class="card-meta-dot"></span>
          <span>${readTime}</span>
        </div>
        <h3 class="card-title">
          <a href="#post/${post.id}">${escapeHtml(post.title)}</a>
        </h3>
        <p class="card-excerpt">${escapeHtml(post.content)}</p>
        <div class="card-footer">
          <div class="author-pill">
            <div class="author-avatar">${initial}</div>
            <span>${escapeHtml(post.author_name)}</span>
          </div>
          <div class="comment-count-badge" title="${post.comment_count || 0} comments">
            💬 ${post.comment_count || 0}
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Load and display posts on the grid
 */
async function loadPosts({ page = 1, category = '', search = '', containerId = 'postsGrid', paginationId = 'postsPagination' } = {}) {
  const container = document.getElementById(containerId);
  const paginationContainer = document.getElementById(paginationId);
  if (!container) return;

  container.innerHTML = '<div class="spinner"></div>';
  if (paginationContainer) paginationContainer.innerHTML = '';

  try {
    const params = new URLSearchParams({ page, limit: 9 });
    if (category && category !== 'All') params.append('category', category);
    if (search) params.append('search', search);

    const res = await window.api.get(`/api/posts?${params.toString()}`);
    const { posts, pagination } = res.data;

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">No blog posts found</h3>
          <p class="empty-text">
            ${search ? `No articles matching "${escapeHtml(search)}". Try another search term or clear the filter.` : 'No articles have been published in this category yet. Be the first to share your story!'}
          </p>
          ${window.auth.isAuthenticated() ? '<a href="#create" class="btn btn-primary">Create First Post</a>' : '<a href="#login" class="btn btn-secondary">Log In to Post</a>'}
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(createPostCardHtml).join('');

    // Render pagination
    if (paginationContainer && pagination.totalPages > 1) {
      renderPagination(pagination, paginationContainer, (newPage) => {
        loadPosts({ page: newPage, category, search, containerId, paginationId });
        window.scrollTo({ top: container.offsetTop - 120, behavior: 'smooth' });
      });
    }
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">⚠️</div>
        <h3 class="empty-title">Failed to load posts</h3>
        <p class="empty-text">${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary" onclick="window.posts.loadPosts()">Try Again</button>
      </div>
    `;
  }
}

/**
 * Render pagination controls
 */
function renderPagination(pagination, container, onPageClick) {
  const { page, totalPages } = pagination;
  let html = '';

  // Previous button
  html += `
    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}" title="Previous Page">
      &larr;
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    // Show first, last, current, and neighbours
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      html += `
        <button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    } else if (i === page - 2 || i === page + 2) {
      html += `<span class="page-ellipsis" style="padding: 0 0.5rem; color: var(--text-light);">&hellip;</span>`;
    }
  }

  // Next button
  html += `
    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}" title="Next Page">
      &rarr;
    </button>
  `;

  container.innerHTML = html;

  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPage = parseInt(btn.dataset.page, 10);
      if (targetPage && targetPage !== page && targetPage >= 1 && targetPage <= totalPages) {
        onPageClick(targetPage);
      }
    });
  });
}

/**
 * Load categories for filter pills
 */
async function loadCategories(activeCategory = 'All', containerId = 'categoryPills', onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const res = await window.api.get('/api/posts/categories');
    const categories = res.data.categories || [];

    let pillsHtml = `
      <button class="category-pill ${activeCategory === 'All' ? 'active' : ''}" data-category="All">
        ✨ All Stories
      </button>
    `;

    categories.forEach(item => {
      const icon = getCategoryIcon(item.category);
      const isSelected = activeCategory.toLowerCase() === item.category.toLowerCase();
      pillsHtml += `
        <button class="category-pill ${isSelected ? 'active' : ''}" data-category="${escapeHtml(item.category)}">
          ${icon} ${escapeHtml(item.category)} (${item.count})
        </button>
      `;
    });

    container.innerHTML = pillsHtml;

    container.querySelectorAll('.category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        container.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        if (onSelect) onSelect(pill.dataset.category);
      });
    });
  } catch (err) {
    console.warn('Could not load categories:', err);
  }
}

/**
 * Load featured post for the hero area
 */
async function loadFeaturedPost(containerId = 'featuredPostSection') {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const res = await window.api.get('/api/posts?page=1&limit=1');
    const posts = res.data.posts || [];
    if (posts.length === 0) {
      container.innerHTML = '';
      return;
    }

    const post = posts[0];
    const icon = getCategoryIcon(post.category);
    const date = formatDate(post.created_at);
    const readTime = estimateReadingTime(post.content);

    let imgHtml = '';
    if (post.image_url) {
      imgHtml = `<img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title)}" class="featured-image" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'card-placeholder-image\'><div class=\'placeholder-category-icon\'>${icon}</div></div>';" />`;
    } else {
      imgHtml = `
        <div class="card-placeholder-image" style="height: 100%;">
          <div class="placeholder-category-icon" style="font-size: 3rem;">${icon}</div>
          <div class="placeholder-title-hint">${escapeHtml(post.category)} Feature</div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="featured-card">
        <a href="#post/${post.id}" class="featured-image-wrapper">
          ${imgHtml}
        </a>
        <div class="featured-body">
          <div class="featured-badge-row">
            <span class="featured-label">Featured Story</span>
            <span style="font-size: 0.82rem; color: var(--text-muted);">${icon} ${escapeHtml(post.category)}</span>
          </div>
          <h2 class="featured-title">
            <a href="#post/${post.id}">${escapeHtml(post.title)}</a>
          </h2>
          <p class="featured-excerpt">${escapeHtml(post.content)}</p>
          <div class="card-footer" style="padding-top: 1.25rem;">
            <div class="author-pill">
              <div class="author-avatar">${(post.author_name || 'U').charAt(0).toUpperCase()}</div>
              <span>${escapeHtml(post.author_name)}</span>
              <span style="color: var(--text-light); font-weight: 400;">&bull; ${date}</span>
            </div>
            <a href="#post/${post.id}" class="btn btn-sm btn-primary">Read Story &rarr;</a>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '';
  }
}

/**
 * Load full article details page
 */
async function loadPostDetails(postId) {
  const container = document.getElementById('postDetailsContent');
  if (!container) return;

  container.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await window.api.get(`/api/posts/${postId}`);
    const post = res.data.post;
    const currentUser = window.auth.getCurrentUser();
    const isAuthor = currentUser && currentUser.id === post.user_id;

    const icon = getCategoryIcon(post.category);
    const date = formatDate(post.created_at);
    const readTime = estimateReadingTime(post.content);
    const authorInitial = (post.author_name || 'U').charAt(0).toUpperCase();

    let coverImageHtml = '';
    if (post.image_url) {
      coverImageHtml = `
        <div class="article-cover-box">
          <img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title)}" class="article-cover-image" onerror="this.parentElement.style.display='none';" />
        </div>
      `;
    }

    let authorActionsHtml = '';
    if (isAuthor) {
      authorActionsHtml = `
        <div class="post-author-actions">
          <a href="#edit/${post.id}" class="btn btn-secondary btn-sm">
            ✏️ Edit Article
          </a>
          <button class="btn btn-outline-danger btn-sm" onclick="window.posts.confirmDelete(${post.id})">
            🗑️ Delete Article
          </button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="article-header">
        <a href="#home" class="btn btn-ghost btn-sm" style="margin-bottom: 1rem;">
          &larr; Back to all stories
        </a>
        <br />
        <span class="article-category">${icon} ${escapeHtml(post.category)}</span>
        <h1 class="article-title">${escapeHtml(post.title)}</h1>
        <div class="article-meta-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">${authorInitial}</div>
            <span>${escapeHtml(post.author_name)}</span>
          </div>
          <span class="card-meta-dot"></span>
          <span>Published on ${date}</span>
          <span class="card-meta-dot"></span>
          <span>${readTime}</span>
        </div>
        ${authorActionsHtml}
      </div>

      ${coverImageHtml}

      <div class="article-body-wrapper">
        <div class="article-content">
          ${escapeHtml(post.content)}
        </div>
      </div>
    `;

    // Load comments section for this post
    if (window.comments) {
      window.comments.initComments(post.id);
    }
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h2 class="empty-title">Post not found</h2>
        <p class="empty-text">${escapeHtml(err.message)}</p>
        <a href="#home" class="btn btn-primary">Return to Homepage</a>
      </div>
    `;
  }
}

/**
 * Confirm post deletion using native <dialog>
 */
function confirmDelete(postId) {
  const dialog = document.getElementById('deleteDialog');
  const confirmBtn = document.getElementById('dialogConfirmBtn');
  const cancelBtn = document.getElementById('dialogCancelBtn');
  const titleElem = document.getElementById('dialogTitle');
  const descElem = document.getElementById('dialogDesc');

  if (!dialog) {
    if (confirm('Are you sure you want to permanently delete this blog post?')) {
      executeDelete(postId);
    }
    return;
  }

  titleElem.textContent = 'Delete Blog Post?';
  descElem.textContent = 'This will permanently remove your article and all of its comments. This action cannot be undone.';
  
  // Clone button to strip previous event listeners
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', async () => {
    dialog.close();
    await executeDelete(postId);
  });

  cancelBtn.onclick = () => dialog.close();
  dialog.showModal();
}

async function executeDelete(postId) {
  try {
    const res = await window.api.delete(`/api/posts/${postId}`);
    window.app.showToast(res.message || 'Post deleted successfully.', 'success');
    window.location.hash = '#home';
  } catch (err) {
    window.app.showToast(err.message || 'Failed to delete post.', 'error');
  }
}

/**
 * Setup image picker preview and validation
 */
function setupImageInput(fileInputId, previewContainerId, previewImgId, removeBtnId, onRemoveCallback) {
  const fileInput = document.getElementById(fileInputId);
  const previewContainer = document.getElementById(previewContainerId);
  const previewImg = document.getElementById(previewImgId);
  const removeBtn = document.getElementById(removeBtnId);

  if (!fileInput || !previewContainer || !previewImg) return;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      window.app.showToast('Please select a valid image file (JPEG, PNG, or WebP).', 'error');
      fileInput.value = '';
      return;
    }

    // Validate size (5 MB max)
    if (file.size > 5 * 1024 * 1024) {
      window.app.showToast('Image file size cannot exceed 5 MB.', 'error');
      fileInput.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewImg.src = objectUrl;
    previewContainer.style.display = 'block';

    if (onRemoveCallback) onRemoveCallback(false);
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      fileInput.value = '';
      previewContainer.style.display = 'none';
      previewImg.src = '';
      if (onRemoveCallback) onRemoveCallback(true);
    });
  }
}

window.posts = {
  loadPosts,
  loadCategories,
  loadFeaturedPost,
  loadPostDetails,
  confirmDelete,
  setupImageInput,
  escapeHtml,
  formatDate
};
