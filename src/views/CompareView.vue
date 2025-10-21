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
          </div>
        </div>
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

      <div class="unified-timeline">
        <div class="time-axis">
          <div
            v-for="hour in timeMarkers"
            :key="hour.time"
            class="time-marker"
            :style="{ top: hour.position + 'px' }"
          >
            {{ hour.label }}
            <div class="time-dot"></div>
          </div>
        </div>

        <div class="current-time-line" :style="{ top: currentTimePosition + 'px' }"></div>

        <!-- Comparison slots -->
        <div
          v-for="(comparison, index) in comparisons"
          :key="index"
          class="time-slot"
          :class="{ 'major-mismatch': comparison.isMismatch }"
        >
          <div class="task-comparison">
            <!-- Perfect Match -->
            <div v-if="comparison.isPerfectMatch" class="task-perfect-match">
              <div class="task-time">{{ comparison.timeRange }}</div>
              <div class="task-title">{{ comparison.taskName }}</div>
              <div class="task-duration">{{ comparison.duration }} • {{ comparison.category }}</div>
              <div class="variance-text positive">{{ comparison.varianceText }}</div>
            </div>

            <!-- Mismatch -->
            <template v-else>
              <div v-if="comparison.planned" class="planned-task">
                <div class="task-time">{{ comparison.planned.timeRange }}</div>
                <div class="task-title">{{ comparison.planned.taskName }}</div>
                <div class="task-duration">{{ comparison.planned.duration }} • {{ comparison.planned.category }}</div>
                <div v-if="comparison.planned.varianceText" class="variance-text">
                  {{ comparison.planned.varianceText }}
                </div>
              </div>
              <div v-else class="no-task">{{ comparison.noPlannedText || 'No planned task' }}</div>

              <div v-if="comparison.mismatchIcon" class="mismatch-indicator">
                {{ comparison.mismatchIcon }}
              </div>

              <div v-if="comparison.actual" class="actual-task">
                <div class="task-time">{{ comparison.actual.timeRange }}</div>
                <div class="task-title">{{ comparison.actual.taskName }}</div>
                <div class="task-duration">{{ comparison.actual.duration }} • {{ comparison.actual.category }}</div>
                <div v-if="comparison.actual.varianceText" class="variance-text">
                  {{ comparison.actual.varianceText }}
                </div>
              </div>
              <div v-else class="no-task">{{ comparison.noActualText || 'Task skipped' }}</div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="floating-insights" :class="{ collapsed: insightsCollapsed }">
      <div class="insights-badge">{{ insights.length }}</div>
      <div class="insights-header" @click="toggleInsights">
        <div class="insights-title">Smart Insights</div>
        <div class="toggle-icon">▼</div>
      </div>
      <div class="insights-content">
        <div v-for="(insight, index) in insights" :key="index" class="insight-item">
          <div class="insight-icon" :class="insight.type">{{ insight.icon }}</div>
          <div class="insight-text">{{ insight.text }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { TaskCatalogAPI, RoutineLogAPI, ScheduleTimeAPI, CURRENT_USER, type Task, type Session, type TimeBlock } from '../services/api'

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
const goToPreviousDay = () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() - 1)
  currentDate.value = newDate
  selectedDate.value = formatDisplayDate(newDate)
}

const goToToday = () => {
  currentDate.value = new Date()
  selectedDate.value = formatDisplayDate(currentDate.value)
}

const goToNextDay = () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + 1)
  currentDate.value = newDate
  selectedDate.value = formatDisplayDate(newDate)
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

// Stats
const stats = ref({
  totalTasks: 0,
  perfectMatch: 0,
  mismatched: 0,
  timeVariance: '0m'
})

// Time markers for timeline
const timeMarkers = computed(() => {
  const markers = []
  const HOUR_HEIGHT = 120 // 120px per hour
  for (let hour = 9; hour <= 15; hour++) {
    const position = (hour - 9) * HOUR_HEIGHT
    const isPM = hour >= 12
    const displayHour = hour > 12 ? hour - 12 : hour
    const label = `${displayHour}:00 ${isPM ? 'PM' : 'AM'}`
    markers.push({ time: hour, position, label })
  }
  return markers
})

// Current time position
const currentTimePosition = ref(0)
const updateCurrentTimePosition = () => {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const HOUR_HEIGHT = 120
  const START_HOUR = 9
  const totalMinutes = (hours - START_HOUR) * 60 + minutes
  currentTimePosition.value = (totalMinutes / 60) * HOUR_HEIGHT
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
  planned?: {
    timeRange: string
    taskName: string
    duration: string
    category: string
    varianceText?: string
  }
  actual?: {
    timeRange: string
    taskName: string
    duration: string
    category: string
    varianceText?: string
  }
  mismatchIcon?: string
  noPlannedText?: string
  noActualText?: string
}

const comparisons = ref<Comparison[]>([
  {
    isPerfectMatch: true,
    timeRange: '9:00 - 10:30 AM',
    taskName: 'Morning Workout',
    duration: '90 minutes',
    category: 'Health & Fitness',
    varianceText: 'Perfect timing ✓'
  },
  {
    isMismatch: true,
    planned: {
      timeRange: '11:00 - 12:30 PM',
      taskName: 'Client Presentation Prep',
      duration: '90 minutes',
      category: 'Work'
    },
    actual: {
      timeRange: '11:20 - 1:10 PM',
      taskName: 'Client Presentation Prep',
      duration: '110 minutes',
      category: 'Work',
      varianceText: '+20m start, +20m duration'
    },
    mismatchIcon: '⚠️'
  },
  {
    isMismatch: true,
    planned: {
      timeRange: '1:00 - 2:00 PM',
      taskName: 'Lunch Break',
      duration: '60 minutes',
      category: 'Personal'
    },
    actual: {
      timeRange: '1:10 - 2:40 PM',
      taskName: 'Lunch Break',
      duration: '90 minutes',
      category: 'Personal',
      varianceText: '+30m duration'
    },
    mismatchIcon: '⏰'
  },
  {
    isPerfectMatch: true,
    timeRange: '2:40 - 4:10 PM',
    taskName: 'Data Analysis',
    duration: '90 minutes',
    category: 'Work',
    varianceText: 'On schedule ✓'
  },
  {
    isMismatch: true,
    actual: {
      timeRange: '4:15 - 4:45 PM',
      taskName: 'Unexpected Call',
      duration: '30 minutes',
      category: 'Work',
      varianceText: 'Unplanned'
    },
    mismatchIcon: '+',
    noPlannedText: 'No planned task'
  },
  {
    isMismatch: true,
    planned: {
      timeRange: '5:00 - 5:30 PM',
      taskName: 'Quick Review',
      duration: '30 minutes',
      category: 'Work',
      varianceText: 'Skipped'
    },
    mismatchIcon: '✕',
    noActualText: 'Task skipped'
  }
])

// Insights
const insightsCollapsed = ref(false)
const insights = ref([
  {
    type: 'warning',
    icon: '⚠️',
    text: 'Presentation prep consistently takes 20% longer than estimated. Consider extending default time blocks.'
  },
  {
    type: 'warning',
    icon: '⏰',
    text: 'Lunch breaks tend to extend beyond planned duration. Factor in 30 extra minutes.'
  },
  {
    type: 'success',
    icon: '✓',
    text: 'Workout schedule perfectly maintained - great consistency!'
  },
  {
    type: 'info',
    icon: '💡',
    text: 'Leave 15-minute buffers between work tasks for unexpected interruptions.'
  }
])

const toggleInsights = () => {
  insightsCollapsed.value = !insightsCollapsed.value
}

// Auto-collapse insights after 10 seconds
let insightsTimeout: number | null = null
onMounted(() => {
  // Initialize selected date
  selectedDate.value = formatDisplayDate(currentDate.value)

  updateCurrentTimePosition()
  // Update current time every minute
  const interval = setInterval(updateCurrentTimePosition, 60000)

  // Auto-collapse insights
  insightsTimeout = window.setTimeout(() => {
    insightsCollapsed.value = true
  }, 10000)

  // Calculate stats from comparisons
  stats.value.totalTasks = comparisons.value.length
  stats.value.perfectMatch = comparisons.value.filter(c => c.isPerfectMatch).length
  stats.value.mismatched = comparisons.value.filter(c => c.isMismatch).length
  stats.value.timeVariance = '+45m' // Placeholder - would calculate from actual data

  onUnmounted(() => {
    clearInterval(interval)
    if (insightsTimeout) {
      clearTimeout(insightsTimeout)
    }
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

.date-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(245, 232, 216, 0.1);
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 4px;
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
  background: linear-gradient(45deg, rgba(245, 232, 216, 0.3) 50%, rgba(255, 111, 97, 0.3) 50%);
}

.unified-timeline {
  position: relative;
  padding-left: 80px;
  margin-bottom: 32px;
}

.time-axis {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 70px;
  border-right: 2px solid #444;
}

.time-marker {
  position: absolute;
  left: 0;
  width: 65px;
  text-align: right;
  font-size: 13px;
  color: #F5E8D8;
  font-weight: 600;
  transform: translateY(-8px);
  padding-right: 12px;
  opacity: 0.9;
}

.time-dot {
  position: absolute;
  right: -5px;
  top: -2px;
  width: 8px;
  height: 8px;
  background: #DAA520;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(218, 165, 32, 0.4);
}

.current-time-line {
  position: absolute;
  left: 68px;
  width: calc(100% - 68px);
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

.time-slot {
  position: relative;
  min-height: 80px;
  margin-bottom: 16px;
  border-left: 3px solid transparent;
}

.task-comparison {
  position: relative;
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.planned-task,
.actual-task {
  flex: 1;
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  border: 2px solid;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  min-height: 80px;
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
  top: -8px;
  left: 8px;
  background: #2A2A2A;
  color: #F5E8D8;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #F5E8D8;
}

.actual-task::before {
  content: 'ACTUAL';
  position: absolute;
  top: -8px;
  left: 8px;
  background: #2A1F1A;
  color: #FF6F61;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #FF6F61;
}

.task-perfect-match {
  flex: 1;
  background: linear-gradient(135deg, #1A2A1A 0%, #2A3A2A 100%);
  border: 2px solid #4CAF50;
  border-radius: 12px;
  padding: 16px;
  position: relative;
}

.task-perfect-match::before {
  content: 'PERFECT MATCH ✓';
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: #1A2A1A;
  color: #4CAF50;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #4CAF50;
}

.planned-task:hover,
.actual-task:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.task-time {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  margin-bottom: 8px;
  display: inline-block;
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
  font-size: 14px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 6px;
  line-height: 1.3;
}

.task-duration {
  font-size: 10px;
  color: #AAA;
  margin-bottom: 4px;
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

.variance-text {
  position: absolute;
  bottom: 4px;
  right: 8px;
  font-size: 10px;
  font-weight: 600;
  color: #FF4500;
  background: rgba(255, 69, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 69, 0, 0.3);
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
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 12px;
  font-style: italic;
}

.time-slot.major-mismatch {
  background: linear-gradient(90deg, transparent 0%, rgba(255, 69, 0, 0.1) 50%, transparent 100%);
  border-left-color: #FF4500;
  border-radius: 0 8px 8px 0;
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
</style>
