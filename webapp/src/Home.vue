<template>
  <div id="app">
    <authenticator social-providers="['google']"> </authenticator>

    <template v-if="auth.route === 'authenticated'">
      <h1>Authenticated</h1>
      <p>Hello: {{ auth.user.username }}</p>
      <button @click="auth.signOut">Sign out</button>
      <hr />
    </template>

    <!-- show products only if user is authenticated -->
    <template v-if="auth.route === 'authenticated'">
      <Products />
    </template>
  </div>
</template>

<script setup>
import { Authenticator, useAuthenticator } from "@aws-amplify/ui-vue";
import Products from "./components/Products.vue";

const auth = useAuthenticator();
</script>
