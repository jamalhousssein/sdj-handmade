const express = require('express');
const supabase = require('../db/database');
const router = express.Router();

router.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  const { data, error } = await supabase.from('categories').insert({ name }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  const { data: oldCat, error: findError } = await supabase.from('categories').select('*').eq('id', req.params.id).single();
  if (findError) return res.status(404).json({ error: 'Category not found' });
  const { data, error } = await supabase.from('categories').update({ name, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (oldCat.name !== name) await supabase.from('products').update({ category: name, updated_at: new Date().toISOString() }).eq('category', oldCat.name);
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { data: cat, error: findError } = await supabase.from('categories').select('*').eq('id', req.params.id).single();
  if (findError) return res.status(404).json({ error: 'Category not found' });
  const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('category', cat.name);
  if (count > 0) return res.status(409).json({ error: 'Move or delete products in this category first' });
  const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});
module.exports = router;
