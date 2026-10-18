const db = require('../config/db');

/**
 * Get all comments for a specific post
 */
async function getCommentsByPost(req, res, next) {
  try {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }

    const [comments] = await db.execute(
      `
      SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.name AS author_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
      `,
      [postId]
    );

    res.json({
      success: true,
      data: { comments }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Add a new comment to a post
 */
async function createComment(req, res, next) {
  try {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }

    let { content } = req.body;
    content = typeof content === 'string' ? content.trim() : '';

    if (!content || content.length < 1 || content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Comment content cannot be empty and must be under 2000 characters.'
      });
    }

    // Verify post exists
    const [posts] = await db.execute('SELECT id FROM posts WHERE id = ? LIMIT 1', [postId]);
    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The blog post you are commenting on does not exist.'
      });
    }

    const userId = req.session.user.id;

    const [result] = await db.execute(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, userId, content]
    );

    const newCommentId = result.insertId;

    const [rows] = await db.execute(
      `
      SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.name AS author_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
      `,
      [newCommentId]
    );

    res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      data: { comment: rows[0] }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update an existing comment
 */
async function updateComment(req, res, next) {
  try {
    const commentId = parseInt(req.params.id, 10);
    if (isNaN(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID.' });
    }

    let { content } = req.body;
    content = typeof content === 'string' ? content.trim() : '';

    if (!content || content.length < 1 || content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Comment content cannot be empty and must be under 2000 characters.'
      });
    }

    // Verify comment exists and check ownership
    const [existing] = await db.execute(
      'SELECT id, post_id, user_id FROM comments WHERE id = ? LIMIT 1',
      [commentId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    if (existing[0].user_id !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are only authorized to edit your own comments.'
      });
    }

    await db.execute('UPDATE comments SET content = ? WHERE id = ?', [content, commentId]);

    const [rows] = await db.execute(
      `
      SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.name AS author_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
      `,
      [commentId]
    );

    res.json({
      success: true,
      message: 'Comment updated successfully.',
      data: { comment: rows[0] }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a comment
 */
async function deleteComment(req, res, next) {
  try {
    const commentId = parseInt(req.params.id, 10);
    if (isNaN(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID.' });
    }

    const [existing] = await db.execute(
      'SELECT id, user_id FROM comments WHERE id = ? LIMIT 1',
      [commentId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    if (existing[0].user_id !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are only authorized to delete your own comments.'
      });
    }

    await db.execute('DELETE FROM comments WHERE id = ?', [commentId]);

    res.json({
      success: true,
      message: 'Comment deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCommentsByPost,
  createComment,
  updateComment,
  deleteComment
};
