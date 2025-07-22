import { GraphqlQueryError } from "@shopify/shopify-api";
import shopify from "./shopify.js";

export default async function getProducts(
  session,
  product_id
) {
  const client = new shopify.api.clients.Graphql({ session });

      let getProduct = await client.query({
        data: `
        {
          product(id: "gid://shopify/Product/${product_id}") {
            variants(first: 25) {
              nodes {
                id
                metafield(key: "alef_code", namespace: "custom") {
                  value
                }
                inventoryItem {
                  id
                  tracked
                  inventoryLevels(first: 17) {
                    nodes {
                      id
                      available
                      location {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
        `
      });
  return getProduct.body;
}
