const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

const allowedOrigins = ['https://www.amsel-fashion.com', 'https://moa-net.de'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(new Error('Origin not allowed'), false);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'), false);
  },
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Store configurations
const stores = {
  amsel: {
    shop: process.env.SHOP,
    accessToken: process.env.ACCESS_TOKEN,
    locationIds: ['69648154764', '105297772921'],
  },
  moanet: {
    shop: process.env.MOANET_SHOP,
    accessToken: process.env.MOANET_ACCESS_TOKEN,
    locationIds: ['79503720773', '108306825541'],
  },
};

// Root route
app.get("/", (req, res) => {
  res.status(200).send("Hi");
});

// Generic inventory fetch handler
async function getInventory({ product_id, shop, accessToken, locationIds }) {
  // 1. Get product variants
  const variantsRes = await axios.get(`https://${shop}/admin/api/2024-04/products/${product_id}/variants.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });

  const variants = variantsRes.data.variants;

  const variantToInventoryMap = {};
  const inventoryItemIds = [];

  variants.forEach(variant => {
    if (variant.inventory_item_id) {
      variantToInventoryMap[variant.id] = variant.inventory_item_id;
      inventoryItemIds.push(variant.inventory_item_id);
    }
  });

  if (inventoryItemIds.length === 0) {
    throw new Error('No inventory items found for this product.');
  }

  // 2. Get inventory levels
  const inventoryRes = await axios.get(`https://${shop}/admin/api/2024-04/inventory_levels.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
    params: {
      inventory_item_ids: inventoryItemIds.join(','),
      location_ids: locationIds.join(','),
    },
  });

  return {
    variant_to_inventory_map: variantToInventoryMap,
    inventory_levels: inventoryRes.data.inventory_levels,
  };
}

// Dynamic route for multiple stores
app.get('/:store/inventory', async (req, res) => {
  const { store } = req.params;
  const { product_id } = req.query;

  const storeConfig = stores[store];

  if (!storeConfig) {
    return res.status(404).json({ error: 'Store not found' });
  }

  if (!product_id) {
    return res.status(400).json({ error: 'Missing product_id' });
  }

  try {
    const data = await getInventory({
      product_id,
      shop: storeConfig.shop,
      accessToken: storeConfig.accessToken,
      locationIds: storeConfig.locationIds,
    });

    res.json({ product_id, ...data });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Error fetching inventory' });
  }
});

app.listen(3000, () => {
  console.log('Inventory proxy running at http://localhost:3000');
});
