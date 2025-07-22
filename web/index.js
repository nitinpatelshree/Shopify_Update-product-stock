// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import getProducts from "./get-products.js";
import GDPRWebhookHandlers from "./gdpr.js";

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: GDPRWebhookHandlers })
);

// All endpoints after this point will require an active session
app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

app.get("/api/products/count", async (_req, res) => {
  const countData = await shopify.api.rest.Product.count({
    session: res.locals.shopify.session,
  });
  res.status(200).send(countData);
});

app.get("/api/products/create", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.get("/api/products/list/shop", async (_req, res) => {
  const getAllProducts = async (since_id, previousResponse = []) => {
    let response = await shopify.api.rest.Product.all({
      session: res.locals.shopify.session,
      limit: 250,
      since_id: since_id,
      fields:'id'
    });
    let newResponse = await response;
    response = [...previousResponse, ...newResponse]; // Combine the two arrays
    if (newResponse.length !== 0) {
      since_id = newResponse[newResponse.length - 1].id;
      return getAllProducts(since_id, response);
    }
    return response;
  }
  const allProducts = await getAllProducts(0);

  res.send(allProducts);
});
app.get("/api/product/shop/:product_id", async (_req, res) => {
  const getProductById = await getProducts(
    res.locals.shopify.session,
    _req.params.product_id
  );
  res.send(getProductById);
});

app.get("/api/inventory_items/trackedStatus/:inventory_items_id", async (_req, res) => {
  const inventory_item = new shopify.api.rest.InventoryItem({session: res.locals.shopify.session});
  inventory_item.id = _req.params.inventory_items_id;
  inventory_item.tracked = true;
  await inventory_item.save({
    update: true,
  });
  res.send(inventory_item);
});

app.get("/api/inventory_levels/stock/set/:inventoryItemId/:locationId/:available", async (_req, res) => {
    const inventory_level = new shopify.api.rest.InventoryLevel({session: res.locals.shopify.session});
    await inventory_level.set({
      body: {
        "location_id": _req.params.locationId, 
        "inventory_item_id": _req.params.inventoryItemId, 
        "available": _req.params.available},
    });
    res.send(inventory_level);
});

app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

app.listen(PORT);
