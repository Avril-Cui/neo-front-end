<template>
  <div class="tasks-view">
    <div class="header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo">NEO</div>
          <div class="view-toggle">
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Today' }"
              @click="navigateToToday"
            >
              Today
            </button>
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Compare' }"
              @click="navigateToCompare"
            >
              Compare
            </button>
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Logging' }"
              @click="navigateToLogging"
            >
              Logging
            </button>
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Tasks' }"
              @click="navigateToTasks"
            >
              Tasks
            </button>
          </div>
        </div>
        <div class="user-section">
          <span class="username">{{ authStore.getCurrentUsername() }}</span>
          <button class="logout-button" @click="handleLogout" title="Log out">
            Log Out
          </button>
        </div>
      </div>
    </div>

    <div class="container">
      <!-- All Tasks Section -->
      <div class="section">
        <h1 class="page-title">📋 All Tasks</h1>
        <p class="page-description">
          All your tasks across the system.
        </p>

        <!-- Search and Filter Controls -->
        <div class="search-filter-container">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search tasks by name..."
              class="search-input"
            />
          </div>
          <div class="filter-controls">
            <div class="filter-wrapper">
              <span class="filter-icon">⚡</span>
              <select v-model="filterPriority" class="filter-select">
                <option value="">All Priorities</option>
                <option value="5">Priority 5 - Critical</option>
                <option value="4">Priority 4 - Important</option>
                <option value="3">Priority 3 - Regular</option>
                <option value="2">Priority 2 - Low</option>
                <option value="1">Priority 1 - Optional</option>
              </select>
            </div>
            <div class="filter-wrapper">
              <span class="filter-icon">📁</span>
              <select v-model="filterCategory" class="filter-select">
                <option value="">All Categories</option>
                <option v-for="category in uniqueCategories" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>
            </div>
            <div class="filter-wrapper date-filter">
              <span class="filter-icon">📅</span>
              <div class="date-multi-select" @click.stop="toggleDateDropdown">
                <span class="selected-dates-text">
                  {{ filterDates.length === 0 ? 'All Dates' : `${filterDates.length} date${filterDates.length > 1 ? 's' : ''} selected` }}
                </span>
                <span class="dropdown-arrow">▼</span>
              </div>
              <div v-if="showDateDropdown" class="date-dropdown" @click.stop>
                <div class="date-dropdown-header">
                  <span>Select Scheduled Dates</span>
                  <button v-if="filterDates.length > 0" @click="clearDateFilter" class="clear-dates-btn">
                    Clear All
                  </button>
                </div>
                <div v-if="uniqueScheduledDates.length === 0" class="no-dates">
                  No scheduled dates available
                </div>
                <div v-else class="date-options">
                  <label
                    v-for="date in uniqueScheduledDates"
                    :key="date"
                    class="date-option"
                  >
                    <input
                      type="checkbox"
                      :value="date"
                      :checked="filterDates.includes(date)"
                      @change="toggleDateSelection(date)"
                    />
                    <span class="date-label">{{ formatDateDisplay(date) }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="isLoadingTasks" class="loading-state">
          <div class="spinner"></div>
          <p>Loading tasks...</p>
        </div>

        <div v-else-if="allTasks.length === 0" class="empty-state">
          <div class="empty-icon">📝</div>
          <h2>No Tasks Yet</h2>
          <p>Create tasks from the Today view to get started.</p>
        </div>

        <div v-else-if="filteredTasks.length === 0" class="empty-state">
          <div class="empty-icon">🔍</div>
          <h2>No Tasks Found</h2>
          <p>Try adjusting your search or filters.</p>
        </div>

        <div v-else class="tasks-scrollable-container">
          <div class="tasks-grid">
            <div
              v-for="task in filteredTasks"
              :key="task.taskId"
              class="task-card all-task"
            >
            <button
              class="delete-task-button"
              @click="deleteTask(task, $event)"
              title="Delete task"
            >
              ×
            </button>
            <div class="task-header">
              <div class="task-name">{{ task.taskName }}</div>
              <div class="task-priority" :class="`priority-${task.priority}`">
                Priority {{ task.priority }}
              </div>
            </div>

            <div class="task-details">
              <div class="detail-row">
                <span class="detail-label">📁 Category:</span>
                <span class="detail-value category-badge">{{ task.category }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">⏱️ Duration:</span>
                <span class="detail-value">{{ task.duration }} min</span>
              </div>
              <div v-if="task.deadline" class="detail-row">
                <span class="detail-label">📅 Deadline:</span>
                <span class="detail-value">{{ formatDateTime(task.deadline) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">✂️ Splittable:</span>
                <span class="detail-value">{{ task.splittable ? 'Yes' : 'No' }}</span>
              </div>
            </div>

            <div v-if="task.note" class="task-note">
              <span class="note-label">📝 Note:</span>
              <span class="note-text">{{ task.note }}</span>
            </div>

            <div class="task-stats">
              <div class="stat-item">
                <span class="stat-value">{{ task.timeBlockSet.length }}</span>
                <span class="stat-label">Schedules</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ task.preDependence?.length || 0 }}</span>
                <span class="stat-label">Dependencies</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <!-- Dropped Tasks Section -->
      <div class="section">
        <h1 class="page-title">⚠️ Dropped Tasks</h1>
        <p class="page-description">
          These tasks couldn't be scheduled due to time constraints or conflicts.
        </p>

        <div v-if="isLoadingDropped" class="loading-state">
          <div class="spinner"></div>
          <p>Loading dropped tasks...</p>
        </div>

        <div v-else-if="droppedTasks.length === 0" class="empty-state">
          <div class="empty-icon">✓</div>
          <h2>No Dropped Tasks</h2>
          <p>All tasks have been successfully scheduled.</p>
        </div>

        <div v-else class="tasks-list">
          <div
            v-for="droppedTask in droppedTasksWithDetails"
            :key="droppedTask.taskId"
            class="task-card"
          >
            <div class="task-header">
              <div class="task-name">{{ droppedTask.task?.taskName || droppedTask.taskId }}</div>
              <div class="task-priority" :class="`priority-${droppedTask.task?.priority || 3}`">
                Priority {{ droppedTask.task?.priority || '?' }}
              </div>
            </div>

            <div v-if="droppedTask.task" class="task-details">
              <div class="detail-row">
                <span class="detail-label">Category:</span>
                <span class="detail-value">{{ droppedTask.task.category }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duration:</span>
                <span class="detail-value">{{ droppedTask.task.duration }} minutes</span>
              </div>
              <div v-if="droppedTask.task.deadline" class="detail-row">
                <span class="detail-label">Deadline:</span>
                <span class="detail-value">{{ formatDateTime(droppedTask.task.deadline) }}</span>
              </div>
            </div>

            <div class="task-reason">
              <span class="reason-label">Reason:</span>
              <span class="reason-text">{{ droppedTask.reason }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { AdaptiveScheduleAPI, TaskCatalogAPI, ScheduleTimeAPI, type DroppedTask, type Task, type TimeBlock } from '../services/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const CURRENT_USER = authStore.getCurrentUserId() || 'Friday'
const activeView = ref('Tasks')

const handleLogout = () => {
  if (confirm('Are you sure you want to log out?')) {
    authStore.clearUser()
    router.push('/login')
  }
}

// All tasks state
const allTasks = ref<Task[]>([])
const isLoadingTasks = ref(true)

// Search and filter state
const searchQuery = ref('')
const filterPriority = ref('')
const filterCategory = ref('')
const filterDates = ref<string[]>([])  // Array of selected date strings
const showDateDropdown = ref(false)

// Schedule data
const allSchedules = ref<TimeBlock[]>([])

// Date filter functions
const toggleDateDropdown = () => {
  showDateDropdown.value = !showDateDropdown.value
}

const toggleDateSelection = (date: string) => {
  const index = filterDates.value.indexOf(date)
  if (index === -1) {
    filterDates.value.push(date)
  } else {
    filterDates.value.splice(index, 1)
  }
}

const clearDateFilter = () => {
  filterDates.value = []
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.date-filter')) {
    showDateDropdown.value = false
  }
}

// Clean up event listener
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Computed: Get unique categories from all tasks
const uniqueCategories = computed(() => {
  const categories = new Set(allTasks.value.map(task => task.category))
  return Array.from(categories).sort()
})

// Helper: Format date as YYYY-MM-DD
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toISOString().split('T')[0]
}

// Helper: Format date for display (e.g., "Mon, Jan 15")
const formatDateDisplay = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00')
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

// Computed: Get unique scheduled dates from all schedules
const uniqueScheduledDates = computed(() => {
  const dateSet = new Set<string>()

  allSchedules.value.forEach(schedule => {
    const dateStr = formatDate(schedule.start)
    dateSet.add(dateStr)
  })

  // Sort dates chronologically
  return Array.from(dateSet).sort()
})

// Computed: Map task IDs to their scheduled dates
const taskScheduleDates = computed(() => {
  const taskDatesMap = new Map<string, Set<string>>()

  allSchedules.value.forEach(schedule => {
    const dateStr = formatDate(schedule.start)
    schedule.taskIdSet.forEach(taskId => {
      if (!taskDatesMap.has(taskId)) {
        taskDatesMap.set(taskId, new Set())
      }
      taskDatesMap.get(taskId)!.add(dateStr)
    })
  })

  return taskDatesMap
})

// Computed: Filtered tasks based on search and filters
const filteredTasks = computed(() => {
  let tasks = allTasks.value

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    tasks = tasks.filter(task =>
      task.taskName.toLowerCase().includes(query)
    )
  }

  // Apply priority filter
  if (filterPriority.value) {
    tasks = tasks.filter(task =>
      task.priority === parseInt(filterPriority.value)
    )
  }

  // Apply category filter
  if (filterCategory.value) {
    tasks = tasks.filter(task =>
      task.category === filterCategory.value
    )
  }

  // Apply date filter - only show tasks scheduled on selected dates
  if (filterDates.value.length > 0) {
    tasks = tasks.filter(task => {
      const taskDates = taskScheduleDates.value.get(task.taskId)
      if (!taskDates) return false  // Task has no schedules

      // Check if any of the task's scheduled dates match the selected dates
      return filterDates.value.some(selectedDate => taskDates.has(selectedDate))
    })
  }

  return tasks
})

// Dropped tasks state
const isLoadingDropped = ref(true)
const droppedTasks = ref<DroppedTask[]>([])

interface DroppedTaskWithDetails {
  taskId: string
  owner: string
  reason: string
  task?: Task
}

const droppedTasksWithDetails = ref<DroppedTaskWithDetails[]>([])

// Navigation functions
const navigateToToday = () => {
  router.push('/')
}

const navigateToCompare = () => {
  router.push('/compare')
}

const navigateToLogging = () => {
  router.push('/logging')
}

const navigateToTasks = () => {
  router.push('/tasks')
}

// Format date helper
const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Fetch all tasks
const fetchAllTasks = async () => {
  try {
    isLoadingTasks.value = true
    const tasks = await TaskCatalogAPI.getUserTasks(CURRENT_USER)
    allTasks.value = tasks
  } catch (error: any) {
    console.error('Failed to fetch all tasks:', error)
    allTasks.value = []
  } finally {
    isLoadingTasks.value = false
  }
}

// Fetch dropped tasks
const fetchDroppedTasks = async () => {
  try {
    isLoadingDropped.value = true
    const tasks = await AdaptiveScheduleAPI.getDroppedTasks(CURRENT_USER)
    droppedTasks.value = tasks

    // Fetch task details for each dropped task
    const tasksWithDetails: DroppedTaskWithDetails[] = []
    for (const droppedTask of tasks) {
      try {
        const task = await TaskCatalogAPI.getTask(CURRENT_USER, droppedTask.taskId)
        tasksWithDetails.push({
          ...droppedTask,
          task
        })
      } catch (error) {
        console.error(`Failed to fetch task ${droppedTask.taskId}:`, error)
        tasksWithDetails.push({
          ...droppedTask,
          task: undefined
        })
      }
    }
    droppedTasksWithDetails.value = tasksWithDetails
  } catch (error) {
    console.error('Failed to fetch dropped tasks:', error)
    droppedTasks.value = []
    droppedTasksWithDetails.value = []
  } finally {
    isLoadingDropped.value = false
  }
}

// Delete task
const deleteTask = async (task: Task, event: MouseEvent) => {
  event.stopPropagation()
  if (!confirm(`Are you sure you want to delete "${task.taskName}"?`)) return

  try {
    await TaskCatalogAPI.deleteTask(CURRENT_USER, task.taskId)
    await fetchAllTasks()
  } catch (error: any) {
    console.error('Failed to delete task:', error)
    alert('Failed to delete task: ' + error.message)
  }
}

// Fetch schedules
const fetchSchedules = async () => {
  try {
    const schedules = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER)
    allSchedules.value = schedules
    console.log(`Fetched ${schedules.length} schedule blocks`)
  } catch (error) {
    console.error('Failed to fetch schedules:', error)
    allSchedules.value = []
  }
}

onMounted(() => {
  fetchAllTasks()
  fetchDroppedTasks()
  fetchSchedules()
  document.addEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.tasks-view {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: #1a1a1a;
  min-height: 100vh;
  color: #F5E8D8;
  line-height: 1.5;
  width: 100vw;
}

.header {
  background: #2a2a2a;
  color: #F5E8D8;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid #333;
}

.header-content {
  width: 100%;
  max-width: 1400px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #FF6F61;
}

.view-toggle {
  display: flex;
  background: rgba(245, 232, 216, 0.1);
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
  border: 1px solid rgba(245, 232, 216, 0.2);
}

.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(245, 232, 216, 0.1);
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 8px 16px;
}

.username {
  font-size: 14px;
  font-weight: 600;
  color: #F5E8D8;
}

.logout-button {
  background: rgba(255, 111, 97, 0.2);
  border: 1px solid rgba(255, 111, 97, 0.3);
  color: #FF6F61;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-button:hover {
  background: rgba(255, 111, 97, 0.3);
  border-color: rgba(255, 111, 97, 0.5);
  transform: translateY(-1px);
}

.toggle-option {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  background: transparent;
  color: rgba(245, 232, 216, 0.8);
}

.toggle-option.active {
  background: rgba(255, 111, 97, 0.2);
  color: #FF6F61;
  backdrop-filter: blur(10px);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.section {
  margin-bottom: 60px;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 8px;
}

.page-description {
  font-size: 16px;
  color: #AAA;
  margin-bottom: 24px;
}

.search-filter-container {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
  align-items: stretch;
  position: relative;
  z-index: 100;
}

.search-box {
  flex: 1;
  min-width: 320px;
  position: relative;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, rgba(42, 42, 42, 0.95) 0%, rgba(51, 51, 51, 0.95) 100%);
  border-radius: 16px;
  border: 2px solid rgba(245, 232, 216, 0.15);
  padding: 0 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
}

.search-box:hover {
  border-color: rgba(245, 232, 216, 0.25);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.search-box:focus-within {
  border-color: rgba(255, 111, 97, 0.6);
  box-shadow: 0 4px 20px rgba(255, 111, 97, 0.25);
  background: linear-gradient(135deg, rgba(42, 42, 42, 1) 0%, rgba(51, 51, 51, 1) 100%);
}

.search-icon {
  font-size: 20px;
  margin-right: 14px;
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.search-box:focus-within .search-icon {
  opacity: 0.8;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 16px 0;
  font-size: 15px;
  color: #F5E8D8;
  font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-weight: 500;
}

.search-input::placeholder {
  color: rgba(245, 232, 216, 0.35);
  font-weight: 400;
}

.filter-controls {
  display: flex;
  gap: 12px;
  align-items: stretch;
  position: relative;
  z-index: 100;
}

.filter-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, rgba(42, 42, 42, 0.95) 0%, rgba(51, 51, 51, 0.95) 100%);
  border: 2px solid rgba(245, 232, 216, 0.15);
  border-radius: 16px;
  padding: 0 20px 0 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-wrapper:hover {
  border-color: rgba(245, 232, 216, 0.25);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transform: translateY(-1px);
}

.filter-wrapper:focus-within {
  border-color: rgba(255, 111, 97, 0.6);
  box-shadow: 0 4px 20px rgba(255, 111, 97, 0.25);
  background: linear-gradient(135deg, rgba(42, 42, 42, 1) 0%, rgba(51, 51, 51, 1) 100%);
}

.filter-icon {
  font-size: 18px;
  margin-right: 12px;
  opacity: 0.6;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.filter-wrapper:focus-within .filter-icon {
  opacity: 1;
  transform: scale(1.1);
}

.filter-select {
  background: transparent;
  border: none;
  padding: 14px 28px 14px 0;
  font-size: 14px;
  font-weight: 600;
  color: #F5E8D8;
  cursor: pointer;
  outline: none;
  font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  min-width: 160px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath fill='%23F5E8D8' opacity='0.7' d='M7 10L2 5h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;
  background-size: 14px;
  transition: all 0.3s ease;
}

.filter-select:hover {
  color: #FFFFFF;
}

.filter-select option {
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  color: #F5E8D8;
  padding: 16px 24px;
  font-weight: 500;
  font-size: 14px;
  border-bottom: 1px solid rgba(245, 232, 216, 0.08);
  transition: all 0.2s ease;
  line-height: 1.6;
}

.filter-select option:first-child {
  font-weight: 700;
  color: #FF6F61;
  background: linear-gradient(135deg, rgba(255, 111, 97, 0.15) 0%, rgba(255, 111, 97, 0.08) 100%);
  border-bottom: 2px solid rgba(255, 111, 97, 0.3);
}

.filter-select option:hover,
.filter-select option:focus,
.filter-select option:checked {
  background: linear-gradient(135deg, rgba(255, 111, 97, 0.2) 0%, rgba(255, 111, 97, 0.15) 100%);
  color: #FFFFFF;
  font-weight: 600;
}

.filter-select option:active {
  background: linear-gradient(135deg, rgba(255, 111, 97, 0.3) 0%, rgba(255, 111, 97, 0.2) 100%);
}

/* Date Filter Styles */
.date-filter {
  position: relative;
  z-index: 200;
}

.date-multi-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  background: transparent;
  cursor: pointer;
  min-width: 180px;
}

.selected-dates-text {
  font-size: 14px;
  font-weight: 600;
  color: #F5E8D8;
  transition: color 0.2s ease;
}

.date-multi-select:hover .selected-dates-text {
  color: #FFFFFF;
}

.dropdown-arrow {
  font-size: 10px;
  color: rgba(245, 232, 216, 0.5);
  transition: transform 0.3s ease, color 0.2s ease;
}

.date-filter:hover .dropdown-arrow {
  color: rgba(245, 232, 216, 0.8);
}

.date-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 280px;
  max-height: 400px;
  overflow-y: auto;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  border: 2px solid rgba(245, 232, 216, 0.15);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.date-dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 2px solid rgba(245, 232, 216, 0.1);
  font-weight: 700;
  font-size: 14px;
  color: #FF6F61;
}

.clear-dates-btn {
  background: rgba(255, 111, 97, 0.15);
  border: 1px solid rgba(255, 111, 97, 0.3);
  color: #FF6F61;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-dates-btn:hover {
  background: rgba(255, 111, 97, 0.25);
  border-color: rgba(255, 111, 97, 0.5);
  transform: translateY(-1px);
}

.no-dates {
  padding: 24px;
  text-align: center;
  color: rgba(245, 232, 216, 0.5);
  font-size: 14px;
}

.date-options {
  padding: 8px;
}

.date-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.date-option:hover {
  background: rgba(245, 232, 216, 0.08);
}

.date-option input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #FF6F61;
}

.date-label {
  font-size: 14px;
  font-weight: 500;
  color: #F5E8D8;
  user-select: none;
}

.date-option:hover .date-label {
  color: #FFFFFF;
}

.tasks-scrollable-container {
  height: 70vh;
  overflow-y: auto;
  padding-right: 8px;
}

.tasks-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 1024px) {
  .tasks-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.task-card.all-task {
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 12px;
  padding: 20px;
  border: 2px solid rgba(255, 111, 97, 0.3);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  position: relative;
}

.task-card.all-task:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(255, 111, 97, 0.2);
  border-color: rgba(255, 111, 97, 0.5);
}

.delete-task-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 68, 68, 0.2);
  border: 1px solid rgba(255, 68, 68, 0.3);
  color: #FF4444;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
}

.task-card.all-task:hover .delete-task-button {
  opacity: 1;
}

.delete-task-button:hover {
  background: rgba(255, 68, 68, 0.3);
  border-color: rgba(255, 68, 68, 0.5);
  transform: scale(1.1);
}

.category-badge {
  background: rgba(255, 111, 97, 0.2);
  color: #FF6F61;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.task-note {
  margin-top: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border-left: 3px solid rgba(255, 111, 97, 0.5);
  font-size: 14px;
}

.note-label {
  font-weight: 600;
  color: #AAA;
  margin-right: 8px;
}

.note-text {
  color: #F5E8D8;
  line-height: 1.5;
}

.task-stats {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(245, 232, 216, 0.1);
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #FF6F61;
}

.stat-label {
  font-size: 12px;
  color: #AAA;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #444;
  border-top-color: #FF6F61;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  color: #4CAF50;
}

.empty-state h2 {
  font-size: 24px;
  font-weight: 600;
  color: #F5E8D8;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 16px;
  color: #AAA;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-card {
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 12px;
  padding: 20px;
  border: 2px solid #FF4444;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(255, 68, 68, 0.3);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.task-name {
  font-size: 18px;
  font-weight: 700;
  color: #F5E8D8;
}

.task-priority {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.task-priority.priority-1 {
  background: rgba(153, 153, 153, 0.2);
  color: #999;
  border: 1px solid rgba(153, 153, 153, 0.3);
}

.task-priority.priority-2 {
  background: rgba(244, 196, 48, 0.2);
  color: #F4C430;
  border: 1px solid rgba(244, 196, 48, 0.3);
}

.task-priority.priority-3 {
  background: rgba(255, 140, 0, 0.2);
  color: #FF8C00;
  border: 1px solid rgba(255, 140, 0, 0.3);
}

.task-priority.priority-4 {
  background: rgba(255, 111, 97, 0.2);
  color: #FF6F61;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.task-priority.priority-5 {
  background: rgba(255, 61, 0, 0.2);
  color: #FF3D00;
  border: 1px solid rgba(255, 61, 0, 0.3);
}

.task-details {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.detail-row {
  display: flex;
  padding: 4px 0;
  font-size: 14px;
}

.detail-label {
  font-weight: 600;
  color: #AAA;
  min-width: 100px;
}

.detail-value {
  color: #F5E8D8;
}

.task-reason {
  padding: 12px;
  background: rgba(255, 68, 68, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 68, 68, 0.2);
}

.reason-label {
  font-weight: 600;
  color: #FF4444;
  margin-right: 8px;
}

.reason-text {
  color: #F5E8D8;
  font-size: 14px;
}
</style>
