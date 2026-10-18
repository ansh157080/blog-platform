/**
 * Comments Module: Dynamic loading, creation, inline editing, and deletion
 */

let activePostId = null;

/**
 * Initialize comments for a post
 */
async function initComments(postId) {
  activePostId = postId;
  const section = document.getElementById('commentsSection');
  if (!section) return;

  const isAuth = window.auth.isAuthenticated();
  const currentUser = window.auth.getCurrentUser();

  section.innerHTML = `
    <div class="comments-header">
      <h3 class="comments-title">
        Discussion (<span id="commentsCountHeader">0</span>)
      </h3>
    </div>

    ${isAuth ? `
      <div class="comment-form-card">
        <form id="commentForm">
          <textarea 
            id="commentInput" 
            class="comment-textarea" 
            placeholder="Share your thoughts, ask a question, or leave feedback..." 
            required 
            maxlength="2000"
          ></textarea>
          <div class="comment-form-footer">
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              Posting as <strong>${window.posts.escapeHtml(currentUser.name)}</strong>
            </span>
            <button type="submit" class="btn btn-primary btn-sm" id="submitCommentBtn">
              Post Comment
            </button>
          </div>
        </form>
      </div>
    ` : `
      <div class="empty-state" style="padding: 2rem; margin-bottom: 2rem;">
        <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.95rem;">
          Want to join the discussion? Please log in or create an account to leave a comment.
        </p>
        <div style="display: flex; justify-content: center; gap: 0.75rem;">
          <a href="#login" class="btn btn-secondary btn-sm">Log In</a>
          <a href="#register" class="btn btn-primary btn-sm">Register</a>
        </div>
      </div>
    `}

    <div id="commentsList" class="comment-list">
      <div class="spinner"></div>
    </div>
  `;

  // Bind submit event if authenticated
  if (isAuth) {
    const form = document.getElementById('commentForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitNewComment();
    });
  }

  await loadComments(postId);
}

/**
 * Fetch and render comments
 */
async function loadComments(postId) {
  const listContainer = document.getElementById('commentsList');
  const countHeader = document.getElementById('commentsCountHeader');
  if (!listContainer) return;

  try {
    const res = await window.api.get(`/api/posts/${postId}/comments`);
    const comments = res.data.comments || [];

    if (countHeader) {
      countHeader.textContent = comments.length;
    }

    if (comments.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <div class="empty-icon" style="font-size: 2.5rem; margin-bottom: 0.5rem;">💬</div>
          <p class="empty-title" style="font-size: 1.1rem;">No comments yet</p>
          <p class="empty-text" style="font-size: 0.88rem; margin-bottom: 0;">
            Be the first to share your thoughts on this story!
          </p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = comments.map(renderCommentItemHtml).join('');
  } catch (err) {
    listContainer.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <p style="color: var(--danger); font-size: 0.9rem;">Failed to load comments: ${window.posts.escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

/**
 * Render HTML for an individual comment
 */
function renderCommentItemHtml(comment) {
  const currentUser = window.auth.getCurrentUser();
  const isOwner = currentUser && currentUser.id === comment.user_id;
  const initial = (comment.author_name || 'U').charAt(0).toUpperCase();
  const dateFormatted = window.posts.formatDate(comment.created_at);
  const isEdited = comment.updated_at && comment.updated_at !== comment.created_at;

  let ownerActionsHtml = '';
  if (isOwner) {
    ownerActionsHtml = `
      <div class="comment-actions">
        <button class="btn btn-ghost btn-sm" onclick="window.comments.toggleEditComment(${comment.id})" title="Edit Comment">
          ✏️ Edit
        </button>
        <button class="btn btn-ghost btn-sm" style="color: var(--danger);" onclick="window.comments.confirmDeleteComment(${comment.id})" title="Delete Comment">
          🗑️
        </button>
      </div>
    `;
  }

  return `
    <div class="comment-item" id="comment-${comment.id}" data-id="${comment.id}">
      <div class="comment-header">
        <div class="comment-author-badge">
          <div class="comment-author-avatar">${initial}</div>
          <div>
            <div class="comment-author-name">${window.posts.escapeHtml(comment.author_name)}</div>
            <div class="comment-date">
              ${dateFormatted} ${isEdited ? '<span style="font-style: italic; color: var(--text-light);">(edited)</span>' : ''}
            </div>
          </div>
        </div>
        ${ownerActionsHtml}
      </div>

      <div class="comment-content" id="comment-text-${comment.id}">
        ${window.posts.escapeHtml(comment.content)}
      </div>

      <div class="comment-edit-box" id="comment-edit-box-${comment.id}" style="display: none;">
        <textarea class="comment-textarea" id="comment-edit-input-${comment.id}" rows="3">${window.posts.escapeHtml(comment.content)}</textarea>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="window.comments.cancelEditComment(${comment.id})">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="window.comments.saveEditComment(${comment.id})">Save Changes</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Submit a new comment dynamically
 */
async function submitNewComment() {
  const input = document.getElementById('commentInput');
  const submitBtn = document.getElementById('submitCommentBtn');
  if (!input || !activePostId) return;

  const content = input.value.trim();
  if (!content) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting...';

  try {
    const res = await window.api.post(`/api/posts/${activePostId}/comments`, { content });
    window.app.showToast('Comment posted successfully!', 'success');
    input.value = '';

    // Append new comment dynamically
    const listContainer = document.getElementById('commentsList');
    const emptyState = listContainer.querySelector('.empty-state');
    if (emptyState) {
      listContainer.innerHTML = '';
    }

    const newCommentHtml = renderCommentItemHtml(res.data.comment);
    listContainer.insertAdjacentHTML('afterbegin', newCommentHtml);

    // Update count in header
    const countHeader = document.getElementById('commentsCountHeader');
    if (countHeader) {
      const current = parseInt(countHeader.textContent, 10) || 0;
      countHeader.textContent = current + 1;
    }
  } catch (err) {
    window.app.showToast(err.message || 'Failed to submit comment.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post Comment';
  }
}

/**
 * Toggle inline comment edit
 */
function toggleEditComment(commentId) {
  const textElem = document.getElementById(`comment-text-${commentId}`);
  const editBox = document.getElementById(`comment-edit-box-${commentId}`);
  if (textElem && editBox) {
    textElem.style.display = 'none';
    editBox.style.display = 'block';
  }
}

function cancelEditComment(commentId) {
  const textElem = document.getElementById(`comment-text-${commentId}`);
  const editBox = document.getElementById(`comment-edit-box-${commentId}`);
  if (textElem && editBox) {
    textElem.style.display = 'block';
    editBox.style.display = 'none';
  }
}

/**
 * Save edited comment
 */
async function saveEditComment(commentId) {
  const input = document.getElementById(`comment-edit-input-${commentId}`);
  const textElem = document.getElementById(`comment-text-${commentId}`);
  const editBox = document.getElementById(`comment-edit-box-${commentId}`);
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    window.app.showToast('Comment cannot be empty.', 'error');
    return;
  }

  try {
    const res = await window.api.put(`/api/comments/${commentId}`, { content });
    window.app.showToast('Comment updated successfully.', 'success');

    textElem.innerHTML = window.posts.escapeHtml(res.data.comment.content);
    textElem.style.display = 'block';
    editBox.style.display = 'none';
  } catch (err) {
    window.app.showToast(err.message || 'Failed to update comment.', 'error');
  }
}

/**
 * Confirm comment deletion using native <dialog>
 */
function confirmDeleteComment(commentId) {
  const dialog = document.getElementById('deleteDialog');
  const confirmBtn = document.getElementById('dialogConfirmBtn');
  const cancelBtn = document.getElementById('dialogCancelBtn');
  const titleElem = document.getElementById('dialogTitle');
  const descElem = document.getElementById('dialogDesc');

  if (!dialog) {
    if (confirm('Are you sure you want to delete this comment?')) {
      executeDeleteComment(commentId);
    }
    return;
  }

  titleElem.textContent = 'Delete Comment?';
  descElem.textContent = 'Are you sure you want to permanently delete this comment?';

  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', async () => {
    dialog.close();
    await executeDeleteComment(commentId);
  });

  cancelBtn.onclick = () => dialog.close();
  dialog.showModal();
}

async function executeDeleteComment(commentId) {
  try {
    await window.api.delete(`/api/comments/${commentId}`);
    window.app.showToast('Comment deleted.', 'success');

    // Remove element from DOM
    const elem = document.getElementById(`comment-${commentId}`);
    if (elem) elem.remove();

    // Decrement counter
    const countHeader = document.getElementById('commentsCountHeader');
    if (countHeader) {
      const current = parseInt(countHeader.textContent, 10) || 1;
      countHeader.textContent = Math.max(0, current - 1);
    }

    // If no comments left, show empty state
    const listContainer = document.getElementById('commentsList');
    if (listContainer && listContainer.children.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <div class="empty-icon" style="font-size: 2.5rem; margin-bottom: 0.5rem;">💬</div>
          <p class="empty-title" style="font-size: 1.1rem;">No comments yet</p>
          <p class="empty-text" style="font-size: 0.88rem; margin-bottom: 0;">
            Be the first to share your thoughts on this story!
          </p>
        </div>
      `;
    }
  } catch (err) {
    window.app.showToast(err.message || 'Failed to delete comment.', 'error');
  }
}

window.comments = {
  initComments,
  loadComments,
  toggleEditComment,
  cancelEditComment,
  saveEditComment,
  confirmDeleteComment
};
