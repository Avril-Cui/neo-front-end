<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-content">
      <div class="spinner"></div>
      <h2 class="modal-title">{{ title }}</h2>
      <p class="modal-description">{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  title?: string
  description?: string
}>()
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  backdrop-filter: blur(6px);
}

.modal-content {
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 16px;
  padding: 40px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border: 1px solid #444;
  text-align: center;
}

.spinner {
  width: 60px;
  height: 60px;
  border: 4px solid #444;
  border-top-color: #FFC636;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 24px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 8px;
}

.modal-description {
  font-size: 14px;
  color: #AAA;
  line-height: 1.5;
}
</style>
