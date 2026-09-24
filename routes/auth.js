// routes/auth.js
// Very simple password check for the admin panel.
// For a real production site, use environment variables + hashed passwords + sessions/JWT.

const express = require('express');
const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sdj2025';

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Incorrect password' });
  }
});

module.exports = router;
