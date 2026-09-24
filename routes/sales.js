const express = require('express');
const supabase = require('../db/database');
const router = express.Router();

router.get('/', async (req, res) => {
  let q = supabase.from('sales').select('*').order('sold_at', { ascending: false });
  if (req.query.from) q = q.gte('sold_at', `${req.query.from}T00:00:00`);
  if (req.query.to) q = q.lte('sold_at', `${req.query.to}T23:59:59`);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/', async (req, res) => {
  const productId = Number(req.body.product_id), quantity = Number(req.body.quantity || 1), unitPrice = Number(req.body.unit_price);
  if (!productId || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ error: 'Invalid sale' });
  const { data: product, error: pe } = await supabase.from('products').select('*').eq('id', productId).single();
  if (pe) return res.status(404).json({ error: 'Product not found' });
  if (Number(product.stock || 0) < quantity) return res.status(409).json({ error: 'Not enough stock' });
  const soldAt = req.body.sold_at ? new Date(req.body.sold_at).toISOString() : new Date().toISOString();
  const sale = { product_id: product.id, product_name: product.name, quantity, unit_price: unitPrice, total: unitPrice * quantity, sold_at: soldAt };
  const { data, error } = await supabase.from('sales').insert(sale).select().single();
  if (error) return res.status(400).json({ error: error.message });
  const { error: se } = await supabase.from('products').update({ stock: Number(product.stock) - quantity, updated_at: new Date().toISOString() }).eq('id', product.id);
  if (se) { await supabase.from('sales').delete().eq('id', data.id); return res.status(500).json({ error: se.message }); }
  res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
  const { data: oldSale, error: oe } = await supabase.from('sales').select('*').eq('id', req.params.id).single();
  if (oe) return res.status(404).json({ error: 'Sale not found' });
  const productId = Number(req.body.product_id ?? oldSale.product_id);
  const quantity = Number(req.body.quantity ?? oldSale.quantity);
  const unitPrice = Number(req.body.unit_price ?? oldSale.unit_price);
  if (quantity < 1 || unitPrice < 0) return res.status(400).json({ error: 'Invalid sale' });

  const ids = [...new Set([Number(oldSale.product_id), productId])];
  const { data: ps, error: pe } = await supabase.from('products').select('*').in('id', ids);
  if (pe) return res.status(500).json({ error: pe.message });
  const oldProduct = ps.find(p => Number(p.id) === Number(oldSale.product_id));
  const newProduct = ps.find(p => Number(p.id) === productId);
  if (!newProduct || !oldProduct) return res.status(404).json({ error: 'Product not found' });

  let oldNewStock = Number(oldProduct.stock) + Number(oldSale.quantity);
  let newNewStock = Number(newProduct.stock);
  if (productId === Number(oldSale.product_id)) {
    newNewStock = oldNewStock - quantity;
    if (newNewStock < 0) return res.status(409).json({ error: 'Not enough stock' });
  } else {
    newNewStock = Number(newProduct.stock) - quantity;
    if (newNewStock < 0) return res.status(409).json({ error: 'Not enough stock' });
  }

  const payload = { product_id: productId, product_name: newProduct.name, quantity, unit_price: unitPrice, total: quantity * unitPrice, sold_at: req.body.sold_at ? new Date(req.body.sold_at).toISOString() : oldSale.sold_at, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('sales').update(payload).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (productId === Number(oldSale.product_id)) {
    await supabase.from('products').update({ stock: newNewStock, updated_at: new Date().toISOString() }).eq('id', productId);
  } else {
    await supabase.from('products').update({ stock: oldNewStock, updated_at: new Date().toISOString() }).eq('id', oldSale.product_id);
    await supabase.from('products').update({ stock: newNewStock, updated_at: new Date().toISOString() }).eq('id', productId);
  }
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { data: sale, error: se } = await supabase.from('sales').select('*').eq('id', req.params.id).single();
  if (se) return res.status(404).json({ error: 'Sale not found' });
  const { data: p, error: pe } = await supabase.from('products').select('*').eq('id', sale.product_id).single();
  const { error } = await supabase.from('sales').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  if (!pe && p) await supabase.from('products').update({ stock: Number(p.stock || 0) + Number(sale.quantity), updated_at: new Date().toISOString() }).eq('id', p.id);
  res.json({ success: true });
});
module.exports = router;
