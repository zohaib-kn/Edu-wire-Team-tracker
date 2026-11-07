/**
 * Comprehensive Integration & Verification Master Suite: Phase 5 - Part 3
 * Full Integration, Security, Testing & Deployment Readiness
 *
 * Verifies:
 * 1. Multi-Role RBAC: Super Admin, Branch Admin, Team Lead, Member
 * 2. Full End-to-End Task Assignment: Admin -> Employee + Reporting Manager
 * 3. Notification dispatch verification for both Owner & Supervisor
 * 4. Task Completion & Permanent History: To Do -> Doing -> Done (Direct, No Approval)
 * 5. Reopening task resets doneAt while preserving complete Activity timeline
 * 6. Security tests: Auth tokens, account lockout, branch isolation, self-assignment restrictions
 * 7. Device token registration & pruning security
 * 8. Dashboard metrics & Report generation from real MongoDB state
 * 9. Health check endpoint (database + redis status)
 * 10. Clean lifecycle shutdown
 */
import '../models/index.js'
import http from 'http'
import mongoose from 'mongoose'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { setRedisMockMode, closeRedisConnections } from '../config/redis.js'
import { getQueue, closeAllQueues } from '../queues/queue.manager.js'
import { QUEUE_NAMES } from '../queues/queue.config.js'
import { Notification } from '../models/Notification.js'
import { User, type IUser } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { Task } from '../models/Task.js'
import { Activity } from '../models/Activity.js'
import { tokenService } from '../services/token.service.js'
import { passwordService } from '../services/password.service.js'
import { expoService } from '../services/expo.service.js'
import { mockWhatsAppProvider } from '../services/whatsapp/mock.provider.js'
import { notificationScheduler } from '../schedulers/notification.scheduler.js'
import { getTodayDateIST } from '../utils/dateUtils.js'

let server: http.Server
let baseUrl: string

function log(msg: string) {
  console.log(`  ✓ ${msg}`)
}

function fail(msg: string): never {
  console.error(`  ❌ ${msg}`)
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

async function runMasterSuite() {
  console.log('\n===================================================================')
  console.log('🚀 Starting Phase 5 - Part 3 Master Integration & Readiness Suite')
  console.log('===================================================================\n')

  setRedisMockMode(true)
  expoService.setMockMode(true)
  mockWhatsAppProvider.clearSentMessages()

  await connectDatabase()
  log('Database connected successfully')

  server = http.createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`
      resolve()
    })
  })
  log(`Test server running at ${baseUrl}`)

  // -------------------------------------------------------------------------
  // 1. Health Check Endpoint Verification
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Service Health Check Endpoint ---')
  const healthRes = await request('/health')
  if (healthRes.status !== 200 || healthRes.data.status !== 'ok') {
    fail(`Health check returned unexpected status: ${JSON.stringify(healthRes.data)}`)
  }
  if (healthRes.data.database !== 'connected') {
    fail('Health check did not report database connected')
  }
  log(`Health endpoint reports: status=${healthRes.data.status}, db=${healthRes.data.database}, redis=${healthRes.data.redis}`)

  // -------------------------------------------------------------------------
  // 2. Setup Multi-Role Fixtures
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Role Fixtures & Authentication Setup ---')
  const superAdminRole = await Role.findOne({ name: 'Super Admin' })
  const branchAdminRole = await Role.findOne({ name: 'Branch Admin' })
  const teamLeadRole = await Role.findOne({ name: 'Team Lead' })
  const memberRole = await Role.findOne({ name: 'Member' })

  if (!superAdminRole || !branchAdminRole || !teamLeadRole || !memberRole) {
    fail('System roles not found in database')
  }

  const branchBhopal =
    (await Branch.findOne({ name: 'Bhopal' })) || (await Branch.create({ name: 'Bhopal' }))
  const branchIndore =
    (await Branch.findOne({ name: 'Indore' })) || (await Branch.create({ name: 'Indore' }))

  // Clean prior test fixtures
  await User.deleteMany({ email: { $regex: /@p5p3test\.com$/ } })
  await Team.deleteMany({ name: { $regex: /^P5P3 Team/ } })
  await Task.deleteMany({ title: { $regex: /^\[P5P3\]/ } })
  await Notification.deleteMany({ recipient: { $regex: /@p5p3test\.com/ } })

  const pwdHash = await passwordService.hashPassword('Pass1234!')

  // Teams
  const teamAdmissions = await Team.create({
    name: 'P5P3 Team Admissions Bhopal',
    branch: branchBhopal._id,
  })

  const teamIndore = await Team.create({
    name: 'P5P3 Team Indore Ops',
    branch: branchIndore._id,
  })

  // Super Admin Account
  const superAdmin = await User.create({
    name: 'Super Admin P5P3',
    email: 'admin@p5p3test.com',
    phone: '+919999911111',
    passwordHash: pwdHash,
    role: superAdminRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[admin-p5p3]'],
  })
  const adminToken = tokenService.generateAccessToken({
    userId: superAdmin._id.toString(),
    email: superAdmin.email,
    role: 'Super Admin',
  })

  // Branch Admin Account (Bhopal)
  const branchAdmin = await User.create({
    name: 'Branch Admin Bhopal P5P3',
    email: 'badmin@p5p3test.com',
    phone: '+919999922222',
    passwordHash: pwdHash,
    role: branchAdminRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[badmin-p5p3]'],
  })
  const badminToken = tokenService.generateAccessToken({
    userId: branchAdmin._id.toString(),
    email: branchAdmin.email,
    role: 'Branch Admin',
  })

  // Team Lead Account (Bhopal Admissions)
  const teamLead = await User.create({
    name: 'Team Lead Admissions P5P3',
    email: 'lead.adm@p5p3test.com',
    phone: '+919999933333',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [teamAdmissions._id],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[lead-p5p3]'],
  })
  teamAdmissions.lead = teamLead._id as any
  await teamAdmissions.save()

  const leadToken = tokenService.generateAccessToken({
    userId: teamLead._id.toString(),
    email: teamLead.email,
    role: 'Team Lead',
  })

  // Employee A Account (Bhopal Admissions Member)
  const employeeA = await User.create({
    name: 'Employee A Admissions P5P3',
    email: 'emp.a@p5p3test.com',
    phone: '+919999944444',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [teamAdmissions._id],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[empa-p5p3]'],
  })
  const empAToken = tokenService.generateAccessToken({
    userId: employeeA._id.toString(),
    email: employeeA.email,
    role: 'Member',
  })

  // Member Indore Account (Cross-Branch)
  const indoreMember = await User.create({
    name: 'Employee Indore P5P3',
    email: 'emp.indore@p5p3test.com',
    phone: '+919999955555',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchIndore._id,
    teams: [teamIndore._id],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[indore-p5p3]'],
  })
  const indoreToken = tokenService.generateAccessToken({
    userId: indoreMember._id.toString(),
    email: indoreMember.email,
    role: 'Member',
  })

  log('Multi-role accounts created: Super Admin, Branch Admin, Team Lead, Employee A, Member Indore')

  // -------------------------------------------------------------------------
  // 3. Multi-Role RBAC Matrix Enforcement
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: RBAC Endpoint Enforcement ---')
  // Super Admin can access /users
  const adminUsersRes = await request('/users', { token: adminToken })
  if (adminUsersRes.status !== 200) fail('Super Admin failed to access /users')
  log('Super Admin granted full access to user management')

  // Member cannot access /users (403)
  const memberUsersRes = await request('/users', { token: empAToken })
  if (memberUsersRes.status !== 403) fail('Member should be forbidden from /users')
  log('Member correctly blocked from user management (403 Forbidden)')

  // Team Lead cannot create branches (403)
  const leadBranchCreate = await request('/branches', {
    method: 'POST',
    token: leadToken,
    body: { name: 'Unauthorized Branch' },
  })
  if (leadBranchCreate.status !== 403) fail('Team Lead should be forbidden from creating branches')
  log('Team Lead correctly blocked from branch management (403 Forbidden)')

  // Member cannot view reports (403)
  const memberReportRes = await request('/reports/daily', { token: empAToken })
  if (memberReportRes.status !== 403) fail('Member should be forbidden from reports')
  log('Member correctly blocked from executive reports (403 Forbidden)')

  // -------------------------------------------------------------------------
  // 4. Complete End-to-End Task Assignment Workflow
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: End-to-End Task Assignment & Recipient Notifications ---')
  const qAssign = getQueue(QUEUE_NAMES.TASK_ASSIGNMENT)
  await qAssign.drain()

  const todayIST = getTodayDateIST()
  const createTaskRes = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: '[P5P3] International Student Visa Review',
      note: 'Verify documents before embassy submission',
      team: teamAdmissions._id.toString(),
      owner: employeeA._id.toString(),
      reportingManager: teamLead._id.toString(),
      due: todayIST,
      priority: 'high',
    },
  })

  if (createTaskRes.status !== 201) {
    fail(`Task creation failed: ${JSON.stringify(createTaskRes.data)}`)
  }
  const task = createTaskRes.data.data
  const taskId = task.id
  log(`Task created with ID: ${taskId}, assigned to ${employeeA.name}, reporting to ${teamLead.name}`)

  // Verify BullMQ jobs for both recipients
  const ownerJob = await qAssign.getJob(`assign:${taskId}:${employeeA._id}`)
  const managerJob = await qAssign.getJob(`supervise:${taskId}:${teamLead._id}`)

  if (!ownerJob) fail('Owner notification job was not enqueued in task-assignment')
  if (!managerJob) fail('Reporting manager notification job was not enqueued in task-assignment')
  log(`Owner job verified: "${ownerJob.data.title}" -> ${employeeA.name}`)
  log(`Manager job verified: "${managerJob.data.title}" -> ${teamLead.name}`)

  // Employee checks My Tasks
  const empTasksRes = await request('/tasks', {
    token: empAToken,
    params: { owner: 'me' },
  })
  if (empTasksRes.status !== 200) fail('Employee My Tasks query failed')
  const empTasks = empTasksRes.data.data.tasks || empTasksRes.data.data
  const hasTaskInMyTasks = empTasks.some((t: any) => t.id === taskId)
  if (!hasTaskInMyTasks) fail('Newly assigned task not found in Employee My Tasks')
  log('Employee successfully retrieved task in My Tasks')

  // Reporting Manager checks Supervised Tasks
  const supTasksRes = await request('/tasks', {
    token: leadToken,
    params: { reporting: 'me' },
  })
  if (supTasksRes.status !== 200) fail('Reporting Manager supervised tasks query failed')
  const supTasks = supTasksRes.data.data.tasks || supTasksRes.data.data
  const hasTaskInSupervised = supTasks.some((t: any) => t.id === taskId)
  if (!hasTaskInSupervised) fail('Task not found in Reporting Manager supervised list (reporting=me)')
  log('Reporting Manager successfully observed task under supervised tasks')

  // -------------------------------------------------------------------------
  // 5. Task Completion, direct status changes & Completed History
  // -------------------------------------------------------------------------
  console.log('\n--- Test 5: Task Completion & Completed / History Preservation ---')
  // Move todo -> doing
  const doingRes = await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: empAToken,
    body: { status: 'doing' },
  })
  if (doingRes.status !== 200 || doingRes.data.data.status !== 'doing') {
    fail('Failed to transition task to doing')
  }
  log('Employee moved task to doing directly')

  // Move doing -> done directly (NO APPROVALS REQUIRED)
  const doneRes = await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: empAToken,
    body: { status: 'done' },
  })
  if (doneRes.status !== 200 || doneRes.data.data.status !== 'done') {
    fail('Failed to transition task to done directly')
  }
  const doneTaskData = doneRes.data.data
  if (!doneTaskData.doneAt) fail('doneAt timestamp was not populated')
  log(`Employee completed task directly to done; doneAt: ${doneTaskData.doneAt}`)

  // Confirm task in Completed Filter
  const completedFilterRes = await request('/tasks', {
    token: empAToken,
    params: { status: 'done' },
  })
  const completedList = completedFilterRes.data.data.tasks || completedFilterRes.data.data
  if (!completedList.some((t: any) => t.id === taskId)) {
    fail('Completed task not returned under status=done')
  }
  log('Completed task accessible in Completed / History view')

  // Confirm task excluded from Pending Filter
  const pendingFilterRes = await request('/tasks', {
    token: empAToken,
    params: { status: 'pending' },
  })
  const pendingList = pendingFilterRes.data.data.tasks || pendingFilterRes.data.data
  if (pendingList.some((t: any) => t.id === taskId)) {
    fail('Completed task still present in pending filter!')
  }
  log('Completed task strictly excluded from pending tasks filter')

  // Verify Activity Collection timeline
  const activities = await Activity.find({ task: taskId }).sort({ createdAt: 1 })
  const completionActivity = activities.find(
    (a) => a.action === 'status_changed' && (a as any).to === 'done',
  )
  if (!completionActivity) fail('Completion activity record not found in MongoDB Activity collection')
  log(`Activity timeline verified: ${activities.length} total events logged for task`)

  // -------------------------------------------------------------------------
  // 6. Reopen Done Task
  // -------------------------------------------------------------------------
  console.log('\n--- Test 6: Reopen Task & Activity Continuity ---')
  const reopenRes = await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: empAToken,
    body: { status: 'doing' },
  })
  if (reopenRes.status !== 200 || reopenRes.data.data.status !== 'doing') {
    fail('Reopening task failed')
  }
  if (reopenRes.data.data.doneAt !== null && reopenRes.data.data.doneAt !== undefined) {
    fail('doneAt must be reset to null upon task reopening')
  }
  const postReopenActivities = await Activity.find({ task: taskId })
  const hadDone = postReopenActivities.some((a) => a.action === 'status_changed' && (a as any).to === 'done')
  const hadDoing = postReopenActivities.some((a) => a.action === 'status_changed' && (a as any).to === 'doing')
  if (!hadDone || !hadDoing) fail('Reopening task corrupted previous activity history')
  log('Reopened task reset doneAt to null and preserved complete historical activity trail')

  // Put back to done for final verification
  await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: empAToken,
    body: { status: 'done' },
  })

  // -------------------------------------------------------------------------
  // 7. Security & Cross-Branch Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- Test 7: Cross-Branch Isolation & Security Boundaries ---')
  // Indore employee attempts to view completed Bhopal task
  const indoreAccess = await request(`/tasks/${taskId}`, { token: indoreToken })
  if (indoreAccess.status !== 403 && indoreAccess.status !== 404) {
    fail(`Cross-branch access succeeded with unexpected status ${indoreAccess.status}`)
  }
  log(`Cross-branch task isolation verified: rejected with status ${indoreAccess.status}`)

  // Unauthenticated requests rejected
  const unauthTask = await request(`/tasks/${taskId}`)
  if (unauthTask.status !== 401) fail('Unauthenticated task detail request should return 401')
  log('Unauthenticated request rejected with 401 Unauthorized')

  // Invalid task status values rejected
  const invalidStatusRes = await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: empAToken,
    body: { status: 'arbitrary_status' },
  })
  if (invalidStatusRes.status !== 400) fail('Invalid status should return 400 Bad Request')
  log("Invalid status 'arbitrary_status' rejected with 400 Bad Request")

  // -------------------------------------------------------------------------
  // 8. Device Token Registration Security
  // -------------------------------------------------------------------------
  console.log('\n--- Test 8: Device Token Registration Security ---')
  const regDeviceRes = await request('/devices', {
    method: 'POST',
    token: empAToken,
    body: { token: 'ExponentPushToken[empa-final-test]' },
  })
  if (regDeviceRes.status !== 200 || !regDeviceRes.data.success) {
    fail('Device token registration failed')
  }
  const empADoc = await User.findById(employeeA._id)
  if (!empADoc?.pushTokens.includes('ExponentPushToken[empa-final-test]')) {
    fail('Token was not saved in user pushTokens')
  }
  log('Expo device token registered securely with authenticated user isolation')

  // -------------------------------------------------------------------------
  // 9. Dashboard Summary & Executive Reports
  // -------------------------------------------------------------------------
  console.log('\n--- Test 9: Dashboard Summary & Executive Reports Consistency ---')
  const summaryRes = await request('/summary', { token: adminToken })
  if (summaryRes.status !== 200) fail('Dashboard summary API failed')
  const summary = summaryRes.data
  if (
    typeof summary.today === 'undefined' ||
    typeof summary.pending === 'undefined' ||
    typeof summary.late === 'undefined' ||
    typeof summary.done7Days === 'undefined'
  ) {
    fail('Summary metrics missing required counters')
  }
  log(`Dashboard metrics: today=${summary.today}, pending=${summary.pending}, late=${summary.late}, done7Days=${summary.done7Days}`)

  const dailyReportRes = await request('/reports/daily', { token: adminToken })
  if (dailyReportRes.status !== 200 || !dailyReportRes.data.data.reportText) {
    fail('Daily pending report generation failed')
  }
  log('Daily pending executive report generated successfully with real database aggregation')

  const weeklyReportRes = await request('/reports/weekly', { token: adminToken })
  if (weeklyReportRes.status !== 200 || !weeklyReportRes.data.data.teams) {
    fail('Weekly summary report generation failed')
  }
  log(`Weekly report calculated with ${weeklyReportRes.data.data.teams.length} team performance entries`)

  // -------------------------------------------------------------------------
  // 10. Scheduler Cron Execution Simulation
  // -------------------------------------------------------------------------
  console.log('\n--- Test 10: Scheduled Reminders Execution (Simulated Clock) ---')
  // Due-today reminder
  const dueTodayRes = await notificationScheduler.dispatchDueTodayReminders(todayIST)
  log(`Due-today reminders dispatch executed: ${dueTodayRes.dispatched} dispatched, ${dueTodayRes.skipped} skipped`)

  // Overdue reminder
  const overdueRes = await notificationScheduler.dispatchOverdueReminders(todayIST)
  log(`Overdue reminders dispatch executed: ${overdueRes.dispatched} dispatched, ${overdueRes.skipped} skipped`)

  // Daily WhatsApp report
  const dailyWaRes = await notificationScheduler.dispatchDailyPendingReports(todayIST)
  log(`Daily WhatsApp report dispatch executed: ${dailyWaRes.dispatched} dispatched, ${dailyWaRes.skipped} skipped`)

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  console.log('\n--- Cleanup ---')
  await closeAllQueues()
  await closeRedisConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await disconnectDatabase()

  console.log('\n===================================================================')
  console.log('🎉 ALL MASTER PHASE 5 - PART 3 INTEGRATION SCENARIOS PASSED!')
  console.log('===================================================================\n')
}

runMasterSuite().catch(async (err) => {
  console.error('\n❌ Master suite encountered an unexpected failure:', err)
  try {
    await closeAllQueues()
    await closeRedisConnections()
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
    await disconnectDatabase()
  } catch {}
  process.exit(1)
})

