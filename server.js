// SDJ Hand Made API — Supabase-backed version.
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const productsRouter = require('./routes/products');
const authRouter = require('./routes/auth');
const categoriesRouter = require('./routes/categories');
const salesRouter = require('./routes/sales');
const expensesRouter = require('./routes/expenses');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/expenses', expensesRouter);
const supabase = require('./db/database');
app.get('/', (req, res) => res.send('SDJ Hand Made API is running. Try /api/health'));
// Health check that really talks to the database — open it in the browser to debug.
app.get('/api/health', async (req, res) => {
  const tables = {};
  for (const t of ['categories', 'products', 'sales', 'expenses']) {
    const { error } = await supabase.from(t).select('id', { head: true, count: 'exact' });
    tables[t] = error ? `ERROR: ${error.message}` : 'ok';
  }
  const allOk = Object.values(tables).every(v => v === 'ok');
  res.status(allOk ? 200 : 500).json({ status: allOk ? 'ok' : 'database problem', tables });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image must be 5MB or smaller' });
  res.status(err?.status || 400).json({ error: err?.message || 'Request failed' });
});

app.listen(PORT, () => {
  console.log(`SDJ Hand Made backend running on port ${PORT}`);
});
