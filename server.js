const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ── POST /users/sync ────────────────────────────────
// Looks up a user by supabase_uid. Creates one if it doesn't exist yet.
// Expects { supabase_uid, username, account_type } in the body.
// Returns the MySQL user_id, which all other routes use.
app.post('/users/sync', async (req, res) => {
  try {
    const { supabase_uid, username, account_type } = req.body;
    if (!supabase_uid) {
      return res.status(400).json({ error: 'supabase_uid is required' });
    }
    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE supabase_uid = ?',
      [supabase_uid]
    );
    if (existing.length > 0) {
      // Keep the username current (e.g. if their Facebook name changes,
      // or we're correcting an old email-based username)
      if (username) {
        await pool.query(
          'UPDATE users SET username = ? WHERE supabase_uid = ?',
          [username, supabase_uid]
        );
      }
      return res.json({ user_id: existing[0].user_id });
    }
    const [result] = await pool.query(
      'INSERT INTO users (supabase_uid, username, account_type, created_at) VALUES (?, ?, ?, NOW())',
      [supabase_uid, username || 'user', account_type || 'normal']
    );
    res.status(201).json({ user_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// ── POST /users/avatar ──────────────────────────────
// Saves the uploaded avatar's public URL for a user.
// Expects { supabase_uid, avatar_url } in the body.
app.post('/users/avatar', async (req, res) => {
  try {
    const { supabase_uid, avatar_url } = req.body;
    if (!supabase_uid || !avatar_url) {
      return res.status(400).json({ error: 'supabase_uid and avatar_url are required' });
    }
    await pool.query(
      'UPDATE users SET avatar_url = ? WHERE supabase_uid = ?',
      [avatar_url, supabase_uid]
    );
    res.json({ message: 'Avatar updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// ── GET /posts ──────────────────────────────────────
// Returns all posts, newest first, joined with the author's username
app.get('/posts', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT posts.post_id, posts.content, posts.privacy, posts.created_at,
             users.username, users.user_id, users.avatar_url
      FROM posts
      JOIN users ON posts.user_id = users.user_id
      ORDER BY posts.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// ── POST /posts ─────────────────────────────────────
// Creates a new post. Expects { user_id, content, privacy } in the body
app.post('/posts', async (req, res) => {
  try {
    const { user_id, content, privacy } = req.body;
    if (!user_id || !content) {
      return res.status(400).json({ error: 'user_id and content are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO posts (user_id, content, privacy, created_at) VALUES (?, ?, ?, NOW())',
      [user_id, content, privacy || 'public']
    );
    res.status(201).json({ post_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ── POST /relates ───────────────────────────────────
// Adds a relate (like). Expects { post_id, user_id } in the body
app.post('/relates', async (req, res) => {
  try {
    const { post_id, user_id } = req.body;
    if (!post_id || !user_id) {
      return res.status(400).json({ error: 'post_id and user_id are required' });
    }
    await pool.query(
      'INSERT INTO relates (post_id, user_id, created_at) VALUES (?, ?, NOW())',
      [post_id, user_id]
    );
    res.status(201).json({ message: 'Relate added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add relate' });
  }
});

// ── GET /relates/:post_id ───────────────────────────
// Returns the relate count for a single post
app.get('/relates/:post_id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS relate_count FROM relates WHERE post_id = ?',
      [req.params.post_id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch relate count' });
  }
});

// ── POST /comments ──────────────────────────────────
// Adds a comment. Expects { post_id, user_id, content } in the body
app.post('/comments', async (req, res) => {
  try {
    const { post_id, user_id, content } = req.body;
    if (!post_id || !user_id || !content) {
      return res.status(400).json({ error: 'post_id, user_id, and content are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())',
      [post_id, user_id, content]
    );
    res.status(201).json({ comment_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ── GET /comments/:post_id ──────────────────────────
// Returns all comments for a single post, with the commenter's username
app.get('/comments/:post_id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT comments.comment_id, comments.content, comments.created_at,
             users.username, users.avatar_url
      FROM comments
      JOIN users ON comments.user_id = users.user_id
      WHERE comments.post_id = ?
      ORDER BY comments.created_at ASC
    `, [req.params.post_id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`USAP backend running on port ${PORT}`);
});
