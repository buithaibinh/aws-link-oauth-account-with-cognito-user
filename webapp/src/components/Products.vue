<template>
  <div>
    <h1>Products</h1>
    <ul>
      <li v-for="product in products" :key="product.id">
        {{ product.name }} - {{ product.price }} USD

        <!-- add to cart button -->
        <button @click="addToCart(product)">
          {{ cart.includes(product) ? "Remove from cart" : "Add to cart" }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { reactive } from "vue";

// mock some products data reactivity
const products = reactive([
  {
    id: 1,
    name: "Product 1",
    price: 10,
    added: false,
  },
  {
    id: 2,
    name: "Product 2",
    price: 20,
    added: false,
  },
  {
    id: 3,
    name: "Product 3",
    price: 30,
    added: false,
  },
]);

// user cart
const cart = reactive([]);
// load cart from API
const loadCart = async () => {
  console.log("Load cart from API");

  // mock cart data
  cart.push(products[0]);
};

const saveCart = async () => {
  console.log("Save cart to API", cart);
};

// add to cart function
const addToCart = async (product) => {
  console.log("Add to cart", product);

  // if product is already in cart, remove it
  if (cart.includes(product)) {
    cart.splice(cart.indexOf(product), 1);
  } else {
    // otherwise add it
    cart.push(product);
  }

  // make a debounce call to save cart
  // to avoid multiple calls to API
  if (addToCart.timeout) {
    console.log("Clear timeout");
    clearTimeout(addToCart.timeout);
  }

  addToCart.timeout = setTimeout(() => {
    saveCart();
  }, 500);
};

loadCart();
</script>

<style scoped>
ul {
  list-style: none;
  padding: 0;
}
li {
  margin: 10px 0;
}
</style>
