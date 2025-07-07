const express = require('express');
const axios = require('axios');
const app = express();
require('dotenv').config(); // Load .env variables


const SHOP = process.env.SHOP;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const LOCATION_IDS = ['69648154764', '105297772921']; // Add more if needed

app.get("/", (req, res) => {
  res.status(200).send("Hi");
});

app.get('/apps/inventory', async (req, res) => {
  const { product_id } = req.query;

  if (!product_id) {
    return res.status(400).json({ error: 'Missing product_id' });
  }

  try {
    // Step 1: Get all variants of the product
    const productVariantsResponse = await axios.get(`https://${SHOP}/admin/api/2024-04/products/${product_id}/variants.json`, {
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN
      }
    });

    const variants = productVariantsResponse.data.variants;

    // Step 2: Extract inventory_item_ids
    const inventoryItemIds = variants.map(variant => variant.inventory_item_id).filter(Boolean);

    if (inventoryItemIds.length === 0) {
      return res.status(404).json({ error: 'No inventory items found for this product.' });
    }

    // Step 3: Fetch inventory levels for all inventory_item_ids at the given locations
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
      inventory_levels: inventoryResponse.data.inventory_levels,
      inventory_item_ids: inventoryItemIds
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Error fetching inventory');
  }
});

app.listen(3000, () => {
  console.log('Inventory proxy running on port 3000');
});
