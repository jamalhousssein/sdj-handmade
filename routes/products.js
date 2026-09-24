// Full CRUD API for products backed by Supabase Postgres + Storage.
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const supabase = require('../db/database');

const router = express.Router();
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

function makeImagePath(file) {
  const ext = path.extname(file.originalname || '') || '.jpg';
  return `products/${Date.now()}-${crypto.randomUUID()}${ext.toLowerCase()}`;
}

async function uploadImage(file) {
  if (!file) return { image_url: '', image_path: '' };
  const image_path = makeImagePath(file);
  const { error } = await supabase.storage.from(BUCKET).upload(image_path, file.buffer, {
    contentType: file.mimetype,
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(image_path);
  return { image_url: data.publicUrl, image_path };
}

async function removeImage(imagePath) {
  if (!imagePath) return;
  const { error } = await supabase.storage.from(BUCKET).remove([imagePath]);
  if (error) console.error('Supabase image delete failed:', error.message);
}

router.get('/', async (req, res) => {
  try {
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (req.query.category && req.query.category !== 'all') {
      query = query.eq('category', req.query.category);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load products: ' + (err?.message || err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Product not found' });
      throw error;
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load product: ' + (err?.message || err) });
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  let uploaded = null;
  try {
    const { name, price, category, description, badge, stock } = req.body;
    if (!name || price === undefined || price === '' || !category) {
      return res.status(400).json({ error: 'name, price, and category are required' });
    }

    uploaded = req.file ? await uploadImage(req.file) : {
      image_url: req.body.image_url || '',
      image_path: ''
    };

    const payload = {
      name,
      price: Number(price),
      category,
      description: description || '',
      badge: badge || '',
      image_url: uploaded.image_url,
      image_path: uploaded.image_path,
      stock: Math.max(0, Number(stock || 0))
    };

    const { data, error } = await supabase.from('products').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    if (uploaded?.image_path) await removeImage(uploaded.image_path);
    console.error(err);
    res.status(500).json({ error: 'Failed to create product: ' + (err?.message || err) });
  }
});

router.put('/:id', upload.single('image'), async (req, res) => {
  let newImage = null;
  try {
    const { data: existing, error: findError } = await supabase
      .from('products').select('*').eq('id', req.params.id).single();
    if (findError) {
      if (findError.code === 'PGRST116') return res.status(404).json({ error: 'Product not found' });
      throw findError;
    }

    if (req.file) newImage = await uploadImage(req.file);

    const payload = {
      name: req.body.name ?? existing.name,
      price: req.body.price !== undefined && req.body.price !== '' ? Number(req.body.price) : existing.price,
      category: req.body.category ?? existing.category,
      description: req.body.description ?? existing.description,
      badge: req.body.badge ?? existing.badge,
      image_url: newImage?.image_url ?? existing.image_url,
      image_path: newImage?.image_path ?? existing.image_path,
      stock: req.body.stock !== undefined && req.body.stock !== '' ? Math.max(0, Number(req.body.stock)) : Number(existing.stock || 0),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('products').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;

    if (newImage && existing.image_path) await removeImage(existing.image_path);
    res.json(data);
  } catch (err) {
    if (newImage?.image_path) await removeImage(newImage.image_path);
    console.error(err);
    res.status(500).json({ error: 'Failed to update product: ' + (err?.message || err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { data: existing, error: findError } = await supabase
      .from('products').select('*').eq('id', req.params.id).single();
    if (findError) {
      if (findError.code === 'PGRST116') return res.status(404).json({ error: 'Product not found' });
      throw findError;
    }

    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;
    if (existing.image_path) await removeImage(existing.image_path);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product: ' + (err?.message || err) });
  }
});

module.exports = router;
