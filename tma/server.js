
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Admin Stats Endpoint
app.get('/api/admin/stats', async (req, res) => {
  // In a real app, verify initData here to ensure it's the owner
  // For now, we assume the frontend only calls this if authorized (not secure but quick)
  
  try {
    const { data: users, error: usersError } = await supabase.from('users').select('id, is_banned');
    const { data: checks, error: checksError } = await supabase.from('checks').select('id');
    
    if (usersError || checksError) throw new Error('Database error');

    res.json({
      users: users.length,
      banned: users.filter(u => u.is_banned).length,
      checks: checks.length
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
