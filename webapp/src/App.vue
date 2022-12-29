<template>
  <router-view />
</template>

<script setup>
import { useRoute, useRouter } from "vue-router";
import { watchEffect } from "vue";

const route = useRoute();
const router = useRouter();
// watch route error_description
watchEffect(() => {
  if (
    route.query.error_description &&
    /already.found.an.entry.for.username/gi.test(route.query.error_description)
  ) {
    // notify user that username is already has been linked to another account
    // and ask them to login with that account
    router.push({ path: "/" });
  }
});
</script>
