/*

  Name:  Jasen Garcia
  HW:    1
  Tests: Added more meaningful tests for HW1 - EC
  Date:  09/13/2024

*/

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Window } from "happy-dom";
import { start_server } from "../src/app.js";

// Imports added for test purposes
import { db } from "../src/db.js";
import { product } from "../src/schema.js";
import { eq, and } from "drizzle-orm";

describe("Homework 1 Tests", () => {
  let window;
  let document;
  let app;

  beforeAll(async () => {
    window = new Window({ url: "http://localhost:3000" });
    document = window.document;
    global.window = window;
    global.document = document;

    // Start the server
    app = await start_server();
  });

  afterAll(() => {
    window.close();
    global.window = undefined;
    global.document = undefined;
  });

  it("(5pts) should display products on home page", async () => {
    const res = await app.request("/");
    const html = await res.text();
    document.body.innerHTML = html;

    const productCards = document.querySelectorAll(".product-card");
    expect(productCards.length).toBe(10);
  });

  it("(5pts) should navigate through pages and display products", async () => {
    const res = await app.request("/?page=9");
    const html = await res.text();
    document.body.innerHTML = html;

    const productCards = document.querySelectorAll(".product-card");
    expect(productCards.length).toBe(10);
  });

  it("(5pts) should add a new product and confirm it appears on the page", async () => {
    const formData = new FormData();
    formData.append("name", "Test Example Product");
    formData.append(
      "image_url",
      "http://localhost:3000/public/placeholder.png"
    );

    await app.request("/add", {
      method: "POST",
      body: formData,
    });

    // Function to get the total number of pages
    const getTotalPages = async () => {
      const res = await app.request("/");
      const html = await res.text();
      document.body.innerHTML = html;
      const paginationLinks = document.querySelectorAll(".pagination a");
      const lastPageLink = paginationLinks[paginationLinks.length - 1];
      return parseInt(lastPageLink.textContent);
    };

    // Get the last page number
    const lastPage = await getTotalPages();

    // Fetch the last page
    const res = await app.request(`/?page=${lastPage}`);
    const html = await res.text();
    document.body.innerHTML = html;

    const productNames = Array.from(
      document.querySelectorAll(".product-card h3")
    ).map((el) => el.textContent);

    expect(productNames).toContain("Test Example Product");
  });

  it("(5pts) should delete a product and confirm it is not visible", async () => {
    // First, get the initial page to find a product ID
    let res = await app.request("/");
    let html = await res.text();
    document.body.innerHTML = html;

    const firstProduct = document.querySelector(".product-card");
    const deleteId = firstProduct.querySelector("p").textContent.split(": ")[1];

    console.log("ID that's being deleted first during testing", deleteId);

    // Now delete the product
    const formData = new FormData();
    formData.append("productID", deleteId);

    res = await app.request("/delete", {
      method: "POST",
      body: formData,
    });

    html = await res.text();
    document.body.innerHTML = html;

    const productCards = document.querySelectorAll(".product-card");

    productCards.forEach((card) => {
      const id = card.querySelector("p").textContent.split(": ")[1];
      expect(id).not.toBe(deleteId);
    });
  });

  it("(5pts) should search for a product and display the results", async () => {
    const res = await app.request("/?query=Test");
    const html = await res.text();
    document.body.innerHTML = html;

    const productCards = document.querySelectorAll(".product-card");
    expect(productCards.length).toBeGreaterThan(0);

    productCards.forEach((card) => {
      const productName = card.querySelector("h3").textContent;
      expect(productName.toLowerCase()).toContain("test");
    });
  });



  /* ---------------------------------------- */
  /* ---------------------------------------- */
  /* ---------------------------------------- */
  /* ---------------------------------------- */
  /* --- Self-Made Extra Tests Below Here --- */
  /* ---                                  --- */
  /* ---                                  --- */
  
  it("(5pts) *self-made* should not display deleted products (Differs in fetching & logic handling)", async () => {
    // Fetches a single product to delete (Deletes the first item avail from page 1)
    const productToDelete = await db
      .select()
      .from(product)
      .where(eq(product.deleted, 0)) // This makes sure non-deleted products are fetched
      .limit(1)
      .get();
    
      console.log("ID that's being deleted second during testing", productToDelete); // Displays the deleted product on terminal (Testing purposes - Reset DB by typing "node src/seed.js")

    // If no product is found then we skip the deletion step
    if (!productToDelete) {
      console.log("No products available to delete!");
      return;
    }
  
    // Marks the product as deleted
    await db.update(product).set({ deleted: 1 }).where(eq(product.id, productToDelete.id));
  
    const deletedProduct = await db
      .select()
      .from(product)
      .where(and(eq(product.id, productToDelete.id), eq(product.deleted, 1)))
      .get();

    expect(deletedProduct).toBeDefined();

    // Then it refreshes the page after deletion
    const res = await app.request("/");
    const html = await res.text();
    document.body.innerHTML = html;
  
    // Makes sure that the deleted product is not displayed!
    const productIds = Array.from(document.querySelectorAll(".product-card p"))
      .map((el) => el.textContent.split(": ")[1]);
  
    expect(productIds).not.toContain(productToDelete.id.toString());
  }); 
  
  it("(5pts) *self-made* should handle deleting a non-existent product gracefully", async () => {
    // Starts by counting the total number of products we have
    const getTotalProductCount = async () => {
      const res = await app.request("/");
      const html = await res.text();

      document.body.innerHTML = html;

      const productCards = document.querySelectorAll(".product-card");

      return productCards.length;
    };
  
    // Gets the initial product count
    const initialProductCount = await getTotalProductCount();
  
    // To try to delete a non-existent product ID ("606" in this case)
    const formData = new FormData();
    formData.append("productID", "606"); // A non-existent product ID as "606"
  
    const res = await app.request("/delete", {
      method: "POST",
      body: formData,
    });
  
    expect(res.status).toBe(200);
  
    // Checks if the response contains the JavaScript alert
    const html = await res.text();
    expect(html).toContain('alert("Product not found or already deleted!")');
  
    // Gets the updated product count
    const updatedProductCount = await getTotalProductCount();
  
    // This makes sure that the product count has not changed!
    expect(updatedProductCount).toBe(initialProductCount);
  });

  it("(5pts) *self-made* should display a msg when no products match the search query", async () => {
    const res = await app.request("/?query=NonExistentProduct");
    const html = await res.text();
    document.body.innerHTML = html;
  
    const noResultsMessage = document.querySelector("p").textContent;
    expect(noResultsMessage).toBe("No products found.");
  });
  
  it("(5pts) *self-made* should handle accessing a page # beyond the total # of pages", async () => {
    const res = await app.request("/?page=696"); // Putting a large page number "696"
    const html = await res.text();
    document.body.innerHTML = html;
  
    const productCards = document.querySelectorAll(".product-card");
    expect(productCards.length).toBe(0);         // No products should be displayed!
  
    const noProductsMessage = document.querySelector("p").textContent;
    expect(noProductsMessage).toBe("No products found.");
  });
  
  
});
