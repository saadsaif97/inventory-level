const express = require('express');
const axios = require('axios');
const app = express();
require('dotenv').config();
const cors = require('cors');

const allowedOrigins = ['https://www.amsel-fashion.com'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      return callback(new Error('Origin not allowed'), false);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Origin not allowed by CORS'), false);
    }
  },
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const SHOP = process.env.SHOP;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const LOCATION_IDS = ['69648154764', '105297772921'];

app.get("/", (req, res) => {
  res.status(200).send("Hi");
});

app.get('/apps/inventory', async (req, res) => {
  const { product_id } = req.query;

  if (!product_id) {
    return res.status(400).json({ error: 'Missing product_id' });
  }

  try {
    // Step 1: Fetch product variants from Shopify Admin API
    const productVariantsResponse = await axios.get(`https://${SHOP}/admin/api/2024-04/products/${product_id}/variants.json`, {
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN
      }
    });

    const variants = productVariantsResponse.data.variants;

    // Step 2: Extract inventory_item_ids and create mapping
    const variantToInventoryMap = {};
    const inventoryItemIds = [];

    variants.forEach(variant => {
      if (variant.inventory_item_id) {
        variantToInventoryMap[variant.id] = variant.inventory_item_id;
        inventoryItemIds.push(variant.inventory_item_id);
      }
    });

    if (inventoryItemIds.length === 0) {
      return res.status(404).json({ error: 'No inventory items found for this product.' });
    }

    // Step 3: Fetch inventory levels
    const inventoryResponse = await axios.get(`https://${SHOP}/admin/api/2024-04/inventory_levels.json`, {
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN
      },
      params: {
        inventory_item_ids: inventoryItemIds.join(','),
        location_ids: LOCATION_IDS.join(',')
      }
    });

    res.json({
      product_id,
      variant_to_inventory_map: variantToInventoryMap,
      inventory_levels: inventoryResponse.data.inventory_levels
    });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Error fetching inventory');
  }
});

app.listen(3000, () => {
  console.log('Inventory proxy running on port 3000');
});
