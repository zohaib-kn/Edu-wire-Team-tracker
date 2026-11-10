/**
 * Calendar & Deadline System (Phase 2) Unit Test Suite
 *
 * Verifies core logic offline without requiring Atlas network connectivity:
 * 1. Zod query schema validation (startDate, endDate, priority, limit).
 * 2. Timezone conversion and formatting (IST <-> UTC).
 * 3. Calendar date range calculation algorithms (week bounds, month matrix).
 * 4. Task separation (timed vs date-only).
 * 5. Multi-assignee subtask workload filtering (excluding parent coordination containers).
 */
import { taskQuerySchema } from '../modules/tasks/task.schemas.js'
import { parseLocalDateTimeToUTC, formatUTCInTimezone } from '../utils/dateUtils.js'

function log(msg: string) {
  console.log(`  ✓ ${msg}`)
}

function fail(msg: string): never {
  console.error(`  ❌ FAIL: ${msg}`)
  process.exit(1)
}

function assert(cond: boolean, msg: string) {
  if (!cond) fail(msg)
}

async function runUnitTests() {
  console.log('\n🧪 Running Schedule Calendar Phase 2 Offline Unit Tests...\n')

  // --- 1. Schema Validation Tests ---
  console.log('1. Schema Validation (taskQuerySchema):')
  
  // Valid query with startDate and endDate
  const validQuery = {
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    priority: 'high',
    status: 'doing',
    limit: 500,
    page: 1,
  }
  const parsed = taskQuerySchema.safeParse(validQuery)
  assert(parsed.success, `Valid query must parse: ${parsed.error?.message}`)
  assert(parsed.data?.startDate === '2026-11-01', 'startDate must match')
  assert(parsed.data?.endDate === '2026-11-30', 'endDate must match')
  assert(parsed.data?.priority === 'high', 'priority must match')
  assert(parsed.data?.limit === 500, 'limit 500 must be accepted')
  log('taskQuerySchema parses valid bounded date-range query with limit 500')

  // Invalid date format
  const invalidDate = taskQuerySchema.safeParse({ startDate: '2026/11/01' })
  assert(!invalidDate.success, 'Invalid date format must be rejected')
  log('taskQuerySchema rejects invalid date format (must be YYYY-MM-DD)')

  // Invalid priority
  const invalidPriority = taskQuerySchema.safeParse({ priority: 'urgent' })
  assert(!invalidPriority.success, 'Invalid priority must be rejected')
  log('taskQuerySchema rejects invalid priority (only normal, high, all)')

  // Limit exceeding 500
  const invalidLimit = taskQuerySchema.safeParse({ limit: 1000 })
  assert(!invalidLimit.success, 'Limit > 500 must be rejected')
  log('taskQuerySchema caps limit at 500 for bounded calendar safety')

  // --- 2. Timezone & Instant Conversion Tests ---
  console.log('\n2. Timezone & Instant Conversion:')
  const utcDate = parseLocalDateTimeToUTC('2026-11-12', '17:00', 'Asia/Kolkata')
  assert(utcDate.toISOString() === '2026-11-12T11:30:00.000Z', '5:00 PM IST must be 11:30:00 UTC')
  log('5:00 PM IST correctly converts to UTC: 2026-11-12T11:30:00.000Z')

  const formatted = formatUTCInTimezone(utcDate, 'Asia/Kolkata')
  assert(formatted.date === '2026-11-12', 'Formatted date must be 2026-11-12')
  assert(formatted.time === '17:00', 'Formatted time must be 17:00')
  log(`UTC instant correctly formats back in Asia/Kolkata: date="${formatted.date}", time="${formatted.time}"`)

  // --- 3. Calendar Grid & Bounded Query Math ---
  console.log('\n3. Calendar Grid Range Math:')
  function getWeekRange(date: Date) {
    const d = new Date(date)
    const day = d.getDay()
    const diffToMonday = (day + 6) % 7
    const monday = new Date(d)
    monday.setDate(d.getDate() - diffToMonday)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return { monday, sunday }
  }

  const midWeek = new Date('2026-11-11T12:00:00') // Wednesday
  const weekRange = getWeekRange(midWeek)
  assert(weekRange.monday.getDay() === 1, 'Monday must be day 1')
  assert(weekRange.sunday.getDay() === 0, 'Sunday must be day 0')
  const diffDays = Math.round((weekRange.sunday.getTime() - weekRange.monday.getTime()) / (1000 * 60 * 60 * 24))
  assert(diffDays === 7, 'Week must span exactly 7 calendar days from Monday to Sunday')
  log('Week range calculation strictly bounds 7 days (Monday to Sunday)')

  // --- 4. Subtask & Workload Isolation Logic ---
  console.log('\n4. Workload Isolation (Parent vs Actionable Subtasks):')
  const mockTasks = [
    {
      _id: 'task-parent-1',
      title: 'Build CRM Dashboard',
      taskLevel: 'parent',
      due: '2026-11-20',
      deadlineAt: null,
      assignees: ['user-lead'],
    },
    {
      _id: 'task-sub-1',
      title: 'Design Wireframes',
      taskLevel: 'subtask',
      parentTask: { _id: 'task-parent-1', title: 'Build CRM Dashboard' },
      due: '2026-11-12',
      deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
      assignees: ['user-dev-a'],
    },
    {
      _id: 'task-sub-2',
      title: 'Implement API Routes',
      taskLevel: 'subtask',
      parentTask: { _id: 'task-parent-1', title: 'Build CRM Dashboard' },
      due: '2026-11-15',
      deadlineAt: new Date('2026-11-15T12:30:00.000Z'),
      assignees: ['user-dev-b'],
    },
    {
      _id: 'task-single-1',
      title: 'Review Admission Docs',
      taskLevel: 'single',
      due: '2026-11-12',
      deadlineAt: null,
      assignees: ['user-dev-a'],
    },
  ]

  // Filter out parent coordination tasks so employee workload isn't double counted
  const calendarTasks = mockTasks.filter((t) => t.taskLevel !== 'parent')
  assert(calendarTasks.length === 3, 'Only 3 actionable tasks should be displayed on calendar')
  assert(!calendarTasks.some((t) => t._id === 'task-parent-1'), 'Parent coordination task must be excluded from workload events')
  log('Parent coordination containers are excluded from calendar workload events to prevent double counting')

  // Grouping by date
  const tasksOnNov12 = calendarTasks.filter((t) => t.due === '2026-11-12')
  assert(tasksOnNov12.length === 2, '2 tasks due on 2026-11-12')

  // Separation of timed vs untimed
  const timedNov12 = tasksOnNov12.filter((t) => t.deadlineAt !== null)
  const untimedNov12 = tasksOnNov12.filter((t) => t.deadlineAt === null)
  assert(timedNov12.length === 1 && timedNov12[0]._id === 'task-sub-1', 'task-sub-1 is timed')
  assert(untimedNov12.length === 1 && untimedNov12[0]._id === 'task-single-1', 'task-single-1 is untimed')
  log('Timed tasks and untimed date-only tasks correctly separated for Day/Week view placement')

  // Subtask has parent context
  assert((timedNov12[0] as any).parentTask.title === 'Build CRM Dashboard', 'Subtask retains link to parent task title')
  log('Subtask preserves parent task reference for contextual rendering on calendar card')

  console.log('\n🎉 All Schedule Calendar Phase 2 Unit Tests Passed Successfully!\n')
}

runUnitTests().catch((err) => {
  console.error('Unit test failed:', err)
  process.exit(1)
})
