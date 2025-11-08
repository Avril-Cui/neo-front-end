<template>
  <div class="compare-view">
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
        <div class="header-right">
          <div class="date-navigation">
            <button class="nav-button" @click="goToPreviousDay" title="Previous day">
              ‹
            </button>
            <button
              class="nav-button today-button"
              :class="{ active: isToday() }"
              @click="goToToday"
              title="Go to today"
            >
              {{ selectedDate }}
            </button>
            <button class="nav-button" @click="goToNextDay" title="Next day">
              ›
            </button>
          </div>
          <div class="user-section">
            <span class="username">{{ authStore.getCurrentUsername() }}</span>
            <button class="logout-button" @click="handleLogout" title="Log out">
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="comparison-stats">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalTasks }}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.perfectMatch }}</div>
          <div class="stat-label">Perfect Match</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.mismatched }}</div>
          <div class="stat-label">Mismatched</div>
        </div>
        <div class="stat-card variance">
          <div class="stat-value">{{ stats.timeVariance }}</div>
          <div class="stat-label">Time Variance</div>
        </div>
      </div>

      <div class="optimize-button-container">
        <button class="optimize-schedule-button" @click="handleOptimizeSchedule">Optimize Schedule</button>
      </div>

      <div class="legend">
        <div class="legend-item">
          <div class="legend-icon planned"></div>
          <span>Planned</span>
        </div>
        <div class="legend-item">
          <div class="legend-icon actual"></div>
          <span>Actual</span>
        </div>
        <div class="legend-item">
          <div class="legend-icon overlap"></div>
          <span>Perfect Match</span>
        </div>
      </div>

      <div class="timeline-wrapper" ref="timelineContainerRef">
        <div class="unified-timeline">
          <div class="time-axis">
            <div
              v-for="marker in timeMarkers"
              :key="`${marker.time}-${marker.label}`"
              class="time-marker"
              :style="{ top: marker.position + 'px' }"
            >
              {{ marker.label }}
              <div class="time-dot"></div>
            </div>
          </div>

          <div class="current-time-line" :style="{ top: currentTimePosition + 'px' }"></div>

          <!-- Empty time slots (for adding tasks) -->
          <div
            v-for="slot in emptyTimeSlots"
            :key="`empty-${slot.hour}-${slot.minute}`"
            class="empty-time-slot"
            :style="{ top: slot.position + 'px', height: slot.height + 'px' }"
          >
            <div
              class="empty-slot-panel"
              @click="openAddTaskForTimeSlot(slot.hour, slot.minute)"
            >
              <div class="add-task-content">
                <span class="add-icon">+</span>
                <span class="add-text">Add Task</span>
              </div>
            </div>
          </div>

          <!-- Adaptive blocks (right side) -->
          <div
            v-for="(adaptiveBlock, index) in adaptiveBlockLayouts"
            :key="`adaptive-${index}`"
            class="adaptive-block-slot"
            :style="{
              top: getComparisonPosition(adaptiveBlock.start) + 'px',
              height: getAdaptiveBlockHeight(adaptiveBlock) + 'px',
              width: 'calc((((100% - 100px) / 2) * ' + ((adaptiveBlock.layoutWidth || 100) / 100) + ') - 2px)',
              left: 'calc(100px + (100% - 100px) / 2 + 2px + ((100% - 100px) / 2) * ' + ((adaptiveBlock.layoutLeft || 0) / 100) + ')'
            }"
          >
            <div class="adaptive-block-actions">
              <button
                class="accept-adaptive-block-btn"
                @click="acceptAdaptiveBlock(adaptiveBlock)"
                title="Accept this adaptive schedule"
              >
                ✓
              </button>
              <button
                class="reject-adaptive-block-btn"
                @click="rejectAdaptiveBlock(adaptiveBlock.timeBlockId)"
                title="Reject this adaptive block"
              >
                ✕
              </button>
            </div>
            <div
              v-for="task in adaptiveBlock.tasks"
              :key="task.taskId"
              class="adaptive-task"
            >
              <div v-if="(adaptiveBlock.end - adaptiveBlock.start) > 1800000" class="task-time">{{ formatTime(adaptiveBlock.start) }} - {{ formatTime(adaptiveBlock.end) }}</div>
              <div class="task-title">{{ task.taskName }}</div>
              <div v-if="(adaptiveBlock.end - adaptiveBlock.start) > 1800000" class="task-duration">{{ formatDuration(adaptiveBlock.end - adaptiveBlock.start) }} • {{ task.category }}</div>
              <div v-else class="task-duration">{{ task.category }}</div>
            </div>
          </div>

          <!-- Comparison slots - Perfect Match (full width) -->
          <template v-for="(comparison, index) in comparisons" :key="`perfect-${index}`">
            <div
              v-if="comparison.isPerfectMatch"
              class="perfect-match-slot"
              :style="{
                top: getComparisonPosition(comparison.startTime || 0) + 'px',
                height: calculateHeightWithMin(comparison.startTime || 0, comparison.endTime || 0) + 'px'
              }"
            >
              <div class="task-perfect-match" :class="{ 'short-task': isShortSession(comparison.duration) }">
                <!-- Short task: only show task name with inline completed badge -->
                <div class="task-title-inline" v-if="isShortSession(comparison.duration)">
                  {{ comparison.taskName }}
                  <span v-if="comparison.isDone" class="completed-badge" style="margin-left: 6px;">Completed</span>
                </div>
                <!-- Regular task: show time, title, and metadata -->
                <template v-else>
                  <div class="task-time">{{ comparison.timeRange }}</div>
                  <div class="task-title">{{ comparison.taskName }}</div>
                  <div class="task-meta">
                    <span class="task-duration">{{ comparison.duration }} • {{ comparison.category }}</span>
                    <span v-if="comparison.isDone" class="completed-badge" style="margin-left: 6px;">Completed</span>
                  </div>
                </template>
              </div>
            </div>
          </template>

          <!-- Planned tasks (left side) -->
          <template v-for="(comparison, index) in comparisonsWithPlannedLayout" :key="`planned-${index}`">
            <div
              v-if="comparison.planned"
              class="planned-task-slot"
              :style="{
                top: getComparisonPosition(comparison.planned.startTime) + 'px',
                height: calculateHeightWithMin(comparison.planned.startTime, comparison.planned.endTime) + 'px',
                width: 'calc((((100% - 100px) / 2 - 2px) * ' + ((comparison as any).plannedLayout?.layoutWidth || 100) / 100 + ') - 2px)',
                left: 'calc(100px + ((100% - 100px) / 2 - 2px) * ' + ((comparison as any).plannedLayout?.layoutLeft || 0) / 100 + ')'
              }"
            >
              <button
                v-if="comparison.planned.taskId && comparison.planned.timeBlockId"
                class="delete-schedule-btn"
                @click="deleteSchedule(comparison.planned.taskId, comparison.planned.timeBlockId)"
                title="Delete this schedule"
              >
                ×
              </button>
              <div class="planned-task" :class="{ 'short-task': isShortSession(comparison.planned.duration) }">
                <!-- Short task: only show task name with inline label and badges -->
                <div class="task-title-inline" v-if="isShortSession(comparison.planned.duration)">
                  {{ comparison.planned.taskName }}
                  <span v-if="comparison.planned.isDone" class="completed-badge" style="margin: 0 4px;">Completed</span>
                  <span v-if="comparison.planned.varianceText" class="variance-badge" :class="{
                    'skipped': comparison.planned.varianceText === 'Skipped',
                    'incomplete': comparison.planned.varianceText === 'Incomplete'
                  }" style="margin: 0 4px;">
                    {{ comparison.planned.varianceText }}
                  </span>
                  <span class="inline-label">PLANNED</span>
                </div>
                <!-- Regular task: show time, title, and metadata -->
                <template v-else>
                  <div class="task-time">{{ comparison.planned.timeRange }}</div>
                  <div class="task-title">{{ comparison.planned.taskName }}</div>
                  <div class="task-meta">
                    <span class="task-duration">{{ comparison.planned.duration }} • {{ comparison.planned.category }}</span>
                    <span v-if="comparison.planned.isDone" class="completed-badge">
                      Completed
                    </span>
                    <span v-if="comparison.planned.varianceText" class="variance-badge" :class="{
                      'skipped': comparison.planned.varianceText === 'Skipped',
                      'incomplete': comparison.planned.varianceText === 'Incomplete'
                    }">
                      {{ comparison.planned.varianceText }}
                    </span>
                  </div>
                </template>
              </div>
            </div>
          </template>

          <!-- Actual tasks (right side) -->
          <template v-for="(comparison, index) in comparisonsWithActualLayout" :key="`actual-${index}`">
            <div
              v-if="comparison.actual"
              class="actual-task-slot"
              :style="{
                top: getComparisonPosition(comparison.actual.startTime) + 'px',
                height: calculateHeightWithMin(comparison.actual.startTime, comparison.actual.endTime) + 'px',
                width: 'calc((((100% - 100px) / 2) * ' + ((comparison as any).actualLayout?.layoutWidth || 100) / 100 + ') - 2px)',
                left: 'calc(100px + (100% - 100px) / 2 + 2px + ((100% - 100px) / 2) * ' + ((comparison as any).actualLayout?.layoutLeft || 0) / 100 + ')'
              }"
            >
              <div class="actual-task" :class="{ 'short-task': isShortSession(comparison.actual.duration) }">
                <!-- Short task: only show task name with inline label and badges -->
                <div class="task-title-inline" v-if="isShortSession(comparison.actual.duration)">
                  {{ comparison.actual.taskName }}
                  <span v-if="comparison.actual.isDone" class="completed-badge" style="margin: 0 4px;">Completed</span>
                  <span v-if="comparison.actual.varianceText" class="variance-badge" :class="{
                    'skipped': comparison.actual.varianceText === 'Skipped',
                    'incomplete': comparison.actual.varianceText === 'Incomplete'
                  }" style="margin: 0 4px;">
                    {{ comparison.actual.varianceText }}
                  </span>
                  <span class="inline-label">ACTUAL</span>
                </div>
                <!-- Regular task: show time, title, and metadata -->
                <template v-else>
                  <div class="task-time">{{ comparison.actual.timeRange }}</div>
                  <div class="task-title">{{ comparison.actual.taskName }}</div>
                  <div class="task-meta">
                    <span class="task-duration">{{ comparison.actual.duration }} • {{ comparison.actual.category }}</span>
                    <span v-if="comparison.actual.isDone" class="completed-badge">
                      Completed
                    </span>
                    <span v-if="comparison.actual.varianceText" class="variance-badge">
                      {{ comparison.actual.varianceText }}
                    </span>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Add Task Modal -->
    <AddTaskModal
      :show="showAddTaskModal"
      :selected-hour="selectedHourForNewTask"
      :selected-minute="selectedMinuteForNewTask"
      @close="closeAddTaskModal"
      @submit="handleTaskSubmit"
    />

    <!-- Preference Modal -->
    <PreferenceModal
      :show="showPreferenceModal"
      @close="closePreferenceModal"
      @proceed="handlePreferenceProceed"
    />

    <!-- Loading Modal -->
    <LoadingModal
      :show="showLoadingModal"
      title="AI is Thinking..."
      description="Creating your optimized schedule. This may take a moment."
    />

    <!-- AI Optimize Sidebar -->
    <Transition name="sidebar-slide">
      <div v-if="showSidebar" class="ai-sidebar">
        <div class="sidebar-header">
          <h3 class="sidebar-title">AI Schedule Optimizer</h3>
          <button class="sidebar-close" @click="closeSidebar">×</button>
        </div>

        <div class="sidebar-body">
          <!-- Input State -->
          <div v-if="sidebarState === 'input'" class="sidebar-state">
            <p class="sidebar-hint">
              Tell me your scheduling preferences
            </p>
            <textarea
              v-model="userPreference"
              class="preference-input"
              placeholder="e.g., I prefer to do focused work in the morning..."
              rows="8"
            ></textarea>
            <button class="generate-btn" @click="handleSidebarProceed">
              Generate Schedule
            </button>
          </div>

          <!-- Loading State -->
          <div v-if="sidebarState === 'loading'" class="sidebar-state loading-state">
            <div class="spinner-container">
              <div class="spinner"></div>
            </div>
            <p class="loading-text">AI Analyzing Your Data...</p>
            <p class="loading-subtext">Optimizing schedule may take a moment</p>
          </div>

          <!-- Result State -->
          <div v-if="sidebarState === 'result'" class="sidebar-state result-state">
            <div class="success-badge">
              <span class="check-icon">✓</span>
              Schedule Ready
            </div>
            <div class="analysis-box">
              <h4 class="analysis-heading">Analysis</h4>
              <div class="analysis-text">{{ aiAnalysis }}</div>
            </div>
            <button class="done-btn" @click="closeSidebar">
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AddTaskModal from '../components/AddTaskModal.vue'
import PreferenceModal from '../components/PreferenceModal.vue'
import LoadingModal from '../components/LoadingModal.vue'
import { TaskCatalogAPI, RoutineLogAPI, ScheduleTimeAPI, AdaptiveScheduleAPI, type Task, type Session, type TimeBlock, type AdaptiveBlock, type DroppedTask } from '../services/api'
import { useAuthStore } from '../stores/auth'

// Auth store
const authStore = useAuthStore()
const CURRENT_USER = authStore.getCurrentUserId() || 'Friday'

const handleLogout = () => {
  if (confirm('Are you sure you want to log out?')) {
    authStore.clearUser()
    router.push('/login')
  }
}

// Helper to round timestamp to nearest 30 minutes
const roundToNearest30Min = (timestamp: number): number => {
  const date = new Date(timestamp)
  const minutes = date.getMinutes()
  const roundedMinutes = Math.round(minutes / 30) * 30
  date.setMinutes(roundedMinutes, 0, 0)
  return date.getTime()
}

// Helper to format time from timestamp
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
}

// Helper to format duration in minutes
const formatDuration = (milliseconds: number): string => {
  const totalMinutes = Math.floor(milliseconds / (1000 * 60))
  if (totalMinutes === 0) {
    return '0h 0m'
  }
  if (totalMinutes < 60) {
    return `${totalMinutes} minutes`
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  }
  return `${hours}h ${minutes}m`
}

const router = useRouter()

// Active view
const activeView = ref('Compare')

// Date navigation
const currentDate = ref(new Date())
const selectedDate = ref('')

// Format date for display
const formatDisplayDate = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

// Navigation functions
const goToPreviousDay = async () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() - 1)
  currentDate.value = newDate
  selectedDate.value = formatDisplayDate(newDate)
  await fetchComparisons()
}

const goToToday = async () => {
  currentDate.value = new Date()
  selectedDate.value = formatDisplayDate(currentDate.value)
  await fetchComparisons()
}

const goToNextDay = async () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + 1)
  currentDate.value = newDate
  selectedDate.value = formatDisplayDate(newDate)
  await fetchComparisons()
}

// Check if current date is today
const isToday = () => {
  const today = new Date()
  return currentDate.value.toDateString() === today.toDateString()
}

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

// Stats
const stats = ref({
  totalTasks: 0,
  perfectMatch: 0,
  mismatched: 0,
  timeVariance: '0h 0m'
})

// Timeline constants - optimized for 1-hour task fitting with padding
const HOUR_HEIGHT = 120  // 120px per hour (increased to accommodate padding)
const START_HOUR = 0     // Start at midnight (full 24 hours)
const END_HOUR = 24      // End at midnight next day

// Time markers for timeline - every hour (24 total)
const timeMarkers = computed(() => {
  const markers = []

  // Generate markers for every hour (24 total in 24 hours)
  for (let hour = 0; hour < 24; hour++) {
    const position = hour * HOUR_HEIGHT

    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour

    let label = ''
    if (hour === 0) {
      label = 'Midnight'
    } else if (hour === 12) {
      label = 'Noon'
    } else {
      label = `${displayHour} ${period}`
    }

    markers.push({
      time: hour,
      position,
      label,
      isFullHour: true // All markers are full hours
    })
  }
  return markers
})

// Current time position
const currentTimePosition = ref(0)
const updateCurrentTimePosition = () => {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  // Use full 24-hour timeline
  currentTimePosition.value = hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
}

// Timeline container ref for scrolling
const timelineContainerRef = ref<HTMLElement | null>(null)

// Calculate position for a comparison based on its start time
const getComparisonPosition = (timestamp: number) => {
  const date = new Date(timestamp)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  // Use full 24-hour timeline (no START_HOUR offset)
  return hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
}

// Calculate height for a comparison based on its duration
const getComparisonHeight = (comparison: Comparison) => {
  if (comparison.isPerfectMatch || comparison.planned) {
    // Parse duration string like "1 hour", "30 minutes", "1h 30m"
    const durationStr = comparison.duration || comparison.planned?.duration || '1 hour'
    const baseHeight = parseDurationToPixels(durationStr)
    // Return exact proportional height without extra padding
    return baseHeight
  }
  // Default to 1 hour if no duration available
  return HOUR_HEIGHT
}

// Calculate height for an adaptive block
const getAdaptiveBlockHeight = (block: AdaptiveBlock) => {
  const durationMs = block.end - block.start
  const durationMinutes = durationMs / (1000 * 60)
  // Return exact proportional height with 5px spacing subtracted
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT - 5, 20) // Minimum 20px height
}

// Helper function to parse duration strings to minutes
const parseDurationToMinutes = (durationStr: string): number => {
  let totalMinutes = 0

  // Extract hours
  const hourMatch = durationStr.match(/(\d+)\s*h(?:our)?s?/i)
  if (hourMatch && hourMatch[1]) {
    totalMinutes += parseInt(hourMatch[1]) * 60
  }

  // Extract minutes
  const minuteMatch = durationStr.match(/(\d+)\s*m(?:in(?:ute)?)?s?/i)
  if (minuteMatch && minuteMatch[1]) {
    totalMinutes += parseInt(minuteMatch[1])
  }

  // If no hours or minutes found, try to parse just numbers (assume minutes)
  if (totalMinutes === 0) {
    const numberMatch = durationStr.match(/(\d+)/)
    if (numberMatch && numberMatch[1]) {
      totalMinutes = parseInt(numberMatch[1])
    } else {
      // Default to 60 minutes (1 hour)
      totalMinutes = 60
    }
  }

  return totalMinutes
}

// Helper to check if a session is short (30 minutes or less)
const isShortSession = (durationStr: string | undefined): boolean => {
  if (!durationStr) return false
  const totalMinutes = parseDurationToMinutes(durationStr)
  return totalMinutes <= 30
}

// Helper to round timestamp to nearest 10 minutes
const roundToNearest10Min = (timestamp: number): number => {
  const date = new Date(timestamp)
  const minutes = date.getMinutes()
  const roundedMinutes = Math.round(minutes / 10) * 10
  date.setMinutes(roundedMinutes)
  date.setSeconds(0)
  date.setMilliseconds(0)
  return date.getTime()
}

// Helper to calculate height with minimum of 20 minutes
const calculateHeightWithMin = (startTime: number, endTime: number): number => {
  let actualHeight = getComparisonPosition(endTime) - getComparisonPosition(startTime)

  // Handle midnight crossing: if end appears before start, it's on the next day
  if (actualHeight < 0) {
    actualHeight += 24 * HOUR_HEIGHT // Add 24 hours worth of pixels
  }

  const minHeight = (20 / 60) * HOUR_HEIGHT // 20 minutes in pixels
  const heightWithMargin = Math.max(actualHeight, minHeight) - 5 // Subtract 5px for spacing
  return Math.max(heightWithMargin, minHeight) // Ensure we don't go below minimum height
}

// Helper function to parse duration strings to pixel height
const parseDurationToPixels = (durationStr: string): number => {
  // Handle formats like "1 hour", "30 minutes", "1h 30m", "1 hour 30 minutes"
  let totalMinutes = 0

  // Extract hours
  const hourMatch = durationStr.match(/(\d+)\s*h(?:our)?s?/i)
  if (hourMatch && hourMatch[1]) {
    totalMinutes += parseInt(hourMatch[1]) * 60
  }

  // Extract minutes
  const minuteMatch = durationStr.match(/(\d+)\s*m(?:in(?:ute)?)?s?/i)
  if (minuteMatch && minuteMatch[1]) {
    totalMinutes += parseInt(minuteMatch[1])
  }

  // If no hours or minutes found, try to parse just numbers (assume minutes)
  if (totalMinutes === 0) {
    const numberMatch = durationStr.match(/(\d+)/)
    if (numberMatch && numberMatch[1]) {
      totalMinutes = parseInt(numberMatch[1])
    } else {
      // Default to 60 minutes (1 hour)
      totalMinutes = 60
    }
  }

  // Convert minutes to pixels (HOUR_HEIGHT pixels per 60 minutes)
  return (totalMinutes / 60) * HOUR_HEIGHT
}

// Comparisons data
interface Comparison {
  isPerfectMatch?: boolean
  isMismatch?: boolean
  timeRange?: string
  taskName?: string
  duration?: string
  category?: string
  varianceText?: string
  isDone?: boolean   // Whether the routine was completed (for perfect match)
  startTime?: number  // For sorting and positioning
  endTime?: number    // For height calculation
  timeDeviationMs?: number  // Time deviation in milliseconds
  taskId?: string     // For deleting schedules
  timeBlockId?: string // For deleting schedules
  planned?: {
    timeRange: string
    taskName: string
    duration: string
    category: string
    varianceText?: string
    isDone?: boolean   // Whether the linked routine was completed
    startTime: number  // Actual timestamp
    endTime: number    // Actual timestamp
    taskId?: string
    timeBlockId?: string
  }
  actual?: {
    timeRange: string
    taskName: string
    duration: string
    category: string
    varianceText?: string
    isDone?: boolean   // Whether the session was completed
    startTime: number  // Actual timestamp
    endTime: number    // Actual timestamp
  }
  mismatchIcon?: string
  noPlannedText?: string
  noActualText?: string
}

const comparisons = ref<Comparison[]>([])
const isLoadingComparisons = ref(false)

// Add Task Modal state
const showAddTaskModal = ref(false)
const selectedHourForNewTask = ref(9)
const selectedMinuteForNewTask = ref(0)

// Preference Modal state
const showPreferenceModal = ref(false)
const showLoadingModal = ref(false)

// Sidebar state
const showSidebar = ref(false)
const sidebarState = ref<'input' | 'loading' | 'result'>('input')
const aiAnalysis = ref('')
const userPreference = ref('')

// Adaptive schedule state
interface AdaptiveBlockWithTasks extends AdaptiveBlock {
  tasks: Task[]
}

const adaptiveBlocksWithTasks = ref<AdaptiveBlockWithTasks[]>([])

// Empty time slots for adding tasks
interface EmptyTimeSlot {
  hour: number
  minute: number
  position: number
  height: number
}

const emptyTimeSlots = computed(() => {
  const slots: EmptyTimeSlot[] = []
  const SLOT_DURATION = 60 // 60 minutes per slot (1 hour)

  // Create occupied time ranges from comparisons
  const occupiedRanges = comparisons.value.map(c => {
    if (!c.startTime) return null
    const date = new Date(c.startTime)
    const durationStr = c.duration || c.planned?.duration || '1 hour'
    const durationMinutes = parseDurationToMinutes(durationStr)

    return {
      startHour: date.getHours(),
      startMinute: date.getMinutes(),
      endHour: Math.floor((date.getHours() * 60 + date.getMinutes() + durationMinutes) / 60),
      endMinute: (date.getMinutes() + durationMinutes) % 60
    }
  }).filter(r => r !== null)

  // Generate slots for each hour across full 24 hours
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    // Check if this hour slot is occupied
    const isOccupied = occupiedRanges.some(range => {
      if (!range) return false
      const slotStart = hour * 60
      const slotEnd = (hour + 1) * 60
      const rangeStart = range.startHour * 60 + range.startMinute
      const rangeEnd = range.endHour * 60 + range.endMinute
      // Check if there's any overlap
      return !(slotEnd <= rangeStart || slotStart >= rangeEnd)
    })

    if (!isOccupied) {
      const position = hour * HOUR_HEIGHT
      const height = HOUR_HEIGHT

      slots.push({
        hour,
        minute: 0,
        position,
        height
      })
    }
  }

  return slots
})

const openAddTaskForTimeSlot = (hour: number, minute: number) => {
  selectedHourForNewTask.value = hour
  selectedMinuteForNewTask.value = minute
  showAddTaskModal.value = true
}

const closeAddTaskModal = () => {
  showAddTaskModal.value = false
}

// Handle task submission
const handleTaskSubmit = async (taskData: any) => {
  try {
    console.log('Creating new task:', taskData)

    // Convert start and end time to Unix timestamps
    const today = new Date()
    const [startHour, startMinute] = taskData.startTime.split(':')
    const [endHour, endMinute] = taskData.endTime.split(':')

    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(startHour), parseInt(startMinute))
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(endHour), parseInt(endMinute))

    const startTimestamp = startDate.getTime()
    const endTimestamp = endDate.getTime()

    // Create the task first
    const newTask = await TaskCatalogAPI.createTask({
      owner: CURRENT_USER,
      taskName: taskData.taskName,
      category: taskData.category,
      duration: taskData.duration, // already in minutes
      priority: taskData.priority,
      splittable: taskData.splittable,
      ...(taskData.deadline && { deadline: taskData.deadline }),
      ...(taskData.slack && taskData.slack > 0 && { slack: taskData.slack }),
      ...(taskData.notes && { note: taskData.notes })
    })

    if (!newTask.taskId) {
      console.error('ERROR: Task created but taskId is missing!', newTask)
      throw new Error('Task was created but taskId is missing')
    }

    // Check if a time block already exists for this time range
    let allSchedules: TimeBlock[] = []
    try {
      allSchedules = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER)
    } catch (error: any) {
      if (error.message?.includes('No future time blocks found')) {
        allSchedules = []
      } else {
        throw error
      }
    }

    // Find a time block with matching start and end times
    const existingBlock = allSchedules.find(block =>
      block.start === startTimestamp && block.end === endTimestamp
    )

    let timeBlockId: string

    if (existingBlock) {
      timeBlockId = existingBlock.timeBlockId
      if (!existingBlock.taskIdSet.includes(newTask.taskId)) {
        await ScheduleTimeAPI.assignTimeBlock({
          owner: CURRENT_USER,
          taskId: newTask.taskId,
          start: startTimestamp,
          end: endTimestamp
        })
      }
    } else {
      const timeBlockResult = await ScheduleTimeAPI.assignTimeBlock({
        owner: CURRENT_USER,
        taskId: newTask.taskId,
        start: startTimestamp,
        end: endTimestamp
      })
      timeBlockId = timeBlockResult.timeBlockId
    }

    // Update the task to reference this time block
    await TaskCatalogAPI.assignSchedule(
      CURRENT_USER,
      newTask.taskId,
      timeBlockId
    )

    // Wait a bit before refreshing to ensure backend is updated
    await new Promise(resolve => setTimeout(resolve, 500))

    // Refresh the comparisons to show the new task
    await fetchComparisons()

    showAddTaskModal.value = false
  } catch (error: any) {
    console.error('Failed to create task:', error)
    const errorMessage = error.message || 'Unknown error occurred'
    alert(`Failed to create task: ${errorMessage}`)
  }
}

// Optimize Schedule handlers
const handleOptimizeSchedule = () => {
  showSidebar.value = true
  sidebarState.value = 'input'
  userPreference.value = ''
}

const closeSidebar = () => {
  showSidebar.value = false
  sidebarState.value = 'input'
  aiAnalysis.value = ''
  userPreference.value = ''
}

const closePreferenceModal = () => {
  showPreferenceModal.value = false
}

const createAdaptiveSchedulePrompt = (
  owner: string,
  all_tasks: Task[],
  tasks_to_schedule: Task[],
  timeBlocks: TimeBlock[],
  sessions: Session[],
  preference: string
): string => {
  const currentTime = new Date().toISOString()

  // Helper to format tasks
  const tasksToString = (tasks: Task[]) => {
    if (tasks.length === 0) {
      return "No tasks to schedule - all tasks are completed!"
    }
    return tasks.map(t => {
      let taskStr = `- Task ID: ${t.taskId}\n`
      taskStr += `  Name: ${t.taskName}\n`
      taskStr += `  Category: ${t.category}\n`
      taskStr += `  Duration: ${t.duration} minutes\n`
      taskStr += `  Priority: ${t.priority}\n`
      taskStr += `  Splittable: ${t.splittable}\n`
      if (t.deadline) taskStr += `  Deadline: ${t.deadline}\n`
      if (t.slack) taskStr += `  Slack: ${t.slack} minutes\n`
      if (t.preDependence && t.preDependence.length > 0) {
        taskStr += `  Pre-dependencies: ${t.preDependence.join(', ')}\n`
      }
      if (t.note) taskStr += `  Note: ${t.note}\n`
      return taskStr
    }).join('\n')
  }

  // Helper to format schedule
  const scheduleToString = (blocks: TimeBlock[]) => {
    return blocks.map(b => {
      const start = new Date(b.start).toISOString()
      const end = new Date(b.end).toISOString()
      return `- Time Block: ${start} to ${end}\n  Tasks: ${b.taskIdSet.join(', ')}`
    }).join('\n')
  }

  // Helper to format routine
  const routineToString = (sessions: Session[]) => {
    return sessions.filter(s => s.start && s.end).map(s => {
      return `- Session: ${s.sessionName}\n  Start: ${s.start}\n  End: ${s.end}\n  Linked Task: ${s.linkedTaskId || 'None'}`
    }).join('\n')
  }

  // Check if there are no tasks to schedule
  if (tasks_to_schedule.length === 0) {
    return `
You are a helpful AI assistant that creates optimal adaptive schedules for users.

USER: ${owner}
CURRENT TIME: ${currentTime}

ALL TASKS FOR TODAY:
${tasksToString(all_tasks)}

TASKS TO SCHEDULE (Incomplete or Skipped):
${tasksToString(tasks_to_schedule)}

** NOTICE: There are no tasks that need rescheduling. All planned tasks have been completed! **

Return your response as a JSON object with this exact structure:
{
  "analysis": "Great news! You've completed all your planned tasks for today. There's nothing left to reschedule, which means you're staying on track with your goals. Keep up the excellent work!",
  "adaptiveBlocks": [],
  "droppedTaskIds": []
}
`
  }

  return `
You are a helpful AI assistant that creates optimal adaptive schedules for users based on task analysis, planned schedules, actual routines, and user preferences.

USER: ${owner}
CURRENT TIME: ${currentTime}
** CRITICAL: You MUST schedule all time blocks to start at or after this current time. Do NOT schedule anything before ${currentTime}. **

USER PREFERENCES:
${preference}

ALL TASKS FOR TODAY (For Context):
** This is the complete list of all tasks planned for today. Use this for understanding the full scope of the day's work. **
${tasksToString(all_tasks)}

TASKS TO SCHEDULE (Incomplete or Skipped):
** CRITICAL: ONLY these tasks need to be scheduled. These are tasks that were either skipped (not attempted) or incomplete (started but not finished). Tasks marked as completed are NOT included here and should NOT be scheduled. **
${tasksToString(tasks_to_schedule)}

PLANNED SCHEDULE (Original Plan):
${scheduleToString(timeBlocks)}

ACTUAL ROUTINE (What Actually Happened):
${routineToString(sessions)}

TASK PRIORITY SCALE (1-5), determines how urgent the task is:
- Priority 1 (Critical): Must be done ASAP - urgent deadlines, emergencies
- Priority 2 (Important): Should be done soon - upcoming deadlines, high impact
- Priority 3 (Regular): Necessary but not urgent
- Priority 4 (Low): Can be done later
- Priority 5 (Optional): Can be done if time permits - not time-sensitive or important

ANALYSIS REQUIREMENTS:
1. Analyze the deviation between the planned schedule and actual routine
2. Identify tasks that were not completed or were interrupted
3. Consider task priorities (1 = highest priority, 5 = lowest priority), deadlines, and dependencies
4. Schedule critical tasks (priority 1-2) before lower priority tasks
5. Consider user preferences for scheduling
6. Respect task constraints (duration, splittable, slack)
7. **CONCURRENCY OPTIMIZATION (ALWAYS APPLY): Whenever you have a PASSIVE/BACKGROUND task (laundry, dishwashing - tasks that run automatically), you MUST ALWAYS schedule it concurrently with an active task by creating OVERLAPPING time blocks. This is MANDATORY, not optional. Active tasks (cleaning room, organizing notes, studying) CANNOT be done concurrently with each other. RULE: If you see "Do Laundry" or "Dishwashing", immediately find an active task to overlap it with.**

SCHEDULING CONSTRAINTS:
- Times must be in ISO 8601 format (e.g., "2025-10-04T14:00:00Z")
- Start time must be before end time
- ALL time blocks MUST start at or after the CURRENT TIME if provided
- **CRITICAL DURATION RULE: Each time block's duration MUST be at least as long as the longest task in that block (NOT the sum). When tasks are concurrent/overlapping in separate blocks, each block is evaluated independently.**
- For non-splittable tasks, the block must be at least as long as the task duration
- For splittable tasks, you can either: (1) create a single block with duration >= task duration, OR (2) split across multiple blocks where sum of block durations >= task duration
- **CONCURRENCY CLARIFICATION: When creating overlapping blocks, each block duration only needs to match its own task duration. Example: Laundry (60 min) in Block A from 1:40-2:40 PM, Study (120 min) in Block B from 1:40-3:40 PM - this is CORRECT and maximizes time savings.**
- High priority tasks should be scheduled first
- Respect task deadlines
- Consider dependencies (preDependence tasks must be scheduled before dependent tasks)
- If a task is splittable, it can be divided across multiple blocks. Otherwise, do not divide it across multiple **non-consecutive blocks**.
- **MANDATORY: You MUST ALWAYS create overlapping/concurrent blocks for passive tasks (laundry, dishwashing, etc.). This means creating separate blocks with the same or overlapping time ranges. For example, if you have laundry and studying, ALWAYS create two blocks that overlap in time - NEVER schedule passive tasks sequentially. This is required even if you have enough time, as it frees up time for additional tasks.**

CRITICAL REQUIREMENTS:
1. ONLY schedule the tasks listed in "TASKS TO SCHEDULE" section - these are incomplete or skipped tasks
2. Do NOT schedule tasks from "ALL TASKS FOR TODAY" that are not in "TASKS TO SCHEDULE"
3. Ensure all scheduled blocks have valid ISO timestamps
4. Assign tasks based on priority and deadline urgency
4. **ABSOLUTE DEADLINE CONSTRAINT: If a task has a deadline, it MUST be completed BEFORE that deadline. Do NOT schedule any part of the task after its deadline.**
5. **If there is insufficient time to complete all tasks before their deadlines, prioritize higher priority tasks first**
6. **DURATION CONSTRAINT (FLEXIBLE WHEN CONSTRAINED): Ideally give each task its FULL required duration. However, when time is severely constrained and you have leftover time that can't fit a full task, it's acceptable to schedule a partial task duration rather than leaving the time empty. For example, if you have 20 minutes left and a 60-minute task, schedule it for 20 minutes rather than dropping it entirely.**
7. Consider the actual routine and how it deviates from the schedule to understand what time blocks are realistic
8. Provide reasoning for why actual routine deviated from the original planned schedule
9. For a task with a long duration and is splittable, consider splitting it into multiple non-consecutive time blocks for better focus
10. If time is insufficient to schedule all tasks, prioritize tasks with urgent deadlines (approaching soon) or higher priority (1-2); only drop tasks if absolutely no time remains
11. If the task is time sensitive and that critical time is already passed, YOU MUST NOT reschedule it (i.e., DO NOT GENERATE AN ADAPTIVE SCHEDULE FOR IT). For example, if the task is lunch break, but the current time is already in the afternoon, add this task to the droppedTasks, and mark reason as "Lunch time is already passed, cannot reschedule this." Do not generate a schedule for lunch.

Return your response as a JSON object with this exact structure:
{
  "analysis": "Provide a clear, simplified, and human-readable analysis explaining your scheduling decisions. Write in plain language (avoid technical jargon) and explain: (1) Why you scheduled tasks in this order, (2) How you prioritized tasks based on deadlines and priorities, (3) Any tasks you had to drop and why, (4) Any time-saving strategies you used (like concurrent scheduling). Keep it concise but informative - aim for 3-5 sentences that a non-technical user can easily understand.",
  "adaptiveBlocks": [
    {
      "start": "ISO timestamp",
      "end": "ISO timestamp",
      "taskIds": ["taskId1", "taskId2"]
    }
  ],
  "droppedTaskIds": ["taskId3", "taskId4"]
}

EXAMPLE 1 - Deadline constraint:
- If task-1 has deadline at 5 PM and current time is 12 PM
- Available time: 5 hours (300 minutes)
- If task-1 needs 100 min + other high priority tasks need 200 min = 300 min total
- Low priority tasks (task-5, task-6) CANNOT fit before deadline
- CORRECT: Put task-5 and task-6 in droppedTaskIds
- WRONG: Schedule tasks after the 5 PM deadline

EXAMPLE 2 - Concurrency optimization (ALWAYS REQUIRED FOR PASSIVE TASKS):
- Laundry (60 min, PASSIVE) + Study (120 min, ACTIVE)
- MANDATORY APPROACH: Always overlap passive tasks - create these blocks:
  Block A: {"start": "2025-10-04T14:00:00Z", "end": "2025-10-04T15:00:00Z", "taskIds": ["laundry-task-id"]},
  Block B: {"start": "2025-10-04T14:00:00Z", "end": "2025-10-04T16:00:00Z", "taskIds": ["study-task-id"]}
- Result: Both complete by 4:00 PM, saving 60 minutes for other tasks
- WRONG: Scheduling laundry sequentially (3:40-4:40) after studying wastes 60 minutes
- WRONG: Clean Room + Organize Notes overlapping (both ACTIVE - cannot be concurrent)
- WRONG: Any scheduling that extends past the deadline

Return ONLY the JSON object, no additional text.`
}

const handleSidebarProceed = async () => {
  try {
    // Show loading state in sidebar
    sidebarState.value = 'loading'

    // Fetch all required data
    const allTasks = await TaskCatalogAPI.getUserTasks(CURRENT_USER)
    const allTimeBlocks = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER).catch(() => [])
    const allSessions = await RoutineLogAPI.getUserSessions(CURRENT_USER).catch(() => [])

    // Filter to only today's data
    const timeBlocks = allTimeBlocks.filter(block => isTodayTimestamp(block.start))
    const sessions = allSessions.filter(session => isSessionToday(session))

    console.log(`AI Optimization (sidebar): Filtered to ${timeBlocks.length} time blocks and ${sessions.length} sessions for today`)

    // Get all task IDs that are scheduled in today's time blocks
    const todayTaskIds = new Set<string>()
    timeBlocks.forEach(block => {
      block.taskIdSet.forEach(taskId => todayTaskIds.add(taskId))
    })

    // Filter tasks to only those scheduled today
    const tasks = allTasks.filter(task => todayTaskIds.has(task.taskId))

    console.log(`Filtered from ${allTasks.length} total tasks to ${tasks.length} tasks scheduled today`)

    // Debug: Log all sessions for today
    console.log('=== All sessions for today ===')
    sessions.forEach(s => {
      console.log(`Session: ${s.sessionName}, linkedTaskId: ${s.linkedTaskId}, isDone: ${s.isDone}, start: ${s.start}, end: ${s.end}`)
    })

    // Debug: Log all tasks for today
    console.log('=== All tasks scheduled today ===')
    tasks.forEach(t => {
      console.log(`Task: ${t.taskName} (${t.taskId})`)
    })

    // Filter tasks to only include incomplete or skipped ones
    const tasksToSchedule = tasks.filter(task => {
      // Find if this task has a completed session
      const sessionForTask = sessions.find(s => s.linkedTaskId === task.taskId && s.start && s.end)

      console.log(`\nChecking task: ${task.taskName} (${task.taskId})`)
      console.log(`  - Found session: ${sessionForTask ? sessionForTask.sessionName : 'NO SESSION'}`)
      if (sessionForTask) {
        console.log(`  - Session isDone: ${sessionForTask.isDone}`)
        console.log(`  - Session start: ${sessionForTask.start}`)
        console.log(`  - Session end: ${sessionForTask.end}`)
      }

      // Include task if: no session exists (skipped) OR session exists but not completed (incomplete)
      const shouldInclude = !sessionForTask || !sessionForTask.isDone
      console.log(`  - Should include in tasks_to_schedule: ${shouldInclude}`)

      return shouldInclude
    })

    console.log(`\nAI Optimization: ${tasks.length} total tasks, ${tasksToSchedule.length} need scheduling (incomplete/skipped)`)

    // Create prompt
    const prompt = createAdaptiveSchedulePrompt(
      CURRENT_USER,
      tasks,
      tasksToSchedule,
      timeBlocks,
      sessions,
      userPreference.value
    )

    // Call AI API
    const result = await AdaptiveScheduleAPI.requestAdaptiveScheduleAI(CURRENT_USER, prompt)

    // Store the analysis
    aiAnalysis.value = result.analysis

    // Fetch task details for each adaptive block
    const blocksWithTasks: AdaptiveBlockWithTasks[] = []
    for (const block of result.adaptiveBlockTable) {
      const blockTasks: Task[] = []
      for (const taskId of block.taskIdSet) {
        try {
          const task = await TaskCatalogAPI.getTask(CURRENT_USER, taskId)
          blockTasks.push(task)
        } catch (error) {
          console.error(`Failed to fetch task ${taskId}:`, error)
        }
      }
      blocksWithTasks.push({
        ...block,
        tasks: blockTasks
      })
    }

    // Store results
    adaptiveBlocksWithTasks.value = blocksWithTasks

    // Refresh the view to show adaptive blocks
    await fetchComparisons()

    // Show result state with analysis
    sidebarState.value = 'result'
  } catch (error: any) {
    console.error('Failed to generate adaptive schedule:', error)
    sidebarState.value = 'input'
    alert(`Failed to generate adaptive schedule: ${error.message || 'Unknown error'}`)
  }
}

const handlePreferenceProceed = async (preference: string) => {
  try {
    // Close preference modal and show loading
    showPreferenceModal.value = false
    showLoadingModal.value = true

    // Fetch all required data
    const allTasks = await TaskCatalogAPI.getUserTasks(CURRENT_USER)
    const allTimeBlocks = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER).catch(() => [])
    const allSessions = await RoutineLogAPI.getUserSessions(CURRENT_USER).catch(() => [])

    // Filter to only today's data
    const timeBlocks = allTimeBlocks.filter(block => isTodayTimestamp(block.start))
    const sessions = allSessions.filter(session => isSessionToday(session))

    console.log(`AI Optimization (modal): Filtered to ${timeBlocks.length} time blocks and ${sessions.length} sessions for today`)

    // Get all task IDs that are scheduled in today's time blocks
    const todayTaskIds = new Set<string>()
    timeBlocks.forEach(block => {
      block.taskIdSet.forEach(taskId => todayTaskIds.add(taskId))
    })

    // Filter tasks to only those scheduled today
    const tasks = allTasks.filter(task => todayTaskIds.has(task.taskId))

    console.log(`Filtered from ${allTasks.length} total tasks to ${tasks.length} tasks scheduled today`)

    // Debug: Log all sessions for today
    console.log('=== All sessions for today (modal) ===')
    sessions.forEach(s => {
      console.log(`Session: ${s.sessionName}, linkedTaskId: ${s.linkedTaskId}, isDone: ${s.isDone}, start: ${s.start}, end: ${s.end}`)
    })

    // Debug: Log all tasks for today
    console.log('=== All tasks scheduled today (modal) ===')
    tasks.forEach(t => {
      console.log(`Task: ${t.taskName} (${t.taskId})`)
    })

    // Filter tasks to only include incomplete or skipped ones
    const tasksToSchedule = tasks.filter(task => {
      // Find if this task has a completed session
      const sessionForTask = sessions.find(s => s.linkedTaskId === task.taskId && s.start && s.end)

      console.log(`\nChecking task (modal): ${task.taskName} (${task.taskId})`)
      console.log(`  - Found session: ${sessionForTask ? sessionForTask.sessionName : 'NO SESSION'}`)
      if (sessionForTask) {
        console.log(`  - Session isDone: ${sessionForTask.isDone}`)
        console.log(`  - Session start: ${sessionForTask.start}`)
        console.log(`  - Session end: ${sessionForTask.end}`)
      }

      // Include task if: no session exists (skipped) OR session exists but not completed (incomplete)
      const shouldInclude = !sessionForTask || !sessionForTask.isDone
      console.log(`  - Should include in tasks_to_schedule: ${shouldInclude}`)

      return shouldInclude
    })

    console.log(`\nAI Optimization (modal): ${tasks.length} total tasks, ${tasksToSchedule.length} need scheduling (incomplete/skipped)`)

    // Create prompt
    const prompt = createAdaptiveSchedulePrompt(
      CURRENT_USER,
      tasks,
      tasksToSchedule,
      timeBlocks,
      sessions,
      preference
    )

    // Call AI API
    const result = await AdaptiveScheduleAPI.requestAdaptiveScheduleAI(CURRENT_USER, prompt)

    // Fetch task details for each adaptive block
    const blocksWithTasks: AdaptiveBlockWithTasks[] = []
    for (const block of result.adaptiveBlockTable) {
      const blockTasks: Task[] = []
      for (const taskId of block.taskIdSet) {
        try {
          const task = await TaskCatalogAPI.getTask(CURRENT_USER, taskId)
          blockTasks.push(task)
        } catch (error) {
          console.error(`Failed to fetch task ${taskId}:`, error)
        }
      }
      blocksWithTasks.push({
        ...block,
        tasks: blockTasks
      })
    }

    // Store results
    adaptiveBlocksWithTasks.value = blocksWithTasks

    // Refresh the view to show adaptive blocks
    await fetchComparisons()

    showLoadingModal.value = false
  } catch (error) {
    console.error('Failed to generate adaptive schedule:', error)
    showLoadingModal.value = false
    alert('Failed to generate adaptive schedule. Please try again.')
  }
}

// Accept an adaptive block (create schedule and delete adaptive block)
const acceptAdaptiveBlock = async (adaptiveBlock: AdaptiveBlockWithTasks) => {
  try {
    if (!confirm('Are you sure you want to accept this adaptive schedule? This will create a schedule for the task at this time.')) {
      return
    }

    // Create schedule for each task in the adaptive block
    for (const task of adaptiveBlock.tasks) {
      // Step 1: Create/assign time block
      const result = await ScheduleTimeAPI.assignTimeBlock({
        owner: CURRENT_USER,
        taskId: task.taskId,
        start: adaptiveBlock.start,
        end: adaptiveBlock.end
      })
      console.log(`Created time block for task ${task.taskName}:`, result)

      // Step 2: Update task's timeBlockSet with the new time block ID
      await TaskCatalogAPI.assignSchedule(CURRENT_USER, task.taskId, result.timeBlockId)
      console.log(`Updated task ${task.taskName} with time block ${result.timeBlockId}`)
    }

    // Delete the adaptive block
    await AdaptiveScheduleAPI.deleteAdaptiveBlock(CURRENT_USER, adaptiveBlock.timeBlockId)

    // Remove from local state
    adaptiveBlocksWithTasks.value = adaptiveBlocksWithTasks.value.filter(
      block => block.timeBlockId !== adaptiveBlock.timeBlockId
    )

    // Refresh the view to show the new schedule
    await fetchComparisons()

    console.log(`Accepted adaptive block ${adaptiveBlock.timeBlockId}`)
  } catch (error) {
    console.error('Failed to accept adaptive block:', error)
    alert('Failed to accept adaptive block. Please try again.')
  }
}

// Reject an adaptive block (delete it)
const rejectAdaptiveBlock = async (timeBlockId: string) => {
  try {
    if (!confirm('Are you sure you want to reject this adaptive schedule? This will remove it from your timeline.')) {
      return
    }

    await AdaptiveScheduleAPI.deleteAdaptiveBlock(CURRENT_USER, timeBlockId)

    // Remove from local state
    adaptiveBlocksWithTasks.value = adaptiveBlocksWithTasks.value.filter(
      block => block.timeBlockId !== timeBlockId
    )

    console.log(`Rejected adaptive block ${timeBlockId}`)
  } catch (error) {
    console.error('Failed to reject adaptive block:', error)
    alert('Failed to reject adaptive block. Please try again.')
  }
}

// Delete a schedule
const deleteSchedule = async (taskId: string, timeBlockId: string) => {
  try {
    if (!confirm('Are you sure you want to delete this schedule? This will remove it from your timeline.')) {
      return
    }

    // Delete from TaskCatalog (remove timeBlockId from task's timeBlockSet)
    await TaskCatalogAPI.deleteSchedule(CURRENT_USER, taskId, timeBlockId)

    // Delete from ScheduleTime (remove taskId from time block's taskIdSet, or delete time block if empty)
    await ScheduleTimeAPI.removeTask(CURRENT_USER, taskId, timeBlockId)

    // Refresh the view to show the updated state
    await fetchComparisons()

    console.log(`Deleted schedule: task ${taskId}, time block ${timeBlockId}`)
  } catch (error) {
    console.error('Failed to delete schedule:', error)
    alert('Failed to delete schedule. Please try again.')
  }
}

// Helper to check if a timestamp is on the selected date
// Helper to check if a timestamp is today
const isTodayTimestamp = (timestamp: number): boolean => {
  const date = new Date(timestamp)
  const today = new Date()
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate()
}

// Helper to check if a session is today
const isSessionToday = (session: Session): boolean => {
  if (!session.start) return false
  const sessionDate = new Date(session.start)
  return isTodayTimestamp(sessionDate.getTime())
}

// Helper to check if a timestamp matches the selected date
const isOnSelectedDate = (timestamp: number): boolean => {
  const date = new Date(timestamp)
  const selected = currentDate.value
  return date.getFullYear() === selected.getFullYear() &&
         date.getMonth() === selected.getMonth() &&
         date.getDate() === selected.getDate()
}

// Fetch and process comparisons
const fetchComparisons = async () => {
  try {
    isLoadingComparisons.value = true

    // 1. Get all planned schedules
    let plannedSchedules: TimeBlock[] = []
    try {
      const allSchedules = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER)
      // Filter schedules for the selected date
      plannedSchedules = allSchedules.filter(block => isOnSelectedDate(block.start))
      console.log(`Fetched ${plannedSchedules.length} planned time blocks for ${selectedDate.value}:`, plannedSchedules)
    } catch (error: any) {
      console.error('Error fetching planned schedules:', error)
      if (error.message?.includes('No future time blocks found')) {
        plannedSchedules = []
      } else {
        throw error
      }
    }

    // 2. Get all user sessions
    let userSessions: Session[] = []
    try {
      const allSessions = await RoutineLogAPI.getUserSessions(CURRENT_USER)
      // Filter sessions for the selected date
      userSessions = allSessions.filter(session => {
        if (!session.start) return false
        return isOnSelectedDate(new Date(session.start).getTime())
      })
      console.log(`Fetched ${userSessions.length} sessions for ${selectedDate.value}:`, userSessions)
    } catch (error: any) {
      if (!Array.isArray(userSessions)) {
        userSessions = []
      }
    }

    // Create a map to track which sessions have been matched
    const matchedSessions = new Set<string>()
    const processedComparisons: Comparison[] = []

    // 3. Iterate through all planned schedules
    console.log(`Processing ${plannedSchedules.length} planned schedules`)
    for (const timeBlock of plannedSchedules) {
      console.log(`TimeBlock: ${formatTime(timeBlock.start)} - ${formatTime(timeBlock.end)}, tasks: ${timeBlock.taskIdSet.length}`)
      for (const taskId of timeBlock.taskIdSet) {
        // Get task details
        let task: Task | null = null
        try {
          task = await TaskCatalogAPI.getTask(CURRENT_USER, taskId)
        } catch (error) {
          console.error(`Failed to fetch task ${taskId}:`, error)
          continue
        }

        console.log(`Processing planned task: ${task.taskName} (${taskId})`)

        const plannedStart = roundToNearest30Min(timeBlock.start)
        const plannedEnd = roundToNearest30Min(timeBlock.end)

        // Find matching session
        const matchingSession = userSessions.find(session => {
          const hasTime = session.start && session.end
          const linkedMatches = session.linkedTaskId === taskId
          if (!hasTime || !linkedMatches || !session.start || !session.end) {
            return false
          }
          const sessionStart = roundToNearest30Min(new Date(session.start).getTime())
          const sessionEnd = roundToNearest30Min(new Date(session.end).getTime())
          const timeMatches = sessionStart === plannedStart && sessionEnd === plannedEnd
          return timeMatches
        })

        if (matchingSession) {
          // Perfect match case
          console.log(`Matched session ${matchingSession.sessionName} to task ${task.taskName}`)
          matchedSessions.add(matchingSession.sessionId)
          const roundedStart = roundToNearest10Min(timeBlock.start)
          const roundedEnd = roundToNearest10Min(timeBlock.end)
          processedComparisons.push({
            isPerfectMatch: true,
            startTime: roundedStart,
            endTime: roundedEnd,
            timeRange: `${formatTime(timeBlock.start)} - ${formatTime(timeBlock.end)}`,
            taskName: task.taskName,
            duration: formatDuration(timeBlock.end - timeBlock.start),
            category: task.category,
            varianceText: 'Perfect timing ✓',
            isDone: matchingSession.isDone, // Mark as done if session is completed
            timeDeviationMs: 0,
            taskId: taskId,
            timeBlockId: timeBlock.timeBlockId
          })
        } else {
          // Check if there's a session for this task at a different time
          const sessionForTask = userSessions.find(s => s.linkedTaskId === taskId && s.start && s.end)

          if (sessionForTask && !matchedSessions.has(sessionForTask.sessionId)) {
            // Task was done but at different time
            matchedSessions.add(sessionForTask.sessionId)
            const sessionStart = new Date(sessionForTask.start!).getTime()
            const sessionEnd = new Date(sessionForTask.end!).getTime()
            const plannedDuration = timeBlock.end - timeBlock.start
            const actualDuration = sessionEnd - sessionStart
            const timeDiff = actualDuration - plannedDuration

            let varianceText = ''
            if (Math.abs(timeDiff) < 60000) {
              varianceText = 'Same duration'
            } else if (timeDiff > 0) {
              varianceText = `+${formatDuration(timeDiff)} overtime`
            } else {
              // If task was finished and completed early, show "faster"
              if (sessionForTask.isDone) {
                varianceText = `${formatDuration(Math.abs(timeDiff))} faster`
              } else {
                varianceText = `-${formatDuration(Math.abs(timeDiff))} under`
              }
            }

            processedComparisons.push({
              isMismatch: true,
              startTime: Math.min(roundToNearest10Min(timeBlock.start), roundToNearest10Min(sessionStart)),
              endTime: Math.max(roundToNearest10Min(timeBlock.end), roundToNearest10Min(sessionEnd)),
              timeDeviationMs: Math.abs(timeDiff),
              planned: {
                timeRange: `${formatTime(timeBlock.start)} - ${formatTime(timeBlock.end)}`,
                taskName: task.taskName,
                duration: formatDuration(plannedDuration),
                category: task.category,
                isDone: sessionForTask.isDone,
                startTime: roundToNearest10Min(timeBlock.start),
                endTime: roundToNearest10Min(timeBlock.end),
                taskId: taskId,
                timeBlockId: timeBlock.timeBlockId
              },
              actual: {
                timeRange: `${formatTime(sessionStart)} - ${formatTime(sessionEnd)}`,
                taskName: task.taskName,
                duration: formatDuration(actualDuration),
                category: task.category,
                varianceText,
                isDone: sessionForTask.isDone,
                startTime: roundToNearest10Min(sessionStart),
                endTime: roundToNearest10Min(sessionEnd)
              },
              mismatchIcon: '⚠️'
            })
          } else {
            // Planned but not logged at correct time
            const currentTime = Date.now()
            const taskHasEnded = timeBlock.end < currentTime
            const plannedDuration = timeBlock.end - timeBlock.start
            const roundedStart = roundToNearest10Min(timeBlock.start)
            const roundedEnd = roundToNearest10Min(timeBlock.end)

            // Check if there's ANY session for this task (at any time, regardless of completion)
            const anySessionForTask = userSessions.find(s => s.linkedTaskId === taskId && s.start && s.end)

            // Determine variance text:
            // - If has session but not completed -> "Incomplete"
            // - If no session at all -> "Skipped"
            // - If task hasn't ended yet -> undefined (just planned)
            let varianceText: string | undefined
            if (taskHasEnded) {
              if (anySessionForTask) {
                varianceText = anySessionForTask.isDone ? undefined : 'Incomplete'
              } else {
                varianceText = 'Skipped'
              }
            }

            processedComparisons.push({
              isMismatch: taskHasEnded, // Only a mismatch if task has ended
              startTime: roundedStart,
              endTime: roundedEnd,
              timeDeviationMs: taskHasEnded ? plannedDuration : 0,
              planned: {
                timeRange: `${formatTime(timeBlock.start)} - ${formatTime(timeBlock.end)}`,
                taskName: task.taskName,
                duration: formatDuration(plannedDuration),
                category: task.category,
                varianceText,
                isDone: anySessionForTask?.isDone || false,
                startTime: roundedStart,
                endTime: roundedEnd,
                taskId: taskId,
                timeBlockId: timeBlock.timeBlockId
              },
              mismatchIcon: taskHasEnded ? '✕' : undefined,
              noActualText: 'No logged session, click to start logging'
            })
          }
        }
      }
    }

    // Add unplanned sessions (sessions without matching planned tasks)
    console.log('Checking for unplanned sessions...')
    console.log('Total sessions:', userSessions.length)
    console.log('Matched sessions:', matchedSessions.size)
    console.log('Matched session IDs:', Array.from(matchedSessions))

    for (const session of userSessions) {
      const isMatched = matchedSessions.has(session.sessionId)
      const hasStart = !!session.start
      const hasEnd = !!session.end
      console.log(`Session: ${session.sessionName}`)
      console.log(`  - sessionId: ${session.sessionId}`)
      console.log(`  - start: ${session.start} (has: ${hasStart})`)
      console.log(`  - end: ${session.end} (has: ${hasEnd})`)
      console.log(`  - linkedTaskId: ${session.linkedTaskId}`)
      console.log(`  - isMatched: ${isMatched}`)
      console.log(`  - Will add to unplanned: ${!isMatched && hasStart && hasEnd}`)

      if (!matchedSessions.has(session.sessionId) && session.start && session.end) {
        console.log(`✓ ADDING unplanned session: ${session.sessionName}`)
        const sessionStart = new Date(session.start).getTime()
        const sessionEnd = new Date(session.end).getTime()
        const actualDuration = sessionEnd - sessionStart

        let category = ''
        if (session.linkedTaskId) {
          try {
            const task = await TaskCatalogAPI.getTask(CURRENT_USER, session.linkedTaskId)
            category = task.category
          } catch (error) {
            console.error(`Failed to fetch task ${session.linkedTaskId} for session ${session.sessionId}:`, error)
          }
        }

        const roundedStart = roundToNearest10Min(sessionStart)
        const roundedEnd = roundToNearest10Min(sessionEnd)
        processedComparisons.push({
          isMismatch: true,
          startTime: roundedStart,
          endTime: roundedEnd,
          timeDeviationMs: actualDuration, // Entire unplanned session duration counts as deviation
          actual: {
            timeRange: `${formatTime(sessionStart)} - ${formatTime(sessionEnd)}`,
            taskName: session.sessionName,
            duration: formatDuration(actualDuration),
            category: category || 'Ad-hoc',
            varianceText: 'Unplanned',
            isDone: session.isDone,
            startTime: roundedStart,
            endTime: roundedEnd
          },
          mismatchIcon: '+',
          noPlannedText: 'No planned task'
        })
      }
    }

    // Sort comparisons by start time
    processedComparisons.sort((a, b) => (a.startTime || 0) - (b.startTime || 0))

    comparisons.value = processedComparisons

    // Update stats
    stats.value.totalTasks = processedComparisons.length
    stats.value.perfectMatch = processedComparisons.filter(c => c.isPerfectMatch).length
    stats.value.mismatched = processedComparisons.filter(c => c.isMismatch).length

    // Calculate total time variance as sum of absolute deviations
    let totalVarianceMs = 0
    for (const comparison of processedComparisons) {
      if (comparison.timeDeviationMs !== undefined) {
        totalVarianceMs += comparison.timeDeviationMs
      }
    }

    stats.value.timeVariance = formatDuration(totalVarianceMs)

    // 4. Fetch adaptive blocks for the current user
    try {
      console.log('Fetching adaptive blocks...')
      const adaptiveBlocks = await AdaptiveScheduleAPI.getAdaptiveSchedule(CURRENT_USER)

      // Filter adaptive blocks for the selected date
      const filteredBlocks = adaptiveBlocks.filter(block => isOnSelectedDate(block.start))
      console.log(`Fetched ${filteredBlocks.length} adaptive blocks for ${selectedDate.value}`)

      // Fetch task details for each adaptive block
      const blocksWithTasks: AdaptiveBlockWithTasks[] = []
      for (const block of filteredBlocks) {
        const blockTasks: Task[] = []
        for (const taskId of block.taskIdSet) {
          try {
            const task = await TaskCatalogAPI.getTask(CURRENT_USER, taskId)
            blockTasks.push(task)
          } catch (error) {
            console.error(`Failed to fetch task ${taskId} for adaptive block:`, error)
          }
        }
        blocksWithTasks.push({
          ...block,
          tasks: blockTasks
        })
      }

      // Store adaptive blocks
      adaptiveBlocksWithTasks.value = blocksWithTasks
      console.log(`Loaded ${blocksWithTasks.length} adaptive blocks with tasks`)
    } catch (error: any) {
      // If no adaptive blocks exist or error occurs, just set to empty array
      console.log('No adaptive blocks found or error fetching:', error.message)
      adaptiveBlocksWithTasks.value = []
    }

  } catch (error) {
    console.error('Failed to fetch comparisons:', error)
    comparisons.value = []
  } finally {
    isLoadingComparisons.value = false
  }
}

// Layout calculation for overlapping tasks
interface TaskWithLayout {
  startTime: number
  endTime: number
  layoutWidth: number  // Width as percentage (e.g., 50 for 50%)
  layoutLeft: number   // Left offset as percentage (e.g., 0, 50)
  layoutColumn: number // Column index
}

// Helper to check if two time ranges overlap
const timeRangesOverlap = (start1: number, end1: number, start2: number, end2: number) => {
  return start1 < end2 && start2 < end1
}

// Generic function to calculate layout for a list of tasks with time ranges
const calculateOverlappingLayout = <T extends { startTime: number; endTime: number }>(
  items: T[]
): (T & TaskWithLayout)[] => {
  if (items.length === 0) return []

  // Create layout objects
  const itemsWithLayout: (T & TaskWithLayout)[] = items.map(item => ({
    ...item,
    layoutWidth: 100,
    layoutLeft: 0,
    layoutColumn: 0
  }))

  // Group overlapping items
  const processedItems = new Set<number>()
  const overlapGroups: (T & TaskWithLayout)[][] = []

  for (let i = 0; i < itemsWithLayout.length; i++) {
    if (processedItems.has(i)) continue

    const group: (T & TaskWithLayout)[] = [itemsWithLayout[i]]
    processedItems.add(i)

    // Find all items that overlap with this item or any item in the group
    for (let j = 0; j < itemsWithLayout.length; j++) {
      if (processedItems.has(j)) continue

      // Check if this item overlaps with any item in the current group
      const overlaps = group.some(groupItem =>
        timeRangesOverlap(
          groupItem.startTime,
          groupItem.endTime,
          itemsWithLayout[j].startTime,
          itemsWithLayout[j].endTime
        )
      )

      if (overlaps) {
        group.push(itemsWithLayout[j])
        processedItems.add(j)
      }
    }

    overlapGroups.push(group)
  }

  // Calculate layout for each group
  for (const group of overlapGroups) {
    if (group.length === 1) {
      // Single item - full width
      group[0].layoutWidth = 100
      group[0].layoutLeft = 0
      group[0].layoutColumn = 0
    } else {
      // Multiple overlapping items - arrange side by side
      // Sort by start time, then by duration (shorter first)
      group.sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime - b.startTime
        const durationA = a.endTime - a.startTime
        const durationB = b.endTime - b.startTime
        return durationA - durationB
      })

      // Calculate columns needed
      const columns: (T & TaskWithLayout)[][] = []

      for (const item of group) {
        // Find the first column where this item doesn't overlap with existing items
        let placed = false
        for (let i = 0; i < columns.length; i++) {
          const column = columns[i]
          const hasOverlap = column.some(existingItem =>
            timeRangesOverlap(
              item.startTime,
              item.endTime,
              existingItem.startTime,
              existingItem.endTime
            )
          )

          if (!hasOverlap) {
            column.push(item)
            item.layoutColumn = i
            placed = true
            break
          }
        }

        // If no suitable column found, create a new one
        if (!placed) {
          columns.push([item])
          item.layoutColumn = columns.length - 1
        }
      }

      // Set width and left position based on column count
      const columnCount = columns.length
      const widthPercent = 100 / columnCount

      for (const item of group) {
        item.layoutWidth = widthPercent
        item.layoutLeft = item.layoutColumn * widthPercent
      }
    }
  }

  return itemsWithLayout
}

// Calculate layouts for planned tasks
const plannedTaskLayouts = computed(() => {
  const plannedTasks = comparisons.value
    .filter(c => c.planned)
    .map(c => c.planned!)

  return calculateOverlappingLayout(plannedTasks)
})

// Calculate layouts for actual tasks
const actualTaskLayouts = computed(() => {
  const actualTasks = comparisons.value
    .filter(c => c.actual)
    .map(c => c.actual!)
  return calculateOverlappingLayout(actualTasks)
})

// Calculate layouts for adaptive blocks
const adaptiveBlockLayouts = computed(() => {
  const blocks = adaptiveBlocksWithTasks.value.map(block => ({
    ...block,
    startTime: block.start,
    endTime: block.end
  }))
  return calculateOverlappingLayout(blocks)
})

// Create comparisons with layouts attached
const comparisonsWithPlannedLayout = computed(() => {
  return comparisons.value.map(comparison => {
    if (!comparison.planned) return comparison

    const layout = plannedTaskLayouts.value.find(
      layout =>
        layout.startTime === comparison.planned!.startTime &&
        layout.endTime === comparison.planned!.endTime &&
        layout.taskName === comparison.planned!.taskName
    )

    return {
      ...comparison,
      plannedLayout: layout || { layoutWidth: 100, layoutLeft: 0 }
    }
  })
})

const comparisonsWithActualLayout = computed(() => {
  return comparisons.value.map(comparison => {
    if (!comparison.actual) return comparison

    const layout = actualTaskLayouts.value.find(
      layout =>
        layout.startTime === comparison.actual!.startTime &&
        layout.endTime === comparison.actual!.endTime &&
        layout.taskName === comparison.actual!.taskName
    )

    return {
      ...comparison,
      actualLayout: layout || { layoutWidth: 100, layoutLeft: 0 }
    }
  })
})

onMounted(async () => {
  // Initialize selected date
  selectedDate.value = formatDisplayDate(currentDate.value)

  updateCurrentTimePosition()
  // Update current time every minute
  const interval = setInterval(updateCurrentTimePosition, 60000)

  // Fetch comparisons
  await fetchComparisons()

  // Auto-scroll to current time (center it in viewport) like Today view
  if (timelineContainerRef.value) {
    const currentPos = currentTimePosition.value
    // Center the current time in the viewport (adjust for more compact timeline)
    timelineContainerRef.value.scrollTop = currentPos - 150
  }

  onUnmounted(() => {
    clearInterval(interval)
  })
})
</script>

<style scoped>
.compare-view {
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
  width: 100%;
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

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(245, 232, 216, 0.1);
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 4px;
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

.nav-button {
  background: transparent;
  border: none;
  color: rgba(245, 232, 216, 0.8);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.nav-button:hover {
  background: rgba(245, 232, 216, 0.15);
  color: #F5E8D8;
}

.nav-button.today-button {
  padding: 8px 16px;
}

.nav-button.today-button.active {
  background: rgba(255, 111, 97, 0.2);
  color: #FF6F61;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px 20px 120px;
}

.comparison-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #AAA;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.stat-card.variance {
  border-color: #FF6F61;
  background: linear-gradient(135deg, #2A1F1A 0%, #3A2A20 100%);
}

.stat-card.variance .stat-value {
  color: #FF6F61;
}

.optimize-button-container {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.optimize-schedule-button {
  background: rgba(255, 198, 54, 0.5);
  border: 2px solid #FFC636;
  border-radius: 10px;
  padding: 16px 48px;
  font-size: 16px;
  font-weight: 700;
  color: #FFC636;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  letter-spacing: 0.5px;
}

.optimize-schedule-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  background: rgba(255, 198, 54, 0.65);
  border-color: #FFC636;
}

.optimize-schedule-button:active {
  transform: translateY(0px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #F5E8D8;
}

.legend-icon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.legend-icon.planned {
  background: rgba(245, 232, 216, 0.3);
  border: 2px solid #F5E8D8;
}

.legend-icon.actual {
  background: rgba(255, 111, 97, 0.3);
  border: 2px solid #FF6F61;
}

.legend-icon.overlap {
  background: rgba(76, 175, 80, 0.3);
  border: 2px solid #4CAF50;
}

.timeline-wrapper {
  position: relative;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
  height: 48vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.timeline-wrapper::-webkit-scrollbar {
  width: 8px;
}

.timeline-wrapper::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.timeline-wrapper::-webkit-scrollbar-thumb {
  background: #3a3a3a;
  border-radius: 4px;
}

.timeline-wrapper::-webkit-scrollbar-thumb:hover {
  background: #4a4a4a;
}

.unified-timeline {
  position: relative;
  padding-left: 100px;
  width: 600px;
  max-width: 600px;
  margin: 0 auto;
  min-height: 2880px; /* 24 hours * 120px per hour = 2880px */
  height: 2880px;
}

.time-axis {
  position: absolute;
  left: 0;
  top: 0;
  height: 2880px;
  width: 90px;
  border-right: 2px solid #444;
}

.time-marker {
  position: absolute;
  left: 0;
  width: 85px;
  text-align: right;
  transform: translateY(-8px);
  padding-right: 12px;
  font-size: 12px;
  color: #F5E8D8;
  font-weight: 700;
}

.time-dot {
  position: absolute;
  right: -6px;
  top: -1px;
  width: 8px;
  height: 8px;
  background: #DAA520;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(218, 165, 32, 0.4);
}

.current-time-line {
  position: absolute;
  left: 88px;
  width: calc(100% - 88px);
  height: 3px;
  background: linear-gradient(90deg, #FF4500 0%, #FF6F61 100%);
  border-radius: 2px;
  z-index: 50;
  box-shadow: 0 2px 12px rgba(255, 69, 0, 0.5);
}

.current-time-line::before {
  content: 'NOW';
  position: absolute;
  right: 8px;
  top: -20px;
  font-size: 10px;
  color: #FF4500;
  font-weight: 700;
  letter-spacing: 1px;
}

.perfect-match-slot {
  position: absolute;
  left: 100px;
  right: 0;
  padding: 0;
  box-sizing: border-box;
}

.planned-task-slot {
  position: absolute;
  padding: 0;
  box-sizing: border-box;
}

.delete-schedule-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.9);
  color: white;
  border: none;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  opacity: 0;
  transition: all 0.2s ease;
  line-height: 1;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.planned-task-slot:hover .delete-schedule-btn {
  opacity: 1;
}

.delete-schedule-btn:hover {
  background: rgba(220, 38, 38, 1);
  transform: scale(1.1);
}

.actual-task-slot {
  position: absolute;
  padding: 0;
  box-sizing: border-box;
}

.planned-task,
.actual-task {
  flex: 1;
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 8px;
  padding: 8px 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border: 1.5px solid;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  height: 100%; /* Fill the full height of task-comparison */
  box-sizing: border-box; /* Include padding in height calculation */
  margin: 0; /* No margin - height is exactly proportional to duration */
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.planned-task {
  border-color: #F5E8D8;
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
}

.actual-task {
  border-color: #FF6F61;
  background: linear-gradient(135deg, #2A1F1A 0%, #3A2A20 100%);
}

.planned-task::before {
  content: 'PLANNED';
  position: absolute;
  top: 6px;
  left: 8px;
  background: #2A2A2A;
  color: #CCC;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(245, 232, 216, 0.3);
  opacity: 0.7;
}

.actual-task::before {
  content: 'ACTUAL';
  position: absolute;
  top: 6px;
  left: 8px;
  background: #2A1F1A;
  color: #DDD;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(255, 111, 97, 0.3);
  opacity: 0.7;
}

/* Hide label for short tasks (30 min or less) */
.planned-task.short-task::before,
.actual-task.short-task::before,
.task-perfect-match.short-task::before {
  display: none;
}

/* Inline title for short tasks */
.task-title-inline {
  font-size: 12px;
  font-weight: 600;
  color: #F5E8D8;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-label {
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
  vertical-align: middle;
}

.planned-task .inline-label {
  background: #2A2A2A;
  color: #CCC;
  border: 1px solid rgba(245, 232, 216, 0.3);
}

.actual-task .inline-label {
  background: #2A1F1A;
  color: #DDD;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.task-perfect-match {
  flex: 1;
  background: linear-gradient(135deg, #1A2A1A 0%, #2A3A2A 100%);
  border: 1.5px solid #4CAF50;
  border-radius: 8px;
  padding: 8px 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  height: 100%;
  box-sizing: border-box;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.task-perfect-match::before {
  content: 'PERFECT MATCH';
  position: absolute;
  top: 6px;
  left: 8px;
  background: #1A2A1A;
  color: #4CAF50;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(76, 175, 80, 0.3);
  opacity: 0.7;
}

.task-perfect-match.short-task {
  justify-content: center;
}

.task-perfect-match:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.planned-task:hover,
.actual-task:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.empty-time-slot {
  position: absolute;
  left: 100px;
  width: calc(50% - 46px); /* Match planned task width: 50% minus half the gap (12px/2 = 6px) */
  transition: all 0.2s ease;
  padding: 0; /* No padding - match time-slot */
  box-sizing: border-box;
}

.empty-slot-panel {
  position: relative;
  width: 100%;
  height: 100%; /* Fill full height */
  background: transparent;
  border: 2px dashed rgba(245, 232, 216, 0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  opacity: 0;
  margin: 0; /* No margin */
}

.empty-time-slot:hover .empty-slot-panel {
  opacity: 1;
  background: linear-gradient(135deg, rgba(42, 42, 42, 0.8) 0%, rgba(51, 51, 51, 0.8) 100%);
  border-color: rgba(245, 232, 216, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.add-task-content {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.empty-time-slot:hover .add-task-content {
  opacity: 1;
}

.add-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(245, 232, 216, 0.1);
  border: 1.5px solid rgba(245, 232, 216, 0.4);
  color: #F5E8D8;
  font-size: 18px;
  font-weight: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.empty-slot-panel:hover .add-icon {
  background: rgba(245, 232, 216, 0.15);
  border-color: #F5E8D8;
  transform: scale(1.1);
}

.add-text {
  color: #F5E8D8;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.task-time {
  font-size: 9px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 3px;
  margin-bottom: 4px;
  display: inline-block;
  letter-spacing: 0.2px;
  white-space: nowrap;
  flex-shrink: 0;
}

.planned-task .task-time {
  background: rgba(245, 232, 216, 0.1);
  color: #F5E8D8;
  border: 1px solid rgba(245, 232, 216, 0.2);
}

.actual-task .task-time {
  background: rgba(255, 111, 97, 0.1);
  color: #FF6F61;
  border: 1px solid rgba(255, 111, 97, 0.2);
}

.task-perfect-match .task-time {
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.task-title {
  font-size: 13px;
  font-weight: 600;
  color: #F5E8D8;
  margin-bottom: 2px;
  line-height: 1.2;
  letter-spacing: -0.2px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.task-duration {
  font-size: 9px;
  font-weight: 400;
  color: #999;
  letter-spacing: 0.1px;
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mismatch-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  background: #FF4500;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
  font-weight: bold;
  z-index: 10;
  animation: pulse 2s infinite;
  box-shadow: 0 0 12px rgba(255, 69, 0, 0.6);
}

@keyframes pulse {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
  }
}

.variance-badge {
  font-size: 8px;
  font-weight: 600;
  color: #FF4500;
  background: rgba(255, 69, 0, 0.15);
  padding: 2px 5px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.variance-badge.skipped {
  color: #FF6F61;
  background: rgba(255, 111, 97, 0.15);
}

.variance-badge.incomplete {
  color: #FFD700;
  background: rgba(255, 215, 0, 0.15);
}

.completed-badge {
  font-size: 8px;
  font-weight: 600;
  color: #4CAF50;
  background: rgba(76, 175, 80, 0.15);
  padding: 2px 5px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.variance-text {
  position: absolute;
  bottom: 3px;
  right: 6px;
  font-size: 8px;
  font-weight: 600;
  color: #FF4500;
  background: rgba(255, 69, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid rgba(255, 69, 0, 0.3);
  white-space: nowrap;
}

.variance-text.positive {
  color: #4CAF50;
  background: rgba(76, 175, 80, 0.1);
  border-color: rgba(76, 175, 80, 0.3);
}

.no-task {
  flex: 1;
  background: rgba(245, 232, 216, 0.05);
  border: 2px dashed #555;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 10px;
  font-style: italic;
}

.time-slot.major-mismatch {
  background: linear-gradient(90deg, transparent 0%, rgba(255, 69, 0, 0.1) 50%, transparent 100%);
  border-left-color: #FF4500;
  border-radius: 0 8px 8px 0;
}

.adaptive-block-slot {
  position: absolute;
  padding: 0; /* No padding - height proportional to duration */
  box-sizing: border-box;
}

.adaptive-block-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.adaptive-block-slot:hover .adaptive-block-actions {
  opacity: 1;
}

.accept-adaptive-block-btn,
.reject-adaptive-block-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: white;
  border: none;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  line-height: 1;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.accept-adaptive-block-btn {
  background: rgba(34, 197, 94, 0.9);
}

.accept-adaptive-block-btn:hover {
  background: rgba(34, 197, 94, 1);
  transform: scale(1.1);
}

.reject-adaptive-block-btn {
  background: rgba(220, 38, 38, 0.9);
}

.reject-adaptive-block-btn:hover {
  background: rgba(220, 38, 38, 1);
  transform: scale(1.1);
}

.adaptive-task {
  background: rgba(218, 165, 32, 0.2);
  border: 2px solid #DAA520;
  border-radius: 8px;
  padding: 8px 10px;
  margin: 0;
  height: 100%; /* Fill full height - proportional to duration */
  box-sizing: border-box;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.adaptive-task:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(218, 165, 32, 0.3);
  background: rgba(218, 165, 32, 0.3);
}

.adaptive-task::before {
  content: 'ADAPTIVE';
  position: absolute;
  top: 6px;
  left: 8px;
  background: #2A2A2A;
  color: #DAA520;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid #DAA520;
  opacity: 0.7;
}

.adaptive-task .task-time {
  background: rgba(218, 165, 32, 0.1);
  color: #DAA520;
  border: 1px solid rgba(218, 165, 32, 0.2);
}

.adaptive-task .task-title {
  color: #DAA520;
}

.adaptive-task .task-duration {
  color: #B8944A;
}

.floating-insights {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 320px;
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid #444;
  z-index: 200;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.floating-insights.collapsed {
  width: 60px;
  height: 60px;
}

.insights-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid #444;
}

.insights-header:hover {
  background: rgba(255, 111, 97, 0.05);
}

.insights-title {
  font-size: 16px;
  font-weight: 700;
  color: #F5E8D8;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.3s ease;
}

.floating-insights.collapsed .insights-title {
  opacity: 0;
}

.toggle-icon {
  font-size: 18px;
  color: #FF6F61;
  transition: all 0.3s ease;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 111, 97, 0.1);
}

.toggle-icon:hover {
  background: rgba(255, 111, 97, 0.2);
  transform: scale(1.1);
}

.floating-insights.collapsed .toggle-icon {
  transform: rotate(180deg);
}

.insights-content {
  padding: 0 20px 20px 20px;
  max-height: 400px;
  opacity: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-insights.collapsed .insights-content {
  max-height: 0;
  opacity: 0;
  padding: 0;
}

.insights-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #FF6F61;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(255, 111, 97, 0.4);
  transition: all 0.3s ease;
}

.floating-insights.collapsed .insights-badge {
  top: 5px;
  right: 5px;
  transform: scale(0.8);
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #444;
  font-size: 13px;
  line-height: 1.4;
}

.insight-item:last-child {
  border-bottom: none;
}

.insight-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 2px;
}

.insight-icon.warning {
  background: rgba(255, 69, 0, 0.2);
  color: #FF4500;
  border: 1px solid rgba(255, 69, 0, 0.3);
}

.insight-icon.success {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.insight-icon.info {
  background: rgba(218, 165, 32, 0.2);
  color: #DAA520;
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.insight-text {
  color: #F5E8D8;
  flex: 1;
}

/* AI Sidebar - Inline, Minimalistic Design */
.ai-sidebar {
  position: fixed;
  right: 0;
  top: 72px; /* Below navbar */
  width: 360px;
  height: calc(100vh - 72px);
  background: #1a1a1a;
  border-left: 1px solid rgba(245, 232, 216, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.sidebar-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(245, 232, 216, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: #F5E8D8;
  margin: 0;
  opacity: 0.9;
}

.sidebar-close {
  background: transparent;
  border: none;
  color: rgba(245, 232, 216, 0.6);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.sidebar-close:hover {
  background: rgba(245, 232, 216, 0.1);
  color: #F5E8D8;
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.sidebar-state {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sidebar-hint {
  font-size: 13px;
  color: rgba(245, 232, 216, 0.6);
  line-height: 1.5;
  margin: 0;
}

.preference-input {
  background: rgba(245, 232, 216, 0.03);
  border: 1px solid rgba(245, 232, 216, 0.1);
  border-radius: 8px;
  padding: 12px;
  color: #F5E8D8;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  transition: border-color 0.2s ease;
}

.preference-input:focus {
  outline: none;
  border-color: rgba(255, 111, 97, 0.4);
}

.preference-input::placeholder {
  color: rgba(245, 232, 216, 0.3);
}

.generate-btn {
  background: #FF6F61;
  border: none;
  border-radius: 6px;
  padding: 10px 16px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.generate-btn:hover {
  background: #FF8A7A;
}

.loading-state {
  align-items: center;
  text-align: center;
  padding: 40px 20px;
}

.spinner-container {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
}

.spinner {
  width: 100%;
  height: 100%;
  border: 3px solid rgba(245, 232, 216, 0.1);
  border-top-color: #FF6F61;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  font-weight: 500;
  color: #F5E8D8;
  margin: 0 0 4px 0;
}

.loading-subtext {
  font-size: 12px;
  color: rgba(245, 232, 216, 0.5);
  margin: 0;
}

.result-state {
  gap: 24px;
}

.success-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(76, 175, 80, 0.15);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #4CAF50;
}

.check-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: #4CAF50;
  border-radius: 50%;
  color: white;
  font-size: 12px;
}

.analysis-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.analysis-heading {
  font-size: 13px;
  font-weight: 600;
  color: #F5E8D8;
  margin: 0;
  opacity: 0.9;
}

.analysis-text {
  background: rgba(245, 232, 216, 0.03);
  border: 1px solid rgba(245, 232, 216, 0.1);
  border-radius: 8px;
  padding: 16px;
  color: rgba(245, 232, 216, 0.8);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  max-height: 500px;
  overflow-y: auto;
}

.done-btn {
  background: transparent;
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 6px;
  padding: 10px 16px;
  color: #F5E8D8;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.done-btn:hover {
  background: rgba(245, 232, 216, 0.05);
  border-color: rgba(245, 232, 216, 0.3);
}

/* Sidebar Transition */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(100%);
}
</style>
