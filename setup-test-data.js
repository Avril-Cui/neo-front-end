/**
 * Test Data Setup Script for Jay's User Story
 *
 * This script sets up tasks, schedules, and sessions for the scenario where:
 * - Jay starts the day with a planned schedule
 * - Morning gets disrupted by ad-hoc meetings and interruptions
 * - By afternoon (5:30 PM), he needs to optimize remaining tasks
 */

const API_BASE_URL = 'http://localhost:8000'
const CURRENT_USER = 'Friday'

// Helper function to make API calls
async function apiCall(endpoint, body) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error || `API call failed: ${endpoint}`)
  }
  return data
}

// Get today's date at specific times
function getToday(hour, minute = 0) {
  const today = new Date()
  today.setHours(hour, minute, 0, 0)
  return today.getTime()
}

function getTodayISO(hour, minute = 0) {
  const today = new Date()
  today.setHours(hour, minute, 0, 0)
  return today.toISOString()
}

// Step 1: Clear existing data
async function clearAllData() {
  console.log('\n📝 Step 1: Clearing all existing data...\n')

  try {
    // Get all tasks
    const tasksResponse = await apiCall('/api/TaskCatalog/_getUserTasks', { owner: CURRENT_USER })
    const tasks = tasksResponse.taskTable || []

    // Delete each task
    for (const task of tasks) {
      console.log(`   Deleting task: ${task.taskName}`)
      await apiCall('/api/TaskCatalog/deleteTask', { owner: CURRENT_USER, taskId: task._id })
    }

    console.log(`   ✓ Deleted ${tasks.length} tasks`)
  } catch (error) {
    console.log('   No tasks to delete or error:', error.message)
  }

  console.log('   ✓ Data cleared successfully\n')
}

// Step 2: Create Jay's morning tasks (already happened)
async function createMorningTasks() {
  console.log('📝 Step 2: Creating morning tasks (already completed)...\n')

  const morningTasks = [
    {
      owner: CURRENT_USER,
      taskName: 'Team Standup',
      category: 'Meeting',
      duration: 30,
      priority: 2,
      splittable: false,
      note: 'Completed this morning'
    },
    {
      owner: CURRENT_USER,
      taskName: 'Email Review',
      category: 'Administrative',
      duration: 45,
      priority: 3,
      splittable: true,
      note: 'Completed - interrupted twice'
    },
  ]

  const createdTasks = []
  for (const taskData of morningTasks) {
    console.log(`   Creating: ${taskData.taskName}`)
    const response = await apiCall('/api/TaskCatalog/createTask', taskData)
    createdTasks.push(response.task)
  }

  console.log(`   ✓ Created ${createdTasks.length} morning tasks\n`)
  return createdTasks
}

// Step 3: Create planned schedule for the day
async function createPlannedSchedule(morningTasks) {
  console.log('📝 Step 3: Creating planned schedule for the day...\n')

  // Morning schedule (9 AM - 12 PM) - already happened
  const scheduleBlocks = [
    { start: getToday(9, 0), end: getToday(9, 30), tasks: [morningTasks[0]._id] }, // Team Standup
    { start: getToday(9, 30), end: getToday(10, 30), tasks: [morningTasks[1]._id] }, // Email Review
    { start: getToday(10, 30), end: getToday(12, 0), tasks: [] }, // Focus work (got interrupted)
  ]

  for (const block of scheduleBlocks) {
    for (const taskId of block.tasks) {
      console.log(`   Scheduling task at ${new Date(block.start).toLocaleTimeString()}`)
      await apiCall('/api/ScheduleTime/assignTimeBlock', {
        owner: CURRENT_USER,
        taskId: taskId,
        start: block.start,
        end: block.end
      })
    }
  }

  console.log('   ✓ Created planned schedule\n')
}

// Step 4: Create actual sessions (with interruptions)
async function createActualSessions(morningTasks) {
  console.log('📝 Step 4: Creating actual sessions (morning reality)...\n')

  // Session 1: Team Standup (went as planned)
  console.log('   Creating session: Team Standup')
  let sessionResp = await apiCall('/api/RoutineLog/createSession', {
    owner: CURRENT_USER,
    sessionName: 'Team Standup',
    linkedTaskId: morningTasks[0]._id
  })
  await apiCall('/api/RoutineLog/startSession', { owner: CURRENT_USER, session: sessionResp.session })
  // Simulate it ended
  await new Promise(resolve => setTimeout(resolve, 100))
  await apiCall('/api/RoutineLog/endSession', { owner: CURRENT_USER, session: sessionResp.session })

  // Session 2: Email Review (completed but took longer due to interruption)
  console.log('   Creating session: Email Review')
  sessionResp = await apiCall('/api/RoutineLog/createSession', {
    owner: CURRENT_USER,
    sessionName: 'Email Review',
    linkedTaskId: morningTasks[1]._id
  })
  await apiCall('/api/RoutineLog/startSession', { owner: CURRENT_USER, session: sessionResp.session })
  await new Promise(resolve => setTimeout(resolve, 100))
  await apiCall('/api/RoutineLog/endSession', { owner: CURRENT_USER, session: sessionResp.session })

  // Session 3: Ad-hoc meeting 1 (unplanned)
  console.log('   Creating session: Ad-hoc Client Call (unplanned)')
  sessionResp = await apiCall('/api/RoutineLog/createSession', {
    owner: CURRENT_USER,
    sessionName: 'Ad-hoc Client Call'
  })
  await apiCall('/api/RoutineLog/startSession', { owner: CURRENT_USER, session: sessionResp.session })
  await new Promise(resolve => setTimeout(resolve, 100))
  await apiCall('/api/RoutineLog/endSession', { owner: CURRENT_USER, session: sessionResp.session })

  // Session 4: Ad-hoc meeting 2 (ran long)
  console.log('   Creating session: Emergency Team Sync (ran long)')
  sessionResp = await apiCall('/api/RoutineLog/createSession', {
    owner: CURRENT_USER,
    sessionName: 'Emergency Team Sync - ran over'
  })
  await apiCall('/api/RoutineLog/startSession', { owner: CURRENT_USER, session: sessionResp.session })
  await new Promise(resolve => setTimeout(resolve, 100))
  await apiCall('/api/RoutineLog/endSession', { owner: CURRENT_USER, session: sessionResp.session })

  console.log('   ✓ Created actual sessions with interruptions\n')
}

// Step 5: Create remaining tasks for afternoon (these need to be scheduled)
async function createRemainingTasks() {
  console.log('📝 Step 5: Creating remaining tasks for the afternoon...\n')

  // Get deadline for tomorrow 5 PM
  const tomorrow5PM = new Date()
  tomorrow5PM.setDate(tomorrow5PM.getDate() + 1)
  tomorrow5PM.setHours(17, 0, 0, 0)

  // Get deadline for today 11:59 PM
  const todayEOD = new Date()
  todayEOD.setHours(23, 59, 0, 0)

  const remainingTasks = [
    {
      owner: CURRENT_USER,
      taskName: 'Write Product Spec',
      category: 'Focus Work',
      duration: 120, // 2 hours
      priority: 1, // Critical - has hard deadline
      splittable: true,
      deadline: todayEOD.toISOString(),
      note: 'Hard deadline - must finish today. Can be split across multiple sessions.'
    },
    {
      owner: CURRENT_USER,
      taskName: 'Team Sync',
      category: 'Meeting',
      duration: 30,
      priority: 2, // Important
      splittable: false,
      deadline: todayEOD.toISOString(),
    },
    {
      owner: CURRENT_USER,
      taskName: 'Review Customer Feedback',
      category: 'Focus Work',
      duration: 60,
      priority: 2, // Important
      splittable: true,
      deadline: tomorrow5PM.toISOString(),
    },
    {
      owner: CURRENT_USER,
      taskName: 'Update Roadmap',
      category: 'Planning',
      duration: 90,
      priority: 3, // Regular - can be pushed
      splittable: true,
      deadline: tomorrow5PM.toISOString(),
    },
    {
      owner: CURRENT_USER,
      taskName: 'Respond to Slack Messages',
      category: 'Administrative',
      duration: 30,
      priority: 3,
      splittable: true,
    },
    {
      owner: CURRENT_USER,
      taskName: 'Prepare Tomorrow\'s Presentation',
      category: 'Focus Work',
      duration: 75,
      priority: 2,
      splittable: true,
      deadline: tomorrow5PM.toISOString(),
    },
  ]

  const createdTasks = []
  for (const taskData of remainingTasks) {
    console.log(`   Creating: ${taskData.taskName} (Priority ${taskData.priority}, ${taskData.duration}min)`)
    const response = await apiCall('/api/TaskCatalog/createTask', taskData)
    createdTasks.push(response.task)
  }

  console.log(`   ✓ Created ${createdTasks.length} remaining tasks\n`)
  return createdTasks
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Setting up Test Data for Jay\'s User Story')
  console.log('  Scenario: Product Manager dealing with interruptions')
  console.log('═══════════════════════════════════════════════════════\n')

  try {
    await clearAllData()
    const morningTasks = await createMorningTasks()
    await createPlannedSchedule(morningTasks)
    await createActualSessions(morningTasks)
    const remainingTasks = await createRemainingTasks()

    console.log('═══════════════════════════════════════════════════════')
    console.log('  ✅ Setup Complete!')
    console.log('═══════════════════════════════════════════════════════\n')
    console.log('📊 Summary:')
    console.log(`   • Morning tasks completed: ${morningTasks.length}`)
    console.log(`   • Remaining tasks to schedule: ${remainingTasks.length}`)
    console.log(`   • Sessions logged: 4 (with interruptions)`)
    console.log('\n🎯 Next Steps:')
    console.log('   1. Open the app and go to the Today page')
    console.log('   2. View the Compare page to see deviations')
    console.log('   3. Click "Optimize Schedule" to see AI scheduling')
    console.log('   4. Check the Tasks page for any dropped tasks\n')

  } catch (error) {
    console.error('\n❌ Error during setup:', error.message)
    console.error(error)
    process.exit(1)
  }
}

main()
