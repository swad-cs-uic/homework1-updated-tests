import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Window } from "happy-dom";
import { start_server } from "../src/app.js";
import { product } from "../src/schema.js";
import { eq, count } from "drizzle-orm";
import { db } from "../src/db.js";

describe("Homework 1 Tests", () => {
  let window;
  let document;
  let app;
  const addedProductIds = []; // Keep track of added products for cleanup

  beforeAll(async () => {
    window = new Window({ url: "http://localhost:3000" });
    document = window.document;
    global.window = window;
    global.document = document;

    // Start the server
    app = await start_server();
  });

  afterEach(async () => {
    // Clean up any products added during tests
    for (const id of addedProductIds) {
      await db.delete(product).where(eq(product.id, id));
    }
    addedProductIds.length = 0; // Clear the array
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

  it("(5pts) should navigate through pages and display different products", async () => {
    const res1 = await app.request("/?page=1");
    const html1 = await res1.text();
    document.body.innerHTML = html1;
    const productsPage1 = Array.from(
      document.querySelectorAll(".product-card p")
    ).map((el) => el.textContent);

    const res2 = await app.request("/?page=2");
    const html2 = await res2.text();
    document.body.innerHTML = html2;
    const productsPage2 = Array.from(
      document.querySelectorAll(".product-card p")
    ).map((el) => el.textContent);

    const res6 = await app.request("/?page=6");
    const html6 = await res6.text();
    document.body.innerHTML = html6;
    const productsPage6 = Array.from(
      document.querySelectorAll(".product-card p")
    ).map((el) => el.textContent);
    expect(productsPage1).not.empty;
    expect(productsPage2).not.empty;
    expect(productsPage6).not.empty;
    // Check if products on page 1 and page 2 are different
    expect(productsPage1).not.toEqual(productsPage2);

    // Check if products on page 1 and page 6 are different
    expect(productsPage1).not.toEqual(productsPage6);

    // Check if products on page 2 and page 6 are different
    expect(productsPage2).not.toEqual(productsPage6);
  });

  it("(5pts) should add a new product to the database and confirm it appears on the page", async () => {
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

    // Query the database directly to verify the product was added
    const addedProduct = db
      .select()
      .from(product)
      .where(eq(product.name, "Test Example Product"))
      .get();

    expect(addedProduct).toBeDefined();
    expect(addedProduct.name).toBe("Test Example Product");
    // Add the product ID to the cleanup list
    addedProductIds.push(addedProduct.id);
  });

  it("(5pts) should delete a product from the database and confirm it is not visible", async () => {
    // First, get the initial page to find a product ID
    let res = await app.request("/");
    let html = await res.text();
    document.body.innerHTML = html;

    const firstProduct = document.querySelector(".product-card");
    const deleteId = firstProduct.querySelector("p").textContent.split(": ")[1];

    // Now delete the product
    let formData = new FormData();
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

    // Add a product to delete
    const productToDelete = db
      .insert(product)
      .values({
        name: "Product to Delete",
        image_url: "http://localhost:3000/public/placeholder.png",
      })
      .returning()
      .get();

    addedProductIds.push(productToDelete.id);

    formData = new FormData();
    formData.append("productID", productToDelete.id);

    await app.request("/delete", {
      method: "POST",
      body: formData,
    });

    // Query the database directly to verify the product was marked as deleted
    const deletedProduct = db
      .select()
      .from(product)
      .where(eq(product.id, productToDelete.id))
      .get();

    expect(deletedProduct.deleted).toBe(true);
  });

  it("(5pts) should search for a product and display the results", async () => {
    // Add the product we want to search for to the db 
    const productToSearch = db
      .insert(product)
      .values({
        name: "Test",
        image_url: "http://localhost:3000/public/placeholder.png",
      })
      .returning()
      .get();
    addedProductIds.push(productToSearch.id);

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

  it("(5pts) should return correct number of products for pagination", async () => {
    const itemsPerPage = 10;
    const page = 1;

    const res = await app.request(`/?page=${page}`);
    const html = await res.text();
    document.body.innerHTML = html;

    const totalProducts = db
      .select({ count: count() })
      .from(product)
      .where(eq(product.deleted, 0))
      .get().count;

    const expectedProductCount = Math.ceil(totalProducts / itemsPerPage);
    const paginationLinks = document.querySelectorAll(".pagination a");
    expect(paginationLinks.length + 1).toBe(expectedProductCount);
  });
});
