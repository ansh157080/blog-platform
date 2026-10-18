const express = require('express');
const router = express.Router({ mergeParams: true });
const commentController = require('../controllers/comment.controller');
const { requireAuth } = require('../middleware/auth');

// Nested routes under /api/posts/:postId/comments
router.get('/', commentController.getCommentsByPost);
router.post('/', requireAuth, commentController.createComment);

// Direct routes under /api/comments/:id
router.put('/:id', requireAuth, commentController.updateComment);
router.delete('/:id', requireAuth, commentController.deleteComment);

module.exports = router;
