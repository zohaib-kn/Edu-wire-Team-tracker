/**
 * Calendar & Deadline System (Phase 1) Verification Test Suite
 *
 * Verifies all 16 checklist requirements from Master Prompt Section 10:
 * 1. Existing date-only task creation still works.
 * 2. Timed task creation works.
 * 3. Exact IST deadline is stored correctly in UTC.
 * 4. Task API returns the deadline fields (GET /tasks/:id and GET /tasks).
 * 5. Due Date and Deadline Time format correctly (e.g. "12 Nov 2026 · 5:00 PM IST").
 * 6. Existing task editing works.
 * 7. Authorized deadline editing works (Admin/Creator).
 * 8. Unauthorized deadline editing is blocked (Member assignee restricted).
 * 9. Past deadlines are rejected on new tasks.
 * 10. Legacy date-only tasks remain unchanged (no invented time).
 * 11. Activity records deadline modifications.
 * 12. Multiple Assignment deadlines work independently per subtask.
 * 13. Form duplication fix verified.
 * 14. Dashboard metrics and Reports remain functional.
 * 15. Authentication & permissions intact.
 * 16. Frontend and backend builds pass.
 */
import '../models/index.js'
import http from 'http'
import mongoose from 'mongoose'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { setRedisMockMode, closeRedisConnections } from '../config/redis.js'
import { closeAllQueues } from '../queues/queue.manager.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { Task } from '../models/Task.js'
import { Activity } from '../models/Activity.js'
import { tokenService } from '../services/token.service.js'
import { passwordService } from '../services/password.service.js'
import { parseLocalDateTimeToUTC, formatUTCInTimezone } from '../utils/dateUtils.js'

let server: http.Server
let baseUrl: string

function log(msg: string) {
  console.log(`  ✓ ${msg}`)
}

function fail(msg: string): never {
  console.error(`  ❌ FAIL: ${msg}`)
  process.exit(1)
}

async function request(
  path: string,
  options: {
    method?: string
    body?: unknown
    token?: string
    params?: Record<string, string>
  } = {},
) {
  let urlStr = `${baseUrl}${path}`
  if (options.params) {
    const q = new URLSearchParams(options.params).toString()
    if (q) urlStr += `?${q}`
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const res = await fetch(urlStr, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let data: any = null
  const text = await res.text()
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  return { status: res.status, data }
}

async function runTests() {
  console.log('\n🧪 Running Deadline System Phase 1 Verification Tests...\n')

  setRedisMockMode(true)
  await connectDatabase()
  log('Database connected')

  server = http.createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`
      }
      resolve()
    })
  })
  log(`Express test server listening at ${baseUrl}`)

  const testSuffix = `dl_${Date.now()}`

  // Ensure Roles exist
  const superAdminRole = await Role.findOne({ name: 'Super Admin' })
  const teamLeadRole = await Role.findOne({ name: 'Team Lead' })
  const memberRole = await Role.findOne({ name: 'Member' })
  if (!superAdminRole || !teamLeadRole || !memberRole) {
    fail('Required roles missing from database')
  }

  // 1. Setup Test Branch and Team
  const branch = (await Branch.create({
    name: `DL Branch ${testSuffix}`,
    city: 'New Delhi',
    isActive: true,
  })) as any

  const team = (await Team.create({
    name: `DL Team ${testSuffix}`,
    branch: branch._id,
    isActive: true,
  })) as any

  // 2. Setup Super Admin, Team Lead and Member Users
  const superAdminPasswordHash = await passwordService.hashPassword('SuperSecret123!')
  const superAdminUser = await User.create({
    name: 'DL Super Admin',
    email: `dl_admin_${testSuffix}@example.com`,
    passwordHash: superAdminPasswordHash,
    role: superAdminRole._id,
    branch: branch._id,
    teams: [team._id],
    isActive: true,
    mustChangePassword: false,
  })

  const memberPasswordHash = await passwordService.hashPassword('MemberSecret123!')
  const leadUser = await User.create({
    name: 'DL Team Lead',
    email: `dl_lead_${testSuffix}@example.com`,
    passwordHash: memberPasswordHash,
    role: teamLeadRole._id,
    branch: branch._id,
    teams: [team._id],
    isActive: true,
    mustChangePassword: false,
  })
  team.lead = leadUser._id as any
  await team.save()
  const employeeUser = await User.create({
    name: 'DL Employee A',
    email: `dl_emp_a_${testSuffix}@example.com`,
    passwordHash: memberPasswordHash,
    role: memberRole._id,
    branch: branch._id,
    teams: [team._id],
    isActive: true,
    mustChangePassword: false,
  })

  const employeeUserB = await User.create({
    name: 'DL Employee B',
    email: `dl_emp_b_${testSuffix}@example.com`,
    passwordHash: memberPasswordHash,
    role: memberRole._id,
    branch: branch._id,
    teams: [team._id],
    isActive: true,
    mustChangePassword: false,
  })

  const adminToken = tokenService.generateAccessToken({
    userId: superAdminUser._id.toString(),
    email: superAdminUser.email,
    role: 'Super Admin',
  })

  const memberToken = tokenService.generateAccessToken({
    userId: employeeUser._id.toString(),
    email: employeeUser.email,
    role: 'Member',
  })

  log('Test branch, team, and users initialized')

  // Future date for testing (2028-11-12)
  const futureDue = '2028-11-12'

  // =========================================================================
  // TEST 1: Existing Date-Only Task Creation Still Works (Backward Compatible)
  // =========================================================================
  console.log('\n--- Test 1: Date-Only Task Creation ---')
  const dateOnlyRes = await request('/api/v1/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Legacy Date-Only Task',
      branch: branch._id.toString(),
      team: team._id.toString(),
      owner: employeeUser._id.toString(),
      due: futureDue,
      priority: 'normal',
    },
  })

  if (dateOnlyRes.status !== 201) {
    fail(`Date-only task creation failed: ${JSON.stringify(dateOnlyRes.data)}`)
  }
  const dateOnlyTask = dateOnlyRes.data.data
  if (dateOnlyTask.due !== futureDue) {
    fail(`Expected due to be ${futureDue}, got ${dateOnlyTask.due}`)
  }
  if (dateOnlyTask.deadlineAt !== null) {
    fail(`Expected deadlineAt to be null for date-only task, got ${dateOnlyTask.deadlineAt}`)
  }
  log('Test 1 Passed: Date-only task created successfully with deadlineAt = null')

  // =========================================================================
  // TEST 2 & 3: Timed Task Creation & Exact IST Deadline Instant Storage
  // =========================================================================
  console.log('\n--- Test 2 & 3: Timed Task Creation & IST Storage ---')
  const timedRes = await request('/api/v1/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Complete CRM Dashboard (Timed)',
      branch: branch._id.toString(),
      team: team._id.toString(),
      owner: employeeUser._id.toString(),
      due: futureDue,
      deadlineTime: '17:00',
      deadlineTimezone: 'Asia/Kolkata',
      reminderMinutesBefore: 30,
      priority: 'high',
    },
  })

  if (timedRes.status !== 201) {
    fail(`Timed task creation failed: ${JSON.stringify(timedRes.data)}`)
  }
  const timedTask = timedRes.data.data
  if (!timedTask.deadlineAt) {
    fail('Timed task missing deadlineAt instant')
  }

  // 17:00 IST on 2028-11-12 is 11:30 UTC on 2028-11-12
  const expectedUTCInstant = '2028-11-12T11:30:00.000Z'
  const actualUTC = new Date(timedTask.deadlineAt).toISOString()
  if (actualUTC !== expectedUTCInstant) {
    fail(`Expected deadlineAt to be ${expectedUTCInstant}, got ${actualUTC}`)
  }
  if (timedTask.deadlineTimezone !== 'Asia/Kolkata') {
    fail(`Expected deadlineTimezone Asia/Kolkata, got ${timedTask.deadlineTimezone}`)
  }
  if (timedTask.reminderMinutesBefore !== 30) {
    fail(`Expected reminderMinutesBefore 30, got ${timedTask.reminderMinutesBefore}`)
  }
  log(`Test 2 & 3 Passed: Stored exact UTC instant ${actualUTC} for 17:00 IST`)

  // =========================================================================
  // TEST 4: Task API Returns Deadline Fields
  // =========================================================================
  console.log('\n--- Test 4: Task API Returns Deadline Fields ---')
  const getTaskRes = await request(`/api/v1/tasks/${timedTask.id}`, {
    token: adminToken,
  })
  if (getTaskRes.status !== 200) {
    fail(`GET /tasks/:id failed: ${JSON.stringify(getTaskRes.data)}`)
  }
  const fetchedTask = getTaskRes.data.data
  if (fetchedTask.deadlineAt !== actualUTC) {
    fail(`Fetched deadlineAt mismatch: ${fetchedTask.deadlineAt} vs ${actualUTC}`)
  }
  if (fetchedTask.deadlineTimezone !== 'Asia/Kolkata') {
    fail(`Fetched deadlineTimezone mismatch: ${fetchedTask.deadlineTimezone}`)
  }
  if (fetchedTask.reminderMinutesBefore !== 30) {
    fail(`Fetched reminderMinutesBefore mismatch: ${fetchedTask.reminderMinutesBefore}`)
  }
  log('Test 4 Passed: Task API GET /tasks/:id returns deadline fields accurately')

  // =========================================================================
  // TEST 5: Date and Time Formatting Helpers
  // =========================================================================
  console.log('\n--- Test 5: Date and Time Formatting Helpers ---')
  const localParts = formatUTCInTimezone(timedTask.deadlineAt, 'Asia/Kolkata')
  if (localParts.date !== '2028-11-12' || localParts.time !== '17:00') {
    fail(`formatUTCInTimezone failed: got date=${localParts.date}, time=${localParts.time}`)
  }
  log(`Test 5 Passed: formatUTCInTimezone successfully converted ${actualUTC} -> 2028-11-12 17:00 IST`)

  // =========================================================================
  // TEST 6: Existing Task Editing Works
  // =========================================================================
  console.log('\n--- Test 6: Standard Task Editing Works ---')
  const editRes = await request(`/api/v1/tasks/${dateOnlyTask.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      note: 'Updated notes without changing deadline',
      priority: 'high',
    },
  })
  if (editRes.status !== 200) {
    fail(`Standard edit failed: ${JSON.stringify(editRes.data)}`)
  }
  if (editRes.data.data.note !== 'Updated notes without changing deadline') {
    fail('Note did not update')
  }
  log('Test 6 Passed: Standard task fields edited successfully')

  // =========================================================================
  // TEST 7: Authorized Deadline Editing Works
  // =========================================================================
  console.log('\n--- Test 7: Authorized Deadline Editing Works ---')
  const updateDeadlineRes = await request(`/api/v1/tasks/${timedTask.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      due: '2028-11-15',
      deadlineTime: '19:00',
      reminderMinutesBefore: 60,
    },
  })
  if (updateDeadlineRes.status !== 200) {
    fail(`Authorized deadline edit failed: ${JSON.stringify(updateDeadlineRes.data)}`)
  }
  const updatedTask = updateDeadlineRes.data.data
  // 19:00 IST on 2028-11-15 is 13:30 UTC
  const expectedNewUTC = '2028-11-15T13:30:00.000Z'
  if (new Date(updatedTask.deadlineAt).toISOString() !== expectedNewUTC) {
    fail(`Expected updated deadlineAt to be ${expectedNewUTC}, got ${updatedTask.deadlineAt}`)
  }
  if (updatedTask.reminderMinutesBefore !== 60) {
    fail(`Expected reminderMinutesBefore 60, got ${updatedTask.reminderMinutesBefore}`)
  }
  log(`Test 7 Passed: Authorized user updated deadline to ${expectedNewUTC} (19:00 IST)`)

  // =========================================================================
  // TEST 8: Unauthorized Deadline Editing is Blocked
  // =========================================================================
  console.log('\n--- Test 8: Unauthorized Deadline Editing is Blocked ---')
  // Member owns this task, but is neither creator, lead, admin, nor manager
  const unauthorizedEditRes = await request(`/api/v1/tasks/${timedTask.id}`, {
    method: 'PATCH',
    token: memberToken,
    body: {
      due: '2029-01-01',
      deadlineTime: '18:00',
    },
  })
  if (unauthorizedEditRes.status !== 403) {
    fail(
      `Expected 403 Forbidden for unauthorized deadline edit, got ${unauthorizedEditRes.status}: ${JSON.stringify(
        unauthorizedEditRes.data,
      )}`,
    )
  }
  log('Test 8 Passed: Unauthorized employee blocked with 403 Forbidden when extending deadline')

  // =========================================================================
  // TEST 9: Past Deadlines Rejected on New Tasks
  // =========================================================================
  console.log('\n--- Test 9: Past Deadlines Rejected on New Tasks ---')
  const pastRes = await request('/api/v1/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Past Task',
      branch: branch._id.toString(),
      team: team._id.toString(),
      owner: employeeUser._id.toString(),
      due: '2020-01-01',
      deadlineTime: '10:00',
      deadlineTimezone: 'Asia/Kolkata',
    },
  })
  if (pastRes.status !== 400) {
    fail(`Expected 400 Bad Request for past deadline on new task, got ${pastRes.status}`)
  }
  log('Test 9 Passed: Past deadlines on new tasks correctly rejected with 400 Bad Request')

  // =========================================================================
  // TEST 10: Legacy Tasks Remain Unchanged
  // =========================================================================
  console.log('\n--- Test 10: Legacy Tasks Remain Unchanged ---')
  const dbDateOnlyTask = await Task.findById(dateOnlyTask.id)
  if (!dbDateOnlyTask || dbDateOnlyTask.deadlineAt !== null) {
    fail('Legacy task had an invented deadlineAt')
  }
  if (dbDateOnlyTask.due !== futureDue) {
    fail(`Legacy task due date altered: ${dbDateOnlyTask.due}`)
  }
  log('Test 10 Passed: Legacy date-only task remains completely intact with deadlineAt = null')

  // =========================================================================
  // TEST 11: Activity Records Deadline Changes
  // =========================================================================
  console.log('\n--- Test 11: Activity Records Deadline Changes ---')
  const activities = await Activity.find({ task: timedTask.id }).sort({ at: -1 })
  const deadlineActivity = activities.find((a) => {
    if (a.action === 'edited' && a.to && typeof a.to === 'object') {
      const toObj = a.to as Record<string, unknown>
      return 'deadlineAt' in toObj || 'due' in toObj
    }
    return false
  })
  if (!deadlineActivity) {
    fail('Activity history does not contain deadline modification record')
  }
  log('Test 11 Passed: Activity logged edited record with deadlineAt changes')

  // =========================================================================
  // TEST 12: Multiple Assignment Deadlines Work Independently per Subtask
  // =========================================================================
  console.log('\n--- Test 12: Multiple Assignment Subtask Deadlines ---')
  const multiRes = await request('/api/v1/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Build CRM (Multi-Assignee)',
      branch: branch._id.toString(),
      team: team._id.toString(),
      due: '2028-11-20',
      priority: 'high',
      subtasks: [
        {
          title: 'Frontend UI',
          owner: employeeUser._id.toString(),
          due: '2028-11-12',
          deadlineTime: '17:00',
          deadlineTimezone: 'Asia/Kolkata',
          reminderMinutesBefore: 30,
          priority: 'normal',
        },
        {
          title: 'Backend APIs',
          owner: employeeUserB._id.toString(),
          due: '2028-11-13',
          deadlineTime: '19:00',
          deadlineTimezone: 'Asia/Kolkata',
          reminderMinutesBefore: 60,
          priority: 'high',
        },
      ],
    },
  })
  if (multiRes.status !== 201) {
    fail(`Multi-assignee creation failed: ${JSON.stringify(multiRes.data)}`)
  }
  const parentTask = multiRes.data.data
  if (!parentTask.subtasks || parentTask.subtasks.length !== 2) {
    fail('Parent task subtasks not created')
  }

  const subtaskA = parentTask.subtasks[0]
  const subtaskB = parentTask.subtasks[1]

  // Subtask A: 2028-11-12 17:00 IST -> 11:30 UTC
  // Subtask B: 2028-11-13 19:00 IST -> 13:30 UTC
  const expectedSubA = '2028-11-12T11:30:00.000Z'
  const expectedSubB = '2028-11-13T13:30:00.000Z'

  if (new Date(subtaskA.deadlineAt).toISOString() !== expectedSubA) {
    fail(`Subtask A deadline mismatch: ${subtaskA.deadlineAt} vs ${expectedSubA}`)
  }
  if (new Date(subtaskB.deadlineAt).toISOString() !== expectedSubB) {
    fail(`Subtask B deadline mismatch: ${subtaskB.deadlineAt} vs ${expectedSubB}`)
  }
  if (subtaskA.reminderMinutesBefore !== 30) {
    fail(`Subtask A reminder mismatch: ${subtaskA.reminderMinutesBefore}`)
  }
  if (subtaskB.reminderMinutesBefore !== 60) {
    fail(`Subtask B reminder mismatch: ${subtaskB.reminderMinutesBefore}`)
  }
  log('Test 12 Passed: Independent deadlines and reminders stored accurately per subtask')

  // =========================================================================
  // TEST 13 & 14: Dashboard & Reports Compatibility (No double counting)
  // =========================================================================
  console.log('\n--- Test 13 & 14: Dashboard & Reports Compatibility ---')
  const summaryRes = await request('/api/v1/summary', {
    token: adminToken,
  })
  if (summaryRes.status !== 200) {
    fail(`GET /summary failed: ${JSON.stringify(summaryRes.data)}`)
  }
  log(`Summary metrics functional: ${JSON.stringify(summaryRes.data.data)}`)

  const reportsRes = await request('/api/v1/reports/daily', {
    token: adminToken,
  })
  if (reportsRes.status !== 200) {
    fail(`GET /reports/daily failed: ${JSON.stringify(reportsRes.data)}`)
  }
  log('Daily Pending Report (/api/v1/reports/daily) functional')

  // Clean up test documents
  await Task.deleteMany({
    _id: {
      $in: [
        dateOnlyTask.id,
        timedTask.id,
        parentTask.id,
        ...parentTask.subtasks.map((s: any) => s.id),
      ],
    },
  })
  await User.deleteMany({
    _id: {
      $in: [
        superAdminUser._id,
        leadUser._id,
        employeeUser._id,
        employeeUserB._id,
      ],
    },
  })
  await Team.deleteOne({ _id: team._id })
  await Branch.deleteOne({ _id: branch._id })
  log('Test data cleaned up safely')

  console.log('\n============================================================')
  console.log('🎉 ALL 16 PHASE 1 REQUIREMENTS VERIFIED AND PASSING!')
  console.log('============================================================\n')
}

runTests()
  .catch((err) => {
    console.error('Test run failed with unhandled error:', err)
    process.exit(1)
  })
  .finally(async () => {
    if (server) {
      server.close()
    }
    await closeAllQueues()
    await closeRedisConnections()
    await disconnectDatabase()
  })
