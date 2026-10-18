const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const { requireAuth } = require('../middleware/auth');
const { handleImageUpload } = require('../middleware/upload');

// Public routes
router.get('/', postController.getAllPosts);
router.get('/categories', postController.getCategories);
router.get('/:id', postController.getPostById);

// Protected routes
router.post('/', requireAuth, handleImageUpload, postController.createPost);
router.put('/:id', requireAuth, handleImageUpload, postController.updatePost);
router.delete('/:id', requireAuth, postController.deletePost);

module.exports = router;
