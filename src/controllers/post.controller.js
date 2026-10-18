const db = require('../config/db');
const { deleteUploadedImage } = require('../middleware/upload');

/**
 * Get all published blog posts with filtering, search, and pagination
 */
async function getAllPosts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '9', 10)));
    const offset = (page - 1) * limit;

    const { category, search } = req.query;

    const whereConditions = [];
    const queryParams = [];

    if (category && category.trim() && category.trim().toLowerCase() !== 'all') {
      whereConditions.push('LOWER(p.category) = LOWER(?)');
      queryParams.push(category.trim());
    }

    if (search && search.trim()) {
      whereConditions.push('(p.title LIKE ? OR p.content LIKE ?)');
      const term = `%${search.trim()}%`;
      queryParams.push(term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total count query for pagination
    const countSql = `SELECT COUNT(*) AS total FROM posts p ${whereClause}`;
    const [countResult] = await db.execute(countSql, queryParams);
    const total = countResult[0].total;

    // Fetch posts with author name and comment count
    const postsSql = `
      SELECT 
        p.id,
        p.user_id,
        p.title,
        p.content,
        p.category,
        p.image_url,
        p.created_at,
        p.updated_at,
        u.name AS author_name,
        COUNT(c.id) AS comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN comments c ON p.id = c.post_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // Note: limit and offset passed as numbers, mysql2 supports integer params
    const [posts] = await db.query(postsSql, [...queryParams, limit, offset]);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get a single blog post by ID
 */
async function getPostById(req, res, next) {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID format.' });
    }

    const [rows] = await db.execute(
      `
      SELECT 
        p.id,
        p.user_id,
        p.title,
        p.content,
        p.category,
        p.image_url,
        p.created_at,
        p.updated_at,
        u.name AS author_name,
        COUNT(c.id) AS comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE p.id = ?
      GROUP BY p.id
      LIMIT 1
      `,
      [postId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found.'
      });
    }

    res.json({
      success: true,
      data: { post: rows[0] }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new blog post
 */
async function createPost(req, res, next) {
  let uploadedFile = req.file;

  try {
    let { title, content, category } = req.body;

    title = typeof title === 'string' ? title.trim() : '';
    content = typeof content === 'string' ? content.trim() : '';
    category = typeof category === 'string' && category.trim() ? category.trim() : 'General';

    if (!title || title.length < 3 || title.length > 255) {
      if (uploadedFile) await deleteUploadedImage(`/uploads/${uploadedFile.filename}`);
      return res.status(400).json({
        success: false,
        message: 'Title is required and must be between 3 and 255 characters.'
      });
    }

    if (!content || content.length < 10) {
      if (uploadedFile) await deleteUploadedImage(`/uploads/${uploadedFile.filename}`);
      return res.status(400).json({
        success: false,
        message: 'Content is required and must be at least 10 characters long.'
      });
    }

    const imageUrl = uploadedFile ? `/uploads/${uploadedFile.filename}` : null;
    const userId = req.session.user.id;

    const [result] = await db.execute(
      `INSERT INTO posts (user_id, title, content, category, image_url) VALUES (?, ?, ?, ?, ?)`,
      [userId, title, content, category, imageUrl]
    );

    const newPostId = result.insertId;

    // Fetch created post with author details
    const [createdRows] = await db.execute(
      `
      SELECT 
        p.id,
        p.user_id,
        p.title,
        p.content,
        p.category,
        p.image_url,
        p.created_at,
        p.updated_at,
        u.name AS author_name,
        0 AS comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
      `,
      [newPostId]
    );

    res.status(201).json({
      success: true,
      message: 'Blog post published successfully.',
      data: { post: createdRows[0] }
    });
  } catch (err) {
    // If DB fails, clean up the newly saved file
    if (uploadedFile) {
      await deleteUploadedImage(`/uploads/${uploadedFile.filename}`);
    }
    next(err);
  }
}

/**
 * Update an existing blog post
 */
async function updatePost(req, res, next) {
  let uploadedFile = req.file;

  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      if (uploadedFile) await deleteUploadedImage(`/uploads/${uploadedFile.filename}`);
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }

    // Check existing post and verify ownership
    const [existingRows] = await db.execute(
      'SELECT id, user_id, image_url FROM posts WHERE id = ? LIMIT 1',
      [postId]
    );

    if (existingRows.length === 0) {
      if (uploadedFile) await deleteUploadedImage(`/uploads/${uploadedFile.filename}`);
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    const existingPost = existingRows[0];

    // Ownership check
    if (existingPost.user_id !== req.session.user.id) {
      if (uploadedFile) await deleteUploadedImage(`/uploads/${uploadedFile.filename}`);
      return res.status(403).json({
        success: false,
        message: 'You are only authorized to edit your own blog posts.'
      });
    }

    let { title, content, category, remove_image } = req.body;

    title = typeof title === 'string' ? title.trim() : '';
    content = typeof content === 'string' ? content.trim() : '';
    category = typeof category === 'string' && category.trim() ? category.trim() : 'General';

    if (!title || title.length < 3 || title.length > 255) {
      if (uploadedFile) await deleteUploadedImage(`/uploads/${uploadedFile.filename}`);
      return res.status(400).json({
        success: false,
        message: 'Title is required and must be between 3 and 255 characters.'
      });
    }

    if (!content || content.length < 10) {
      if (uploadedFile) await deleteUploadedImage(`/uploads/${uploadedFile.filename}`);
      return res.status(400).json({
        success: false,
        message: 'Content is required and must be at least 10 characters long.'
      });
    }

    let finalImageUrl = existingPost.image_url;
    let oldImageToDelete = null;

    if (uploadedFile) {
      // User is replacing the cover image
      finalImageUrl = `/uploads/${uploadedFile.filename}`;
      if (existingPost.image_url) {
        oldImageToDelete = existingPost.image_url;
      }
    } else if (remove_image === 'true' || remove_image === '1') {
      // User requested removing the cover image
      finalImageUrl = null;
      if (existingPost.image_url) {
        oldImageToDelete = existingPost.image_url;
      }
    }

    await db.execute(
      `UPDATE posts SET title = ?, content = ?, category = ?, image_url = ? WHERE id = ?`,
      [title, content, category, finalImageUrl, postId]
    );

    // Delete old image only after successful DB update
    if (oldImageToDelete) {
      await deleteUploadedImage(oldImageToDelete);
    }

    // Fetch updated post
    const [updatedRows] = await db.execute(
      `
      SELECT 
        p.id,
        p.user_id,
        p.title,
        p.content,
        p.category,
        p.image_url,
        p.created_at,
        p.updated_at,
        u.name AS author_name,
        COUNT(c.id) AS comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE p.id = ?
      GROUP BY p.id
      `,
      [postId]
    );

    res.json({
      success: true,
      message: 'Blog post updated successfully.',
      data: { post: updatedRows[0] }
    });
  } catch (err) {
    if (uploadedFile) {
      await deleteUploadedImage(`/uploads/${uploadedFile.filename}`);
    }
    next(err);
  }
}

/**
 * Delete a blog post and its associated image
 */
async function deletePost(req, res, next) {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }

    const [existingRows] = await db.execute(
      'SELECT id, user_id, image_url FROM posts WHERE id = ? LIMIT 1',
      [postId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    const post = existingRows[0];

    // Ownership check
    if (post.user_id !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are only authorized to delete your own blog posts.'
      });
    }

    // Delete associated image file safely if present
    if (post.image_url) {
      await deleteUploadedImage(post.image_url);
    }

    // Delete from database (comments cascade via foreign key)
    await db.execute('DELETE FROM posts WHERE id = ?', [postId]);

    res.json({
      success: true,
      message: 'Post and associated comments deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get distinct categories with counts for filter list
 */
async function getCategories(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT category, COUNT(*) as count 
       FROM posts 
       WHERE category IS NOT NULL AND category != ''
       GROUP BY category 
       ORDER BY count DESC, category ASC`
    );

    res.json({
      success: true,
      data: { categories: rows }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getCategories
};
