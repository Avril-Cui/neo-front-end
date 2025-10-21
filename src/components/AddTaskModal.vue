<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  show: boolean
  selectedHour?: number
}

const props = defineProps<Props>()
const emit = defineEmits(['close', 'submit'])

// Helper function to format time as HH:MM
const formatTime = (hour: number, minute: number = 0) => {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// Form data
const taskName = ref('')
const selectedCategory = ref('Work')
const duration = ref(1)
const selectedPriority = ref(3) // 1=lowest, 2=low, 3=medium, 4=high, 5=highest
const splittable = ref(false)
const showAdvanced = ref(false)
const deadline = ref('')
const slack = ref(0)
const notes = ref('')
const startTime = ref('')
const endTime = ref('')

const showCategoryDropdown = ref(false)

// Initialize start and end time based on selectedHour
watch(() => props.selectedHour, (hour) => {
  if (hour !== undefined) {
    startTime.value = formatTime(hour, 0)
    endTime.value = formatTime(hour + 1, 0)
  }
}, { immediate: true })

const categories = [
  { value: 'Work', icon: '💼', label: 'Work' },
  { value: 'Personal', icon: '👤', label: 'Personal' },
  { value: 'Health & Fitness', icon: '🏃', label: 'Health & Fitness' },
  { value: 'Education', icon: '📚', label: 'Education' },
  { value: 'Creative', icon: '🎨', label: 'Creative' }
]

const selectedCategoryData = computed(() => {
  return categories.find(c => c.value === selectedCategory.value) || categories[0]
})

const closeModal = () => {
  emit('close')
}

const adjustDuration = (change: number) => {
  const newValue = duration.value + change
  if (newValue >= 0.25 && newValue <= 8) {
    duration.value = newValue
  }
}

const selectCategory = (category: string) => {
  selectedCategory.value = category
  showCategoryDropdown.value = false
}

const selectPriority = (priority: number) => {
  selectedPriority.value = priority
}

const handleSubmit = () => {
  if (!taskName.value.trim()) return

  const formData = {
    taskName: taskName.value,
    category: selectedCategory.value,
    duration: duration.value * 60, // Convert to minutes
    priority: selectedPriority.value,
    splittable: splittable.value,
    startTime: startTime.value,
    endTime: endTime.value,
    deadline: deadline.value || null,
    slack: slack.value * 60, // Convert to minutes
    notes: notes.value || null,
    selectedHour: props.selectedHour
  }

  emit('submit', formData)
  closeModal()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container">
        <div class="modal-header">
          <h1 class="modal-title">Add New Task</h1>
          <button class="close-button" @click="closeModal">×</button>
        </div>

        <div class="modal-content">
          <form @submit.prevent="handleSubmit">
            <!-- Basic Information -->
            <div class="form-section">
              <div class="section-title">📋 Basic Information</div>

              <div class="field-group">
                <div class="input-field field-full">
                  <label class="input-label">Task Name *</label>
                  <div class="input-wrapper">
                    <div class="input-icon">😊</div>
                    <input
                      type="text"
                      class="task-input"
                      v-model="taskName"
                      placeholder="Task name..."
                      required
                    />
                  </div>
                </div>

                <div class="field-row">
                  <div class="select-field">
                    <label class="input-label">Category</label>
                    <div
                      class="custom-select"
                      :class="{ open: showCategoryDropdown }"
                      @click="showCategoryDropdown = !showCategoryDropdown"
                    >
                      <span>{{ selectedCategoryData.icon }} {{ selectedCategoryData.label }}</span>
                      <span class="select-icon">▼</span>
                    </div>
                    <div v-if="showCategoryDropdown" class="select-options">
                      <div
                        v-for="cat in categories"
                        :key="cat.value"
                        class="select-option"
                        @click="selectCategory(cat.value)"
                      >
                        <span>{{ cat.icon }}</span> {{ cat.label }}
                      </div>
                    </div>
                  </div>

                  <div class="duration-field">
                    <div>
                      <label class="input-label">Duration</label>
                      <div class="duration-input">
                        <input
                          type="number"
                          class="duration-value"
                          v-model.number="duration"
                          min="0.25"
                          max="8"
                          step="0.25"
                        />
                        <span class="duration-unit">hr</span>
                      </div>
                    </div>
                    <div class="duration-controls">
                      <button type="button" class="duration-btn" @click="adjustDuration(0.25)">+</button>
                      <button type="button" class="duration-btn" @click="adjustDuration(-0.25)">−</button>
                    </div>
                  </div>
                </div>

                <div class="field-row">
                  <div class="input-field">
                    <label class="input-label">Start Time</label>
                    <input
                      type="time"
                      class="time-input"
                      v-model="startTime"
                      required
                    />
                  </div>

                  <div class="input-field">
                    <label class="input-label">End Time</label>
                    <input
                      type="time"
                      class="time-input"
                      v-model="endTime"
                      required
                    />
                  </div>
                </div>

                <div class="field-row">
                  <div class="priority-full-width">
                    <label class="input-label">Priority</label>
                    <div class="priority-selector">
                      <div
                        class="priority-option lowest"
                        :class="{ selected: selectedPriority === 1 }"
                        @click="selectPriority(1)"
                      >
                        Lowest
                      </div>
                      <div
                        class="priority-option low"
                        :class="{ selected: selectedPriority === 2 }"
                        @click="selectPriority(2)"
                      >
                        Low
                      </div>
                      <div
                        class="priority-option medium"
                        :class="{ selected: selectedPriority === 3 }"
                        @click="selectPriority(3)"
                      >
                        Medium
                      </div>
                      <div
                        class="priority-option high"
                        :class="{ selected: selectedPriority === 4 }"
                        @click="selectPriority(4)"
                      >
                        High
                      </div>
                      <div
                        class="priority-option highest"
                        :class="{ selected: selectedPriority === 5 }"
                        @click="selectPriority(5)"
                      >
                        Highest
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="input-label">Split Task</label>
                    <div
                      class="toggle-field"
                      :class="{ active: splittable }"
                      @click="splittable = !splittable"
                    >
                      <div class="toggle-checkbox">✓</div>
                      <span class="toggle-label">Allow splitting</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Advanced Settings -->
            <div class="advanced-settings" :class="{ open: showAdvanced }">
              <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
                <div class="section-title">⚙️ Advanced Settings</div>
                <span class="advanced-icon">▼</span>
              </div>

              <div class="advanced-content">
                <div class="field-group">
                  <div class="field-row">
                    <div class="input-field">
                      <label class="input-label">Deadline (Optional)</label>
                      <input type="datetime-local" class="datetime-input" v-model="deadline" />
                    </div>

                    <div class="input-field">
                      <label class="input-label">Buffer Time (Optional)</label>
                      <div class="duration-input">
                        <input
                          type="number"
                          class="duration-value"
                          v-model.number="slack"
                          min="0"
                          max="4"
                          step="0.25"
                        />
                        <span class="duration-unit">hr</span>
                      </div>
                    </div>
                  </div>

                  <div class="input-field field-full">
                    <label class="input-label">Notes (Optional)</label>
                    <textarea
                      class="textarea-field"
                      v-model="notes"
                      placeholder="Add notes here... markdown supported"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons">
              <button type="button" class="btn btn-secondary" @click="closeModal">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                Create Task
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 20px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid #444;
}

.modal-header {
  padding: 24px 24px 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-title {
  font-size: 24px;
  font-weight: 700;
  color: #F5E8D8;
}

.close-button {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(245, 232, 216, 0.1);
  color: #F5E8D8;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 18px;
}

.close-button:hover {
  background: rgba(245, 232, 216, 0.2);
  transform: scale(1.1);
}

.modal-content {
  padding: 0 24px 24px 24px;
}

.form-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #F5E8D8;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-group {
  display: grid;
  gap: 20px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.field-full {
  grid-column: 1 / -1;
}

.input-label {
  font-size: 12px;
  font-weight: 600;
  color: #AAA;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  display: block;
}

.input-wrapper {
  position: relative;
}

.task-input {
  width: 100%;
  padding: 16px 20px 16px 52px;
  background: transparent;
  border: 2px solid rgba(121, 158, 255, 0.3);
  border-radius: 12px;
  color: #F5E8D8;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  outline: none;
}

.task-input:focus {
  border-color: #799EFF;
  box-shadow: 0 0 0 4px rgba(121, 158, 255, 0.1);
}

.task-input::placeholder {
  color: #666;
}

.input-icon {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: #799EFF;
}

.select-field {
  position: relative;
}

.custom-select {
  width: 100%;
  padding: 16px 20px;
  background: transparent;
  border: 2px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  color: #F5E8D8;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.custom-select:hover {
  border-color: #FF6F61;
}

.select-icon {
  font-size: 14px;
  transition: transform 0.2s ease;
}

.custom-select.open .select-icon {
  transform: rotate(180deg);
}

.select-options {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(42, 42, 42, 0.98);
  border: 1px solid #444;
  border-radius: 12px;
  backdrop-filter: blur(20px);
  z-index: 10;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.select-option {
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(68, 68, 68, 0.5);
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-option:last-child {
  border-bottom: none;
}

.select-option:hover {
  background: rgba(121, 158, 255, 0.1);
}

.duration-field {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
}

.duration-input {
  display: flex;
  align-items: center;
  background: transparent;
  border: 2px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 16px 20px;
  gap: 12px;
}

.duration-input:focus-within {
  border-color: #FF6F61;
}

.duration-value {
  font-size: 20px;
  font-weight: 700;
  color: #F5E8D8;
  background: transparent;
  border: none;
  outline: none;
  width: 60px;
  text-align: center;
}

.duration-unit {
  font-size: 14px;
  color: #AAA;
}

.duration-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.duration-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(121, 158, 255, 0.2);
  color: #799EFF;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.duration-btn:hover {
  background: rgba(121, 158, 255, 0.3);
}

.priority-full-width {
  grid-column: 1 / -1;
}

.priority-selector {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.priority-option {
  padding: 16px;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  font-weight: 600;
}

.priority-option.lowest {
  background: rgba(158, 158, 158, 0.1);
  color: #9E9E9E;
}

.priority-option.low {
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
}

.priority-option.medium {
  background: rgba(121, 158, 255, 0.1);
  color: #799EFF;
}

.priority-option.high {
  background: rgba(218, 165, 32, 0.1);
  color: #DAA520;
}

.priority-option.highest {
  background: rgba(255, 111, 97, 0.1);
  color: #FF6F61;
}

.priority-option.selected {
  border-color: currentColor;
}

.toggle-field {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: 2px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-field.active {
  border-color: #799EFF;
  background: rgba(121, 158, 255, 0.1);
}

.toggle-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #799EFF;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: all 0.2s ease;
  color: transparent;
}

.toggle-field.active .toggle-checkbox {
  background: #799EFF;
  color: #1C1C1C;
}

.toggle-label {
  font-size: 16px;
  font-weight: 500;
  color: #F5E8D8;
}

.advanced-settings {
  margin-top: 32px;
}

.advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  cursor: pointer;
  border-bottom: 1px solid rgba(245, 232, 216, 0.1);
  margin-bottom: 20px;
}

.advanced-icon {
  font-size: 16px;
  color: #799EFF;
  transition: transform 0.3s ease;
}

.advanced-settings.open .advanced-icon {
  transform: rotate(180deg);
}

.advanced-content {
  max-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.advanced-settings.open .advanced-content {
  max-height: 1000px;
}

.datetime-input {
  width: 100%;
  padding: 16px 20px;
  background: transparent;
  border: 2px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  color: #F5E8D8;
  font-size: 16px;
  transition: all 0.3s ease;
  outline: none;
}

.datetime-input:focus {
  border-color: #FF6F61;
}

.time-input {
  width: 100%;
  padding: 16px 20px;
  background: transparent;
  border: 2px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  color: #F5E8D8;
  font-size: 16px;
  transition: all 0.3s ease;
  outline: none;
  font-family: inherit;
}

.time-input:focus {
  border-color: #799EFF;
  box-shadow: 0 0 0 4px rgba(121, 158, 255, 0.1);
}

.textarea-field {
  width: 100%;
  min-height: 100px;
  padding: 16px 20px;
  background: transparent;
  border: 2px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  color: #F5E8D8;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  transition: all 0.3s ease;
  outline: none;
  font-family: inherit;
}

.textarea-field:focus {
  border-color: #FF6F61;
}

.textarea-field::placeholder {
  color: #666;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid rgba(245, 232, 216, 0.1);
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: transparent;
  color: #AAA;
  border: 1px solid rgba(245, 232, 216, 0.2);
}

.btn-secondary:hover {
  background: rgba(245, 232, 216, 0.05);
  color: #F5E8D8;
}

.btn-primary {
  background: linear-gradient(135deg, #799EFF 0%, #6B8FFF 100%);
  color: #1C1C1C;
  font-weight: 700;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #6B8FFF 0%, #5B7FFF 100%);
  transform: translateY(-1px);
}
</style>
