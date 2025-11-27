const express = require('express');
const router = express.Router();
const db = require('../config/db');

function ensureLoggedIn(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

// List posts with pagination and optional title search
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const search = req.query.search ? `%${req.query.search}%` : null;

  // First, fetch admin posts (pinned notices)
  const adminEmail = 'admin@example.com';
  const adminSql = 'SELECT p.*, u.user_name, u.email FROM posts p LEFT JOIN users u ON p.user_id = u.user_id WHERE u.email = ? ORDER BY p.post_id DESC';

  db.query(adminSql, [adminEmail], (err, adminRows) => {
    if (err) throw err;

    // Count normal posts (exclude admin posts)
    let countSql = 'SELECT COUNT(*) AS count FROM posts p LEFT JOIN users u ON p.user_id = u.user_id WHERE (u.email IS NULL OR u.email <> ?)';
    let countParams = [adminEmail];
    if (search) {
      countSql = 'SELECT COUNT(*) AS count FROM posts p LEFT JOIN users u ON p.user_id = u.user_id WHERE p.title LIKE ? AND (u.email IS NULL OR u.email <> ?)';
      countParams = [search, adminEmail];
    }

    db.query(countSql, countParams, (err, countResult) => {
      if (err) throw err;
      const total = countResult[0].count;
      const totalPages = Math.ceil(total / limit) || 1;

      // For normal posts, exclude admin posts
      let listSql;
      let listParams;
      if (search) {
        listSql = 'SELECT p.*, u.user_name FROM posts p LEFT JOIN users u ON p.user_id = u.user_id WHERE p.title LIKE ? AND (u.email IS NULL OR u.email <> ?) ORDER BY p.post_id DESC LIMIT ? OFFSET ?';
        listParams = [search, adminEmail, limit, (page - 1) * limit];
      } else {
        listSql = 'SELECT p.*, u.user_name FROM posts p LEFT JOIN users u ON p.user_id = u.user_id WHERE (u.email IS NULL OR u.email <> ?) ORDER BY p.post_id DESC LIMIT ? OFFSET ?';
        listParams = [adminEmail, limit, (page - 1) * limit];
      }

      db.query(listSql, listParams, (err, posts) => {
        if (err) throw err;
        res.render('posts/index', {
          title: '게시판',
          user: req.session.user,
          adminPosts: adminRows, // pinned notices
          posts: posts,
          currentPage: page,
          totalPages: totalPages,
          search: req.query.search || ''
        });
      });
    });
  });
});

// Show new post form
router.get('/new', ensureLoggedIn, (req, res) => {
  res.render('posts/new', { title: '글 작성', user: req.session.user });
});

// Create post
router.post('/', ensureLoggedIn, (req, res) => {
  const { title, content } = req.body;
  const user_id = req.session.user ? req.session.user.user_id : null;
  const sql = 'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)';
  db.query(sql, [user_id, title, content], (err, result) => {
    if (err) throw err;
    res.redirect(`/posts/${result.insertId}`);
  });
});

// Show post (increment view count)
router.get('/:id', (req, res) => {
  const id = req.params.id;
  const incSql = 'UPDATE posts SET view_count = view_count + 1 WHERE post_id = ?';
  db.query(incSql, [id], (err) => {
    if (err) throw err;
    const postSql = 'SELECT p.*, u.user_name FROM posts p LEFT JOIN users u ON p.user_id = u.user_id WHERE p.post_id = ?';
    db.query(postSql, [id], (err, posts) => {
      if (err) throw err;
      if (!posts || posts.length === 0) return res.status(404).send('Post not found');
      const post = posts[0];
      const commentsSql = 'SELECT c.*, u.user_name FROM comments c LEFT JOIN users u ON c.user_id = u.user_id WHERE c.post_id = ? ORDER BY c.comment_id ASC';
      db.query(commentsSql, [id], (err, comments) => {
        if (err) throw err;
        res.render('posts/show', { title: post.title, user: req.session.user, post, comments });
      });
    });
  });
});

// Edit form
router.get('/:id/edit', ensureLoggedIn, (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM posts WHERE post_id = ?', [id], (err, rows) => {
    if (err) throw err;
    if (!rows || rows.length === 0) return res.status(404).send('Post not found');
    const post = rows[0];
    if (!req.session.user || req.session.user.user_id !== post.user_id) return res.status(403).send('Forbidden');
    res.render('posts/edit', { title: '글 수정', user: req.session.user, post });
  });
});

// Update post
router.post('/:id/edit', ensureLoggedIn, (req, res) => {
  const id = req.params.id;
  const { title, content } = req.body;
  db.query('SELECT * FROM posts WHERE post_id = ?', [id], (err, rows) => {
    if (err) throw err;
    const post = rows[0];
    if (!post) return res.status(404).send('Post not found');
    if (req.session.user.user_id !== post.user_id) return res.status(403).send('Forbidden');
    db.query('UPDATE posts SET title = ?, content = ? WHERE post_id = ?', [title, content, id], (err) => {
      if (err) throw err;
      res.redirect(`/posts/${id}`);
    });
  });
});

// Delete post
router.post('/:id/delete', ensureLoggedIn, (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM posts WHERE post_id = ?', [id], (err, rows) => {
    if (err) throw err;
    const post = rows[0];
    if (!post) return res.status(404).send('Post not found');
    // Allow deletion if requester is the author OR an admin (admin@example.com)
    if (req.session.user.user_id !== post.user_id && req.session.user.email !== 'admin@example.com') {
      return res.status(403).send('Forbidden');
    }
    db.query('DELETE FROM posts WHERE post_id = ?', [id], (err) => {
      if (err) throw err;
      res.redirect('/posts');
    });
  });
});

// Add comment
router.post('/:id/comments', ensureLoggedIn, (req, res) => {
  const postId = req.params.id;
  const user_id = req.session.user.user_id;
  const { content } = req.body;
  db.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [postId, user_id, content], (err) => {
    if (err) throw err;
    res.redirect(`/posts/${postId}`);
  });
});

// Delete comment
router.post('/comments/:commentId/delete', ensureLoggedIn, (req, res) => {
  const commentId = req.params.commentId;
  db.query('SELECT * FROM comments WHERE comment_id = ?', [commentId], (err, rows) => {
    if (err) throw err;
    const comment = rows[0];
    if (!comment) return res.status(404).send('Comment not found');
    // Allow deletion if requester is the author OR an admin (admin@example.com)
    if (req.session.user.user_id !== comment.user_id && req.session.user.email !== 'admin@example.com') {
      return res.status(403).send('Forbidden');
    }
    db.query('DELETE FROM comments WHERE comment_id = ?', [commentId], (err) => {
      if (err) throw err;
      // Redirect to the post page after deleting the comment to avoid unreliable 'back' behavior
      return res.redirect(`/posts/${comment.post_id}`);
    });
  });
});

// Admin: delete all posts and comments by a specific user
router.post('/user/:userId/delete-all', ensureLoggedIn, (req, res) => {
  // Only admin may perform this action
  if (!req.session.user || req.session.user.email !== 'admin@example.com') {
    return res.status(403).send('Forbidden');
  }
  const userId = req.params.userId;

  // First delete comments authored by the user (comments on others' posts)
  db.query('DELETE FROM comments WHERE user_id = ?', [userId], (err) => {
    if (err) throw err;

    // Then delete posts authored by the user (this will cascade-delete comments tied to those posts)
    db.query('DELETE FROM posts WHERE user_id = ?', [userId], (err) => {
      if (err) throw err;
      // Redirect back to admin user list if exists, otherwise to posts list
      return res.redirect('/admin');
    });
  });
});

module.exports = router;
