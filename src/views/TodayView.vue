<script setup lang="ts">
import { ref } from 'vue'

// Sample data for demonstration
const stats = {
  totalTasks: 6,
  completed: 3,
  focusedTime: '4h 30m',
  progress: 75
}

const tasks = [
  {
    id: 1,
    timeStart: '9:00 AM',
    timeEnd: '10:30 AM',
    duration: 90,
    title: 'Morning Workout Session',
    category: 'Health & Fitness',
    priority: 'high',
    progress: 100,
    completed: true
  },
  {
    id: 2,
    timeStart: '11:00 AM',
    timeEnd: '12:30 PM',
    duration: 90,
    title: 'Client Presentation Preparation',
    category: 'Work',
    priority: 'medium',
    progress: 100,
    completed: true,
    breakBefore: 30
  },
  {
    id: 3,
    timeStart: '1:00 PM',
    timeEnd: '2:00 PM',
    duration: 60,
    title: 'Lunch & Rest',
    category: 'Personal',
    priority: 'low',
    progress: 100,
    completed: true
  },
  {
    id: 4,
    timeStart: '2:30 PM',
    timeEnd: '4:00 PM',
    duration: 90,
    title: 'Data Analysis & Review',
    category: 'Work',
    priority: 'high',
    progress: 35,
    completed: false,
    active: true
  },
  {
    id: 5,
    timeStart: '5:30 PM',
    timeEnd: '6:30 PM',
    duration: 60,
    title: 'Evening Study Session',
    category: 'Education',
    priority: 'medium',
    progress: 0,
    completed: false,
    breakBefore: 90
  }
]

const selectedDate = ref('Friday, September 27')
const activeView = ref('Today')

// Get current time
const currentTime = ref(new Date())
const getCurrentTimePosition = () => {
  const hours = currentTime.value.getHours()
  const minutes = currentTime.value.getMinutes()
  return hours * 100 + (minutes / 60) * 100
}

// Reference to timeline container for scrolling
const timelineContainerRef = ref<HTMLElement | null>(null)

// Scroll to current time on mount
import { onMounted } from 'vue'
onMounted(() => {
  if (timelineContainerRef.value) {
    const currentPos = getCurrentTimePosition()
    // Center the current time in the viewport
    timelineContainerRef.value.scrollTop = currentPos - 200
  }
})

// Generate 24-hour time markers
const timeMarkers = Array.from({ length: 24 }, (_, i) => {
  const hour = i
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const label = hour === 0 ? 'Midnight' : hour === 12 ? 'Noon' : `${displayHour} ${period}`
  return {
    hour,
    label,
    position: i * 100 // 100px per hour
  }
})

// Calculate task position based on time (in pixels from top)
const getTaskPosition = (timeString: string) => {
  // Parse time like "9:00 AM" or "2:30 PM"
  const match = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match || !match[1] || !match[2] || !match[3]) return 0

  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const period = match[3].toUpperCase()

  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  // Calculate position (100px per hour)
  return hours * 100 + (minutes / 60) * 100
}

// Calculate task height based on duration
const getTaskHeight = (duration: number) => {
  // duration in minutes, convert to pixels (100px per 60 minutes)
  return (duration / 60) * 100
}
</script>

<template>
  <div class="today-view">
    <div class="header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo">NEO</div>
          <div class="view-toggle">
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Today' }"
            >
              Today
            </button>
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Compare' }"
            >
              Compare
            </button>
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Analytics' }"
            >
              Analytics
            </button>
          </div>
        </div>
        <select class="date-selector" v-model="selectedDate">
          <option>Friday, September 27</option>
          <option>Saturday, September 28</option>
        </select>
      </div>
    </div>

    <div class="container">
      <div class="today-stats">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalTasks }}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.completed }}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.focusedTime }}</div>
          <div class="stat-label">Focused Time</div>
        </div>
        <div class="stat-card progress">
          <div class="stat-value">{{ stats.progress }}%</div>
          <div class="stat-label">Progress</div>
        </div>
      </div>

      <div class="timeline-wrapper" ref="timelineContainerRef">
        <div class="timeline-container">
          <div class="time-axis">
            <div
              v-for="marker in timeMarkers"
              :key="marker.hour"
              class="time-marker"
              :style="{ top: marker.position + 'px' }"
            >
              {{ marker.label }}
              <div class="time-dot"></div>
            </div>
          </div>

          <div class="timeline-content">
            <!-- Current time indicator -->
            <div
              class="current-time-indicator"
              :style="{ top: getCurrentTimePosition() + 'px' }"
            ></div>

            <div
              v-for="task in tasks"
              :key="task.id"
              class="task-card"
              :class="[
                `${task.priority}-priority`,
                { active: task.active, completed: task.completed, 'glow-effect': task.active }
              ]"
              :style="{
                top: getTaskPosition(task.timeStart) + 'px',
                height: getTaskHeight(task.duration) + 'px'
              }"
            >
              <div class="task-header">
                <div class="task-time">{{ task.timeStart }} - {{ task.timeEnd }}</div>
                <div class="task-duration">{{ task.duration }} min</div>
              </div>
              <div class="task-title">{{ task.title }}</div>
              <div class="task-meta">
                <div class="task-type">{{ task.category }}</div>
                <div class="priority-badge">{{ task.priority }}</div>
              </div>
              <div class="task-progress">
                <div class="task-progress-bar" :style="{ width: task.progress + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <button class="add-button">+</button>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.today-view {
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

.date-selector {
  background: rgba(245, 232, 216, 0.1);
  border: 1px solid rgba(245, 232, 216, 0.2);
  color: #F5E8D8;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}

.date-selector:hover {
  background: rgba(245, 232, 216, 0.15);
  border-color: rgba(245, 232, 216, 0.3);
}

.container {
  width: 100%;
  margin: 0 auto;
  padding: 32px 40px 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.today-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 180px));
  gap: 20px;
  margin-bottom: 40px;
  justify-content: center;
}

.stat-card {
  background: #2a2a2a;
  border-radius: 12px;
  padding: 24px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid #3a3a3a;
  text-align: center;
  min-width: 140px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 11px;
  color: #AAA;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 500;
}

.stat-card.progress {
  border-color: #FF6F61;
  background: #2a2a2a;
}

.stat-card.progress .stat-value {
  color: #FF6F61;
}

.timeline-wrapper {
  position: relative;
  width: 100vw;
  height: calc(100vh - 350px);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
  margin-left: calc(-50vw + 50%);
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

.timeline-container {
  position: relative;
  padding-left: 100px;
  width: 600px;
  min-height: 2400px;
}

.timeline-content {
  position: relative;
  width: 100%;
  min-height: 2400px;
}

.time-axis {
  position: absolute;
  left: 0;
  top: 0;
  height: 2400px;
  width: 90px;
  border-right: 1px solid #333;
}

.time-marker {
  position: absolute;
  left: 0;
  width: 85px;
  text-align: right;
  font-size: 11px;
  color: #888;
  font-weight: 500;
  transform: translateY(-8px);
  padding-right: 12px;
}

.time-dot {
  position: absolute;
  right: -3px;
  top: -1px;
  width: 4px;
  height: 4px;
  background: #555;
  border-radius: 50%;
}

.current-time-indicator {
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background: #FF4500;
  z-index: 10;
  pointer-events: none;
}

.current-time-indicator::before {
  content: '';
  position: absolute;
  left: -6px;
  top: -4px;
  width: 10px;
  height: 10px;
  background: #FF4500;
  border-radius: 50%;
  border: 2px solid #1a1a1a;
}

.task-card {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid #3a3a3a;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 80px;
}

.task-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: var(--priority-color);
}

.task-card.high-priority {
  --priority-color: linear-gradient(180deg, #FF4500 0%, #FF6F61 100%);
}

.task-card.medium-priority {
  --priority-color: linear-gradient(180deg, #DAA520 0%, #FFD700 100%);
}

.task-card.low-priority {
  --priority-color: linear-gradient(180deg, #F5E8D8 0%, #E5D5C8 100%);
}

.task-card.active {
  --priority-color: linear-gradient(180deg, #FF6F61 0%, #FF4500 100%);
  background: #352a26;
  border-color: #FF6F61;
  box-shadow: 0 4px 16px rgba(255, 111, 97, 0.2);
  transform: translateX(4px);
}

.task-card:hover {
  transform: translateX(6px) translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  border-color: #555;
}

.task-card.completed {
  opacity: 0.6;
  background: #252a25;
  border-color: #3a3a3a;
}

.task-card.completed .task-title {
  text-decoration: line-through;
  color: #AAA;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.task-time {
  font-size: 11px;
  color: #888;
  font-weight: 500;
  background: rgba(245, 232, 216, 0.05);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(245, 232, 216, 0.1);
  white-space: nowrap;
}

.task-duration {
  font-size: 10px;
  color: #888;
  background: rgba(218, 165, 32, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
  border: 1px solid rgba(218, 165, 32, 0.2);
  white-space: nowrap;
}

.task-title {
  font-size: 15px;
  font-weight: 600;
  color: #F5E8D8;
  margin-bottom: 8px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  margin-top: auto;
}

.task-type {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.priority-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.high-priority .priority-badge {
  background: rgba(255, 69, 0, 0.2);
  color: #FF6F61;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.medium-priority .priority-badge {
  background: rgba(218, 165, 32, 0.2);
  color: #DAA520;
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.low-priority .priority-badge {
  background: rgba(245, 232, 216, 0.1);
  color: #F5E8D8;
  border: 1px solid rgba(245, 232, 216, 0.2);
}

.task-progress {
  width: 100%;
  height: 4px;
  background: rgba(245, 232, 216, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 0;
}

.task-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #FF6F61 0%, #FF4500 100%);
  border-radius: 3px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 0 8px rgba(255, 111, 97, 0.3);
}

.task-progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 20px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 100%);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-20px); }
  100% { transform: translateX(20px); }
}

.add-button {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #FF6F61 0%, #FF4500 100%);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(255, 111, 97, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-button:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 40px rgba(255, 111, 97, 0.6);
}

.add-button:active {
  transform: scale(0.95);
}

.glow-effect {
  box-shadow: 0 0 20px rgba(255, 111, 97, 0.3);
}
</style>
