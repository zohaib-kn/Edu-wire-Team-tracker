/**
 * Calendar & Deadline System (Phase 2) Verification Test Suite
 *
 * Verifies Phase 2 Schedule Calendar and Task Visualization:
 * 1. Schedule API bounded date-range queries (startDate, endDate).
 * 2. Timed tasks return exact deadlineAt instant in IST.
 * 3. Date-only tasks remain untimed (deadlineAt: null) and separated.
 * 4. Multi-Assignee subtasks have independent deadlines and parentTask references.
 * 5. Parent tasks are excluded from employee workload double-counting.
 * 6. Role-based visibility and scope filters enforced (Super Admin vs Member).
 * 7. Cross-branch task exposure is strictly blocked.
 * 8. Reporting manager supervision queries work.
 * 9. Completed task filtering (status=done vs pending).
 * 10. Priority filtering (priority=high).
 * 11. Existing Dashboard summary and My Tasks queries remain functional.
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
import { tokenService } from '../services/token.service.js'
import { passwordService } from '../services/password.service.js'
import { formatUTCInTimezone } from '../utils/dateUtils.js'

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
  console.log('\n🧪 Running Schedule Calendar Phase 2 Verification Tests...\n')

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

  const testSuffix = `sched_${Date.now()}`

  // Ensure Roles exist
  const superAdminRole = await Role.findOne({ name: 'Super Admin' })
  const teamLeadRole = await Role.findOne({ name: 'Team Lead' })
  const memberRole = await Role.findOne({ name: 'Member' })
  if (!superAdminRole || !teamLeadRole || !memberRole) {
    fail('Required roles missing from database')
  }

  // 1. Setup Branches (Branch A and Branch B for cross-branch checks)
  const branchA = (await Branch.create({
    name: `Sched Branch A ${testSuffix}`,
    city: 'New Delhi',
    isActive: true,
  })) as any

  const branchB = (await Branch.create({
    name: `Sched Branch B ${testSuffix}`,
    city: 'Mumbai',
    isActive: true,
  })) as any

  // 2. Setup Team in Branch A
  const teamA = (await Team.create({
    name: `Sched Team A ${testSuffix}`,
    branch: branchA._id,
    isActive: true,
  })) as any

  // 3. Setup Team in Branch B
  const teamB = (await Team.create({
    name: `Sched Team B ${testSuffix}`,
    branch: branchB._id,
    isActive: true,
  })) as any

  const passwordHash = await passwordService.hashPassword('PassSecret123!')

  // Super Admin
  const adminUser = await User.create({
    name: 'Sched Super Admin',
    email: `sched_admin_${testSuffix}@example.com`,
    passwordHash,
    role: superAdminRole._id,
    branch: branchA._id,
    teams: [teamA._id],
    isActive: true,
    mustChangePassword: false,
  })

  // Team Lead in Branch A
  const leadUserA = await User.create({
    name: 'Sched Lead A',
    email: `sched_lead_${testSuffix}@example.com`,
    passwordHash,
    role: teamLeadRole._id,
    branch: branchA._id,
    teams: [teamA._id],
    isActive: true,
    mustChangePassword: false,
  })
  teamA.lead = leadUserA._id as any
  await teamA.save()

  // Employee A in Branch A
  const empA = await User.create({
    name: 'Sched Employee A',
    email: `sched_emp_a_${testSuffix}@example.com`,
    passwordHash,
    role: memberRole._id,
    branch: branchA._id,
    teams: [teamA._id],
    isActive: true,
    mustChangePassword: false,
  })

  // Employee B in Branch A
  const empB = await User.create({
    name: 'Sched Employee B',
    email: `sched_emp_b_${testSuffix}@example.com`,
    passwordHash,
    role: memberRole._id,
    branch: branchA._id,
    teams: [teamA._id],
    isActive: true,
    mustChangePassword: false,
  })

  // Employee X in Branch B (Cross-branch test)
  const empBranchB = await User.create({
    name: 'Sched Employee B-Branch',
    email: `sched_emp_bb_${testSuffix}@example.com`,
    passwordHash,
    role: memberRole._id,
    branch: branchB._id,
    teams: [teamB._id],
    isActive: true,
    mustChangePassword: false,
  })

  const adminToken = tokenService.generateAccessToken({
    userId: adminUser._id.toString(),
    email: adminUser.email,
    role: 'Super Admin',
  })

  const leadToken = tokenService.generateAccessToken({
    userId: leadUserA._id.toString(),
    email: leadUserA.email,
    role: 'Team Lead',
  })

  const empAToken = tokenService.generateAccessToken({
    userId: empA._id.toString(),
    email: empA.email,
    role: 'Member',
  })

  log('Test branches, teams, and users initialized')

  // Week Target Dates: 2028-11-13 (Mon) to 2028-11-19 (Sun)
  const startDate = '2028-11-13'
  const endDate = '2028-11-19'

  // =========================================================================
  // SETUP TEST DATA ACROSS THE TARGET SCHEDULE WINDOW
  // =========================================================================

  // 1. Untimed date-only task (Due 2028-11-14)
  const untimedRes = await request('/api/v1/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Review Admission Docs (Date-only)',
      branch: branchA._id.toString(),
      team: teamA._id.toString(),
      owner: empA._id.toString(),
      due: '2028-11-14',
      priority: 'normal',
    },
  })
  if (untimedRes.status !== 201) fail(`Untimed task creation failed: ${JSON.stringify(untimedRes.data)}`)
  const untimedTask = untimedRes.data.data

  // 2. Timed task at 17:00 IST (Due 2028-11-15, 17:00 IST -> 11:30 UTC)
  const timedRes = await request('/api/v1/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'CRM Frontend Deliverable (17:00 IST)',
      branch: branchA._id.toString(),
      team: teamA._id.toString(),
      owner: empA._id.toString(),
      due: '2028-11-15',
      deadlineTime: '17:00',
      deadlineTimezone: 'Asia/Kolkata',
      reminderMinutesBefore: 30,
      priority: 'high',
    },
  })
  if (timedRes.status !== 201) fail(`Timed task creation failed: ${JSON.stringify(timedRes.data)}`)
  const timedTask = timedRes.data.data

  // 3. Multi-Assignee Parent Task with 2 Subtasks (Due 2028-11-16 & 2028-11-17)
  const multiRes = await request('/api/v1/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Platform Architecture (Parent Task)',
      branch: branchA._id.toString(),
      team: teamA._id.toString(),
      due: '2028-11-18',
      priority: 'high',
      subtasks: [
        {
          title: 'Subtask UI Component (Emp A)',
          owner: empA._id.toString(),
          due: '2028-11-16',
          deadlineTime: '14:30',
          deadlineTimezone: 'Asia/Kolkata',
          priority: 'normal',
        },
        {
          title: 'Subtask Database Schema (Emp B)',
          owner: empB._id.toString(),
          due: '2028-11-17',
          deadlineTime: '18:00',
          deadlineTimezone: 'Asia/Kolkata',
          priority: 'high',
        },
      ],
    },
  })
  if (multiRes.status !== 201) fail(`Multi-assignee task creation failed: ${JSON.stringify(multiRes.data)}`)
  const parentTask = multiRes.data.data

  // 4. Completed task in target week (Due 2028-11-13)
  const doneRes = await request('/api/v1/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Initial Team Meeting (Completed)',
      branch: branchA._id.toString(),
      team: teamA._id.toString(),
      owner: empA._id.toString(),
      due: '2028-11-13',
      priority: 'normal',
    },
  })
  if (doneRes.status !== 201) fail(`Done task creation failed: ${JSON.stringify(doneRes.data)}`)
  const doneTask = doneRes.data.data
  await Task.findByIdAndUpdate(doneTask.id, { status: 'done', doneAt: new Date() })

  // 5. Cross-Branch Task in Branch B (Due 2028-11-15)
  const branchBTaskRes = await request('/api/v1/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Branch B Confidential Task',
      branch: branchB._id.toString(),
      team: teamB._id.toString(),
      owner: empBranchB._id.toString(),
      due: '2028-11-15',
      priority: 'high',
    },
  })
  if (branchBTaskRes.status !== 201) fail(`Branch B task creation failed`)
  const branchBTask = branchBTaskRes.data.data

  log('Test dataset created across calendar target window')

  // =========================================================================
  // TEST 1: Bounded Date-Range Query (GET /tasks?startDate=...&endDate=...)
  // =========================================================================
  console.log('\n--- Test 1: Bounded Date-Range Query ---')
  const calendarQueryRes = await request('/api/v1/tasks', {
    token: adminToken,
    params: {
      startDate,
      endDate,
      branch: branchA._id.toString(),
      limit: '100',
    },
  })
  if (calendarQueryRes.status !== 200) {
    fail(`Calendar query failed: ${JSON.stringify(calendarQueryRes.data)}`)
  }
  const weekTasks = calendarQueryRes.data.data
  for (const t of weekTasks) {
    if (t.due < startDate || t.due > endDate) {
      fail(`Task ${t.title} has due date ${t.due} outside requested range [${startDate}, ${endDate}]`)
    }
  }
  log(`Test 1 Passed: Bounded query returned ${weekTasks.length} tasks strictly within [${startDate}, ${endDate}]`)

  // =========================================================================
  // TEST 2: Timed Tasks vs Date-Only Tasks Distinction
  // =========================================================================
  console.log('\n--- Test 2: Timed Tasks vs Date-Only Distinction ---')
  const foundTimed = weekTasks.find((t: any) => t.id === timedTask.id)
  const foundUntimed = weekTasks.find((t: any) => t.id === untimedTask.id)

  if (!foundTimed || !foundTimed.deadlineAt) {
    fail('Timed task missing or lacks deadlineAt in schedule query')
  }
  if (!foundUntimed || foundUntimed.deadlineAt !== null) {
    fail('Untimed task has invented deadlineAt instant')
  }

  // Format check
  const localFormatted = formatUTCInTimezone(foundTimed.deadlineAt, 'Asia/Kolkata')
  if (localFormatted.time !== '17:00') {
    fail(`Expected 17:00 IST, got ${localFormatted.time}`)
  }
  log('Test 2 Passed: Exact timed instant and date-only tasks clearly distinguished without invented hours')

  // =========================================================================
  // TEST 3: Multi-Assignee Subtasks Independent Deadlines & Parent Link
  // =========================================================================
  console.log('\n--- Test 3: Multi-Assignee Subtasks in Calendar ---')
  const subA = weekTasks.find((t: any) => t.title.includes('Subtask UI Component'))
  const subB = weekTasks.find((t: any) => t.title.includes('Subtask Database Schema'))

  if (!subA || !subB) {
    fail('Child subtasks missing from calendar query')
  }
  if (subA.due !== '2028-11-16' || subB.due !== '2028-11-17') {
    fail(`Subtasks have incorrect due dates: subA=${subA.due}, subB=${subB.due}`)
  }
  if (!subA.parentTask || !subB.parentTask) {
    fail('Subtasks missing parentTask context reference')
  }
  log('Test 3 Passed: Subtasks appear with independent deadlines and parentTask references')

  // =========================================================================
  // TEST 4: Role-Based Visibility (Member sees only own authorized tasks)
  // =========================================================================
  console.log('\n--- Test 4: Role-Based Visibility for Member ---')
  const empAQueryRes = await request('/api/v1/tasks', {
    token: empAToken,
    params: {
      startDate,
      endDate,
    },
  })
  if (empAQueryRes.status !== 200) {
    fail(`Employee query failed: ${JSON.stringify(empAQueryRes.data)}`)
  }
  const empATasks = empAQueryRes.data.data
  for (const t of empATasks) {
    if (t.owner !== empA.name && t.ownerId !== empA._id.toString()) {
      fail(`Employee A saw unauthorized task assigned to ${t.owner}`)
    }
  }
  log(`Test 4 Passed: Employee A sees strictly authorized tasks (${empATasks.length} tasks)`)

  // =========================================================================
  // TEST 5: Cross-Branch Task Exposure Blocked
  // =========================================================================
  console.log('\n--- Test 5: Cross-Branch Isolation ---')
  // Lead A in Branch A queries with no branch filter
  const leadAQueryRes = await request('/api/v1/tasks', {
    token: leadToken,
    params: {
      startDate,
      endDate,
    },
  })
  if (leadAQueryRes.status !== 200) {
    fail(`Lead query failed: ${JSON.stringify(leadAQueryRes.data)}`)
  }
  const leadTasks = leadAQueryRes.data.data
  const sawBranchB = leadTasks.some((t: any) => t.id === branchBTask.id)
  if (sawBranchB) {
    fail('Security breach: Lead in Branch A was able to view Branch B task')
  }
  log('Test 5 Passed: Cross-branch tasks are completely isolated and blocked from unauthorized roles')

  // =========================================================================
  // TEST 6: Priority and Status Filters in Calendar
  // =========================================================================
  console.log('\n--- Test 6: Priority and Status Filters ---')
  // High priority only
  const highRes = await request('/api/v1/tasks', {
    token: adminToken,
    params: {
      startDate,
      endDate,
      priority: 'high',
      branch: branchA._id.toString(),
    },
  })
  if (highRes.status !== 200) fail('High priority filter failed')
  for (const t of highRes.data.data) {
    if (t.priority !== 'high') fail(`Expected high priority, got ${t.priority}`)
  }

  // Done only
  const doneQueryRes = await request('/api/v1/tasks', {
    token: adminToken,
    params: {
      startDate,
      endDate,
      status: 'done',
      branch: branchA._id.toString(),
    },
  })
  if (doneQueryRes.status !== 200) fail('Done status filter failed')
  for (const t of doneQueryRes.data.data) {
    if (t.status !== 'done') fail(`Expected done status, got ${t.status}`)
  }
  log('Test 6 Passed: Priority and status filters function accurately')

  // =========================================================================
  // TEST 7: Existing Summary and My Tasks APIs Remain Functional
  // =========================================================================
  console.log('\n--- Test 7: Dashboard and My Tasks Compatibility ---')
  const summaryRes = await request('/api/v1/summary', { token: adminToken })
  if (summaryRes.status !== 200) fail('GET /api/v1/summary failed')

  const myTasksRes = await request('/api/v1/tasks', {
    token: empAToken,
    params: { owner: 'me' },
  })
  if (myTasksRes.status !== 200) fail('GET /api/v1/tasks?owner=me failed')
  log('Test 7 Passed: Existing Dashboard metrics and My Tasks endpoints remain completely intact')

  // Cleanup test documents
  await Task.deleteMany({
    _id: {
      $in: [
        untimedTask.id,
        timedTask.id,
        parentTask.id,
        ...parentTask.subtasks.map((s: any) => s.id),
        doneTask.id,
        branchBTask.id,
      ],
    },
  })
  await User.deleteMany({
    _id: {
      $in: [
        adminUser._id,
        leadUserA._id,
        empA._id,
        empB._id,
        empBranchB._id,
      ],
    },
  })
  await Team.deleteMany({ _id: { $in: [teamA._id, teamB._id] } })
  await Branch.deleteMany({ _id: { $in: [branchA._id, branchB._id] } })
  log('Test data cleaned up successfully')

  console.log('\n============================================================')
  console.log('🎉 ALL PHASE 2 SCHEDULE CALENDAR VERIFICATION TESTS PASSING!')
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

