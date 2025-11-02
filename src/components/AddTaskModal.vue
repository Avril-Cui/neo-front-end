<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { TaskCatalogAPI, type Task } from '../services/api'
import { useAuthStore } from '../stores/auth'

interface Props {
  show: boolean
  selectedHour?: number
  editMode?: boolean
  taskData?: {
    taskId: string
    taskName: string
    category: string
    duration: number
    priority: number
    splittable: boolean
    deadline?: string
    slack?: number
    note?: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits(['close', 'submit', 'update'])

// Auth store
const authStore = useAuthStore()
const CURRENT_USER = authStore.getCurrentUserId() || 'Friday'

// Helper function to format time as HH:MM
const formatTime = (hour: number, minute: number = 0) => {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// Form data
const taskName = ref('')
const selectedCategory = ref('Work')
const selectedPriority = ref(3) // 1=lowest, 2=low, 3=medium, 4=high, 5=highest
const splittable = ref(false)
const showAdvanced = ref(false)
const deadline = ref('')
const slack = ref(0)
const notes = ref('')
const startTime = ref('')
const endTime = ref('')
const selectedPreDependencies = ref<string[]>([])

const showCategoryDropdown = ref(false)

// Fetch all tasks for predependency selection
const allTasks = ref<Task[]>([])
const showPreDependencyDropdown = ref(false)
const preDependencySearchQuery = ref('')

// Computed property to calculate duration from start and end times
const calculatedDuration = computed(() => {
  if (!startTime.value || !endTime.value) return 60 // Default 1 hour in minutes

  const [startHours, startMinutes] = startTime.value.split(':').map(Number)
  const [endHours, endMinutes] = endTime.value.split(':').map(Number)

  const startTotalMinutes = startHours * 60 + startMinutes
  const endTotalMinutes = endHours * 60 + endMinutes

  return endTotalMinutes - startTotalMinutes
})

// Filter tasks based on search query
const filteredTasks = computed(() => {
  if (!preDependencySearchQuery.value.trim()) {
    return allTasks.value
  }
  const query = preDependencySearchQuery.value.toLowerCase()
  return allTasks.value.filter(task =>
    task.taskName.toLowerCase().includes(query) ||
    task.category.toLowerCase().includes(query)
  )
})

// Fetch all user tasks when modal opens
watch(() => props.show, async (isVisible) => {
  if (isVisible) {
    try {
      allTasks.value = await TaskCatalogAPI.getUserTasks(CURRENT_USER)
    } catch (error) {
      console.error('Failed to fetch tasks for predependency:', error)
      allTasks.value = []
    }
  }
}, { immediate: true })

// Initialize start and end time based on selectedHour
watch(() => props.selectedHour, (hour) => {
  if (hour !== undefined) {
    startTime.value = formatTime(hour, 0)
    endTime.value = formatTime(hour + 1, 0)
  }
}, { immediate: true })

// Populate form fields when editing a task
watch(() => props.taskData, (data) => {
  if (data && props.editMode) {
    taskName.value = data.taskName
    selectedCategory.value = data.category
    selectedPriority.value = data.priority
    splittable.value = data.splittable
    deadline.value = data.deadline || ''
    slack.value = data.slack ? data.slack / 60 : 0 // Convert from minutes to hours
    notes.value = data.note || ''
  }
}, { immediate: true })

const defaultCategories = [
  { value: 'Work', icon: '💼', label: 'Work' },
  { value: 'Personal', icon: '👤', label: 'Personal' },
  { value: 'Health & Fitness', icon: '🏃', label: 'Health & Fitness' },
  { value: 'Education', icon: '📚', label: 'Education' }
]

const showCustomCategoryInput = ref(false)
const customCategoryInput = ref('')

const selectedCategoryData = computed(() => {
  const defaultCat = defaultCategories.find(c => c.value === selectedCategory.value)
  if (defaultCat) {
    return defaultCat
  }
  // For custom categories, use a generic icon
  return { value: selectedCategory.value, icon: '📌', label: selectedCategory.value }
})

const closeModal = () => {
  emit('close')
}

const selectCategory = (category: string) => {
  if (category === 'custom') {
    showCustomCategoryInput.value = true
    customCategoryInput.value = ''
  } else {
    selectedCategory.value = category
    showCategoryDropdown.value = false
    showCustomCategoryInput.value = false
  }
}

const confirmCustomCategory = () => {
  if (customCategoryInput.value.trim()) {
    selectedCategory.value = customCategoryInput.value.trim()
    showCustomCategoryInput.value = false
    showCategoryDropdown.value = false
  }
}

const cancelCustomCategory = () => {
  showCustomCategoryInput.value = false
  customCategoryInput.value = ''
}

const selectPriority = (priority: number) => {
  selectedPriority.value = priority
}

const togglePreDependency = (taskId: string) => {
  const index = selectedPreDependencies.value.indexOf(taskId)
  if (index > -1) {
    selectedPreDependencies.value.splice(index, 1)
  } else {
    selectedPreDependencies.value.push(taskId)
  }
}

// Clear search query when dropdown closes
watch(showPreDependencyDropdown, (isOpen) => {
  if (!isOpen) {
    preDependencySearchQuery.value = ''
  }
})

const handleSubmit = () => {
  if (!taskName.value.trim()) return

  const formData = {
    taskId: props.taskData?.taskId,
    taskName: taskName.value,
    category: selectedCategory.value,
    duration: calculatedDuration.value, // Use calculated duration in minutes
    priority: selectedPriority.value,
    splittable: splittable.value,
    startTime: startTime.value,
    endTime: endTime.value,
    deadline: deadline.value || null,
    slack: slack.value * 60, // Convert to minutes
    notes: notes.value || null,
    selectedHour: props.selectedHour,
    preDependencies: selectedPreDependencies.value
  }

  if (props.editMode) {
    emit('update', formData)
  } else {
    emit('submit', formData)
  }
  closeModal()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container">
        <div class="modal-header">
          <h1 class="modal-title">{{ editMode ? 'Edit Task' : 'Add New Task' }}</h1>
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
                        v-for="cat in defaultCategories"
                        :key="cat.value"
                        class="select-option"
                        @click="selectCategory(cat.value)"
                      >
                        <span>{{ cat.icon }}</span> {{ cat.label }}
                      </div>
                      <div class="select-option custom-option" @click="selectCategory('custom')">
                        <span>➕</span> Custom Category
                      </div>
                    </div>
                    <!-- Custom category input popup -->
                    <div v-if="showCustomCategoryInput" class="custom-category-popup">
                      <div class="custom-category-header">Enter Custom Category</div>
                      <input
                        type="text"
                        class="custom-category-input"
                        v-model="customCategoryInput"
                        placeholder="e.g., Hobby, Finance..."
                        @keyup.enter="confirmCustomCategory"
                        @keyup.esc="cancelCustomCategory"
                        autofocus
                      />
                      <div class="custom-category-actions">
                        <button type="button" class="custom-btn cancel" @click="cancelCustomCategory">
                          Cancel
                        </button>
                        <button type="button" class="custom-btn confirm" @click="confirmCustomCategory">
                          Confirm
                        </button>
                      </div>
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
                    <label class="input-label">Pre-Dependencies (Optional)</label>
                    <div class="predependency-selector">
                      <div
                        class="predependency-button"
                        @click="showPreDependencyDropdown = !showPreDependencyDropdown"
                      >
                        <span v-if="selectedPreDependencies.length === 0">Select tasks...</span>
                        <span v-else>{{ selectedPreDependencies.length }} task(s) selected</span>
                        <span class="select-icon">▼</span>
                      </div>
                      <div v-if="showPreDependencyDropdown" class="predependency-options">
                        <div class="predependency-search">
                          <input
                            type="text"
                            class="predependency-search-input"
                            v-model="preDependencySearchQuery"
                            placeholder="Search tasks..."
                            @click.stop
                          />
                        </div>
                        <div class="predependency-list">
                          <div
                            v-for="task in filteredTasks"
                            :key="task.taskId"
                            class="predependency-option"
                            :class="{ selected: selectedPreDependencies.includes(task.taskId) }"
                            @click="togglePreDependency(task.taskId)"
                          >
                            <div class="task-checkbox">
                              <span v-if="selectedPreDependencies.includes(task.taskId)">✓</span>
                            </div>
                            <div class="task-info">
                              <div class="task-name-compact">{{ task.taskName }}</div>
                              <div class="task-category-compact">{{ task.category }}</div>
                            </div>
                          </div>
                          <div v-if="filteredTasks.length === 0 && allTasks.length > 0" class="predependency-empty">
                            No matching tasks
                          </div>
                          <div v-if="allTasks.length === 0" class="predependency-empty">
                            No tasks available
                          </div>
                        </div>
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
                {{ editMode ? 'Update Task' : 'Create Task' }}
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

.select-option.custom-option {
  color: #799EFF;
  font-weight: 600;
  border-top: 1px solid rgba(68, 68, 68, 0.5);
}

.custom-category-popup {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(42, 42, 42, 0.98);
  border: 2px solid #799EFF;
  border-radius: 12px;
  backdrop-filter: blur(20px);
  z-index: 20;
  margin-top: 4px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.custom-category-header {
  font-size: 13px;
  font-weight: 600;
  color: #799EFF;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.custom-category-input {
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: 2px solid rgba(245, 232, 216, 0.2);
  border-radius: 8px;
  color: #F5E8D8;
  font-size: 15px;
  transition: all 0.2s ease;
  outline: none;
  margin-bottom: 12px;
}

.custom-category-input:focus {
  border-color: #799EFF;
  box-shadow: 0 0 0 3px rgba(121, 158, 255, 0.1);
}

.custom-category-input::placeholder {
  color: #666;
}

.custom-category-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.custom-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.custom-btn.cancel {
  background: transparent;
  color: #AAA;
  border: 1px solid rgba(245, 232, 216, 0.2);
}

.custom-btn.cancel:hover {
  background: rgba(245, 232, 216, 0.05);
  color: #F5E8D8;
}

.custom-btn.confirm {
  background: #799EFF;
  color: #1C1C1C;
}

.custom-btn.confirm:hover {
  background: #6B8FFF;
  transform: translateY(-1px);
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
  background: rgba(153, 153, 153, 0.2);
  color: #999;
}

.priority-option.low {
  background: rgba(244, 196, 48, 0.2);
  color: #F4C430;
}

.priority-option.medium {
  background: rgba(255, 140, 0, 0.2);
  color: #FF8C00;
}

.priority-option.high {
  background: rgba(255, 111, 97, 0.2);
  color: #FF6F61;
}

.priority-option.highest {
  background: rgba(255, 61, 0, 0.2);
  color: #FF3D00;
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

/* Pre-dependency selector */
.predependency-selector {
  position: relative;
}

.predependency-button {
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

.predependency-button:hover {
  border-color: #799EFF;
}

.predependency-options {
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
  overflow: hidden;
}

.predependency-search {
  padding: 12px;
  border-bottom: 1px solid rgba(68, 68, 68, 0.5);
  background: rgba(30, 30, 30, 0.5);
}

.predependency-search-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(245, 232, 216, 0.05);
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 8px;
  color: #F5E8D8;
  font-size: 14px;
  transition: all 0.2s ease;
  outline: none;
}

.predependency-search-input:focus {
  border-color: #799EFF;
  background: rgba(245, 232, 216, 0.08);
  box-shadow: 0 0 0 3px rgba(121, 158, 255, 0.1);
}

.predependency-search-input::placeholder {
  color: #666;
}

.predependency-list {
  max-height: 200px;
  overflow-y: auto;
}

.predependency-option {
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(68, 68, 68, 0.5);
  display: flex;
  align-items: center;
  gap: 12px;
}

.predependency-option:last-child {
  border-bottom: none;
}

.predependency-option:hover {
  background: rgba(121, 158, 255, 0.1);
}

.predependency-option.selected {
  background: rgba(121, 158, 255, 0.15);
}

.task-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #799EFF;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.predependency-option.selected .task-checkbox {
  background: #799EFF;
  color: #1C1C1C;
}

.task-info {
  flex: 1;
}

.task-name-compact {
  font-size: 14px;
  font-weight: 600;
  color: #F5E8D8;
  margin-bottom: 2px;
}

.task-category-compact {
  font-size: 11px;
  color: #888;
}

.predependency-empty {
  padding: 16px;
  text-align: center;
  color: #666;
  font-size: 14px;
  font-style: italic;
}
</style>
