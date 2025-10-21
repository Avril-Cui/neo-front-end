<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <h2 class="modal-title">Schedule Preferences</h2>
      <p class="modal-description">Enter your scheduling preferences to help the AI optimize your schedule:</p>

      <textarea
        v-model="preference"
        class="preference-input"
        placeholder="e.g., I prefer to work on important tasks in the morning, need breaks every 2 hours, avoid scheduling after 6 PM..."
        rows="6"
      ></textarea>

      <div class="button-group">
        <button class="cancel-button" @click="close">Cancel</button>
        <button class="proceed-button" @click="proceed">Proceed Schedule</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  proceed: [preference: string]
}>()

const preference = ref('')

// Reset preference when modal is opened
watch(() => props.show, (newShow) => {
  if (newShow) {
    preference.value = ''
  }
})

const close = () => {
  emit('close')
}

const proceed = () => {
  if (preference.value.trim()) {
    emit('proceed', preference.value.trim())
  } else {
    alert('Please enter your scheduling preferences')
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 16px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border: 1px solid #444;
}

.modal-title {
  font-size: 24px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 12px;
}

.modal-description {
  font-size: 14px;
  color: #AAA;
  margin-bottom: 20px;
  line-height: 1.5;
}

.preference-input {
  width: 100%;
  background: #1a1a1a;
  border: 2px solid #444;
  border-radius: 8px;
  padding: 12px;
  color: #F5E8D8;
  font-size: 14px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  resize: vertical;
  margin-bottom: 24px;
  transition: border-color 0.3s ease;
}

.preference-input:focus {
  outline: none;
  border-color: #FFC636;
}

.preference-input::placeholder {
  color: #666;
}

.button-group {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.cancel-button,
.proceed-button {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid;
}

.cancel-button {
  background: transparent;
  border-color: #FF4444;
  color: #FF4444;
}

.cancel-button:hover {
  background: rgba(255, 68, 68, 0.1);
  transform: translateY(-1px);
}

.proceed-button {
  background: rgba(76, 175, 80, 0.2);
  border-color: #4CAF50;
  color: #4CAF50;
}

.proceed-button:hover {
  background: rgba(76, 175, 80, 0.3);
  transform: translateY(-1px);
}
</style>
