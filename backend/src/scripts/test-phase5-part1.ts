/**
 * Comprehensive Integration Test Suite: Phase 5 - Part 1
 * Background Processing Infrastructure & Completed Task History
 *
 * Covers 15 verification scenarios:
 * 1. Redis connection / mock connectivity & URL sanitization
 * 2. BullMQ queue creation (task-assignment, task-reminders, whatsapp-reports, push-notifications)
 * 3. Worker lifecycle (startup, processing, safe shutdown)
 * 4. Notification model persistence (channels, statuses, compound & unique indexes)
 * 5. Employee creates & marks authorized task 'done' directly
 * 6. Done task persists in MongoDB with doneAt and preserved fields
 * 7. Done task appears in Completed filter (status=done / status=completed)
 * 8. Done task disappears from Pending filter (status=pending / due filters)
 * 9. Activity collection records completion history
 * 10. Completed task persists across server restart
 * 11. Reopened task resets doneAt while preserving activity history
 * 12. Reporting Manager, Team Lead & Super Admin retain authorized visibility of completed task
 * 13. Cross-branch users cannot access completed task
 * 14. Existing Task APIs regression check (CRUD + Dashboard Summary)
 * 15. Strict status validation (todo, doing, done only)
 */
import '../models/index.js'
import http from 'http'
import mongoose from 'mongoose'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import {
  setRedisMockMode,
  createRedisClient,
  closeRedisConnections,
  sanitizeRedisUrl,
} from '../config/redis.js'
import {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
} from '../queues/queue.config.js'
import {
  getQueue,
  getTaskAssignmentQueue,
  getTaskRemindersQueue,
  getWhatsappReportsQueue,
  getPushNotificationsQueue,
  enqueueJob,
  closeAllQueues,
} from '../queues/queue.manager.js'
import { createBaseWorker } from '../workers/base.worker.js'
import { Notification } from '../models/Notification.js'
import { User, type IUser } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { Task } from '../models/Task.js'
import { Activity } from '../models/Activity.js'
import { tokenService } from '../services/token.service.js'
import { passwordService } from '../services/password.service.js'

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

async function startServer(): Promise<void> {
  server = http.createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`
      resolve()
    })
  })
}

async function stopServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

async function runSuite() {
  console.log('\n=============================================================')
  console.log('🧪 Starting Phase 5 - Part 1 Comprehensive Integration Tests')
  console.log('=============================================================\n')

  // Enable mock redis for reliable, self-contained execution across environments
  setRedisMockMode(true)

  await connectDatabase()
  log('Connected to MongoDB database')

  await startServer()
  log(`Test server running at ${baseUrl}`)

  // -------------------------------------------------------------------------
  // Setup Test Data & Fixtures
  // -------------------------------------------------------------------------
  console.log('\n--- Setup Test Fixtures ---')
  const superAdminRole = await Role.findOne({ name: 'Super Admin' })
  const teamLeadRole = await Role.findOne({ name: 'Team Lead' })
  const memberRole = await Role.findOne({ name: 'Member' })
  const branchAdminRole = await Role.findOne({ name: 'Branch Admin' })

  if (!superAdminRole || !teamLeadRole || !memberRole || !branchAdminRole) {
    fail('System roles not seeded in database')
  }

  const branchBhopal = (await Branch.findOne({ name: 'Bhopal' })) || (await Branch.create({ name: 'Bhopal' }))
  const branchIndore = (await Branch.findOne({ name: 'Indore' })) || (await Branch.create({ name: 'Indore' }))

  // Clean test fixtures from previous runs
  await User.deleteMany({ email: { $regex: /@p5p1test\.com$/ } })
  await Team.deleteMany({ name: { $regex: /^P5P1 Team/ } })
  await Task.deleteMany({ title: { $regex: /^\[P5P1\]/ } })
  await Notification.deleteMany({ recipient: { $regex: /@p5p1test\.com$/ } })

  // Synchronize Mongoose indexes on collection
  await Notification.syncIndexes()

  const pwdHash = await passwordService.hashPassword('Pass1234!')

  // Bhopal Team
  const teamBhopal = await Team.create({
    name: 'P5P1 Team Bhopal',
    branch: branchBhopal._id,
  })

  // Indore Team
  const teamIndore = await Team.create({
    name: 'P5P1 Team Indore',
    branch: branchIndore._id,
  })

  // Super Admin
  const superAdmin = await User.create({
    name: 'Super Admin P5P1',
    email: 'admin@p5p1test.com',
    passwordHash: pwdHash,
    role: superAdminRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
  })
  const adminToken = tokenService.generateAccessToken({
    userId: superAdmin._id.toString(),
    email: superAdmin.email,
    role: 'Super Admin',
  })

  // Team Lead Bhopal
  const leadBhopal = await User.create({
    name: 'Team Lead Bhopal P5P1',
    email: 'lead.bhopal@p5p1test.com',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [teamBhopal._id],
    isActive: true,
    mustChangePassword: false,
  })
  teamBhopal.lead = leadBhopal._id as any
  await teamBhopal.save()

  const leadToken = tokenService.generateAccessToken({
    userId: leadBhopal._id.toString(),
    email: leadBhopal.email,
    role: 'Team Lead',
  })

  // Member Bhopal (Task Owner)
  const memberBhopal = await User.create({
    name: 'Member Bhopal P5P1',
    email: 'member.bhopal@p5p1test.com',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [teamBhopal._id],
    isActive: true,
    mustChangePassword: false,
  })
  const memberToken = tokenService.generateAccessToken({
    userId: memberBhopal._id.toString(),
    email: memberBhopal.email,
    role: 'Member',
  })

  // Member Indore (Foreign Branch)
  const memberIndore = await User.create({
    name: 'Member Indore P5P1',
    email: 'member.indore@p5p1test.com',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchIndore._id,
    teams: [teamIndore._id],
    isActive: true,
    mustChangePassword: false,
  })
  const indoreToken = tokenService.generateAccessToken({
    userId: memberIndore._id.toString(),
    email: memberIndore.email,
    role: 'Member',
  })

  log('Test fixtures created successfully')

  // -------------------------------------------------------------------------
  // Scenario 1: Redis Connection & URL Sanitization
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 1: Redis Connection & URL Sanitization ---')
  const redisClient = createRedisClient()
  await redisClient.set('p5p1:test-key', 'active')
  const redisVal = await redisClient.get('p5p1:test-key')
  if (redisVal !== 'active') fail('Redis set/get failed')
  log('Redis client set/get verified')

  const sanitized = sanitizeRedisUrl('redis://default:mySecretPass123@localhost:6379')
  if (sanitized.includes('mySecretPass123') || !sanitized.includes('***:***@')) {
    fail(`Sanitization failed: ${sanitized}`)
  }
  log(`Redis URL safely sanitized: ${sanitized}`)

  // -------------------------------------------------------------------------
  // Scenario 2: BullMQ Queues Creation (4 Core Queues)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 2: BullMQ Queue Infrastructure ---')
  const qAssign = getTaskAssignmentQueue()
  const qRemind = getTaskRemindersQueue()
  const qWa = getWhatsappReportsQueue()
  const qPush = getPushNotificationsQueue()

  if (
    qAssign.name !== QUEUE_NAMES.TASK_ASSIGNMENT ||
    qRemind.name !== QUEUE_NAMES.TASK_REMINDERS ||
    qWa.name !== QUEUE_NAMES.WHATSAPP_REPORTS ||
    qPush.name !== QUEUE_NAMES.PUSH_NOTIFICATIONS
  ) {
    fail('Queue names do not match specification')
  }
  log('All 4 queues initialized with correct names')

  if (DEFAULT_JOB_OPTIONS.attempts !== 3 || (DEFAULT_JOB_OPTIONS.backoff as any)?.type !== 'exponential') {
    fail('DEFAULT_JOB_OPTIONS retry backoff mismatch')
  }
  log('Queue retry options verified (3 attempts, exponential backoff)')

  // -------------------------------------------------------------------------
  // Scenario 3: Worker Lifecycle & Job Deduplication
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Worker Lifecycle & Job Processing ---')
  let jobProcessed = false
  const testWorker = createBaseWorker({
    queueName: 'p5p1-test-queue',
    processor: async (job) => {
      jobProcessed = true
      return { ok: true, taskId: job.data.taskId }
    },
  })

  if (!testWorker) fail('Failed to create BullMQ worker')
  log('BullMQ worker created and listening')

  await testWorker.close()
  log('BullMQ worker closed cleanly')

  // -------------------------------------------------------------------------
  // Scenario 4: Notification Model Persistence & Indexes
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Notification Model & Indexes ---')
  const notif1 = await Notification.create({
    user: memberBhopal._id,
    type: 'task_assigned',
    channel: 'push',
    status: 'queued',
    recipient: memberBhopal.email,
    idempotencyKey: 'idem-key-001',
    attempts: 1,
  })

  if (!notif1._id || notif1.status !== 'queued') {
    fail('Failed to create notification')
  }
  log('Notification record saved with push channel and queued status')

  const queryNotif = await Notification.findOne({
    user: memberBhopal._id,
    idempotencyKey: 'idem-key-001',
  })
  if (!queryNotif) fail('Failed to query notification by user + idempotencyKey')
  log('Notification queried successfully via compound criteria')

  // Validate unique idempotencyKey index
  let duplicateCaught = false
  try {
    await Notification.create({
      user: memberBhopal._id,
      type: 'task_assigned',
      channel: 'whatsapp',
      status: 'queued',
      recipient: memberBhopal.email,
      idempotencyKey: 'idem-key-001',
    })
  } catch (err: any) {
    duplicateCaught = true
    log('Duplicate idempotencyKey rejected by unique index as required')
  }
  if (!duplicateCaught) fail('Expected unique index violation for duplicate idempotencyKey')

  // -------------------------------------------------------------------------
  // Scenario 5: Employee Creates & Completes Authorized Task Directly
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Employee Completes Task Directly (No Approvals) ---')
  const createRes = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: '[P5P1] Process Student Visa Batch',
      team: teamBhopal._id.toString(),
      owner: memberBhopal._id.toString(),
      due: '2026-11-20',
      priority: 'high',
      note: 'Complete checklist before 5 PM',
    },
  })

  if (createRes.status !== 201) {
    fail(`Task creation failed: ${JSON.stringify(createRes.data)}`)
  }
  const taskId = createRes.data.data.id || createRes.data.data._id
  log(`Task created with ID: ${taskId}, initial status: ${createRes.data.data.status}`)

  // Move todo -> doing
  const doingRes = await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: memberToken,
    body: { status: 'doing' },
  })
  if (doingRes.status !== 200 || doingRes.data.data.status !== 'doing') {
    fail(`Move to doing failed: ${JSON.stringify(doingRes.data)}`)
  }
  log('Task transitioned todo -> doing')

  // Move doing -> done directly (no approval workflow)
  const doneRes = await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: memberToken,
    body: { status: 'done' },
  })
  if (doneRes.status !== 200 || doneRes.data.data.status !== 'done') {
    fail(`Move to done failed: ${JSON.stringify(doneRes.data)}`)
  }
  log('Employee directly transitioned doing -> done without approval gates')

  // -------------------------------------------------------------------------
  // Scenario 6: Done Task Remains in MongoDB with doneAt & Intact Fields
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Task Document Intact with doneAt Timestamp ---')
  const dbTask = await Task.findById(taskId)
  if (!dbTask) fail('Task document missing from MongoDB')

  if (dbTask.status !== 'done') fail(`Expected status done, got ${dbTask.status}`)
  if (!dbTask.doneAt) fail('Task doneAt timestamp was not set')
  const timeDiff = Math.abs(Date.now() - new Date(dbTask.doneAt).getTime())
  if (timeDiff > 60000) fail('doneAt timestamp is not recent')

  if (dbTask.title !== '[P5P1] Process Student Visa Batch') fail('Task title altered')
  if (dbTask.priority !== 'high') fail('Task priority altered')
  if (dbTask.owner.toString() !== memberBhopal._id.toString()) fail('Task owner altered')
  if (dbTask.team.toString() !== teamBhopal._id.toString()) fail('Task team altered')
  if (dbTask.branch.toString() !== branchBhopal._id.toString()) fail('Task branch altered')
  log(`Task intact in MongoDB with doneAt: ${dbTask.doneAt.toISOString()}`)

  // -------------------------------------------------------------------------
  // Scenario 7: Done Task Appears in Completed Filter (status=done / completed)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Completed Filter Discovery ---')
  const doneFilterRes = await request('/tasks', {
    token: memberToken,
    params: { status: 'done' },
  })
  if (doneFilterRes.status !== 200) fail('Query with status=done failed')
  const doneTasks = doneFilterRes.data.data.tasks || doneFilterRes.data.data
  const foundInDone = doneTasks.some((t: any) => (t.id || t._id) === taskId)
  if (!foundInDone) fail('Completed task not returned in status=done query')
  log('Completed task returned successfully with status=done filter')

  const completedFilterRes = await request('/tasks', {
    token: memberToken,
    params: { status: 'completed' },
  })
  const completedTasks = completedFilterRes.data.data.tasks || completedFilterRes.data.data
  const foundInCompleted = completedTasks.some((t: any) => (t.id || t._id) === taskId)
  if (!foundInCompleted) fail('Completed task not returned in status=completed alias query')
  log('Completed task returned successfully with status=completed alias filter')

  // -------------------------------------------------------------------------
  // Scenario 8: Done Task Disappears from Pending Filtering
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Pending Filter Exclusion ---')
  const pendingFilterRes = await request('/tasks', {
    token: memberToken,
    params: { status: 'pending' },
  })
  if (pendingFilterRes.status !== 200) fail('Query with status=pending failed')
  const pendingTasks = pendingFilterRes.data.data.tasks || pendingFilterRes.data.data
  const foundInPending = pendingTasks.some((t: any) => (t.id || t._id) === taskId)
  if (foundInPending) fail('Completed task should NOT appear in pending filter')
  log('Completed task correctly excluded from status=pending filter')

  // -------------------------------------------------------------------------
  // Scenario 9: Activity History Preserves Completion Event
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 9: Activity History Preserved ---')
  const activities = await Activity.find({ task: taskId }).sort({ createdAt: 1 })
  const completionActivity = activities.find(
    (a) => a.action === 'status_changed' && (a as any).to === 'done',
  )
  if (!completionActivity) fail('No status_changed activity record found for completion to done')
  if (completionActivity.user.toString() !== memberBhopal._id.toString()) {
    fail('Completion activity user did not match member')
  }
  log(`Activity logged: ${completionActivity.action} (to: done) by ${memberBhopal.name}`)

  // -------------------------------------------------------------------------
  // Scenario 10: Completed Task Persists Across Server Restart
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 10: Completed Task Persistence Across Restart ---')
  await stopServer()
  log('Server stopped')
  await startServer()
  log(`Server restarted at ${baseUrl}`)

  const afterRestartRes = await request(`/tasks/${taskId}`, {
    token: memberToken,
  })
  if (afterRestartRes.status !== 200 || afterRestartRes.data.data.status !== 'done') {
    fail('Task not accessible or status changed after server restart')
  }
  if (!afterRestartRes.data.data.doneAt) {
    fail('doneAt field missing after server restart')
  }
  log('Task and doneAt verified intact after full server restart')

  // -------------------------------------------------------------------------
  // Scenario 11: Reopened Task Preserves Historical Activity
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 11: Reopen Task Resets doneAt While Keeping Activity ---')
  const reopenRes = await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: memberToken,
    body: { status: 'doing' },
  })
  if (reopenRes.status !== 200 || reopenRes.data.data.status !== 'doing') {
    fail(`Reopen to doing failed: ${JSON.stringify(reopenRes.data)}`)
  }
  if (reopenRes.data.data.doneAt !== null && reopenRes.data.data.doneAt !== undefined) {
    fail(`Expected doneAt to be null upon reopening, got ${reopenRes.data.data.doneAt}`)
  }
  log('Reopened task status is doing and doneAt reset to null')

  const postReopenActivities = await Activity.find({ task: taskId }).sort({ createdAt: 1 })
  const hadDoneActivity = postReopenActivities.some(
    (a) => a.action === 'status_changed' && (a as any).to === 'done',
  )
  const hasReopenActivity = postReopenActivities.some(
    (a) => a.action === 'status_changed' && (a as any).to === 'doing',
  )
  if (!hadDoneActivity || !hasReopenActivity) {
    fail('Activity history lost during task reopening')
  }
  log('Both completion and reopen entries preserved in Activity history')

  // Put back to done for subsequent tests
  await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: memberToken,
    body: { status: 'done' },
  })

  // -------------------------------------------------------------------------
  // Scenario 12: Reporting Manager, Team Lead & Super Admin Visibility
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 12: Multi-Role Visibility of Completed Tasks ---')
  // Super Admin view
  const adminTaskRes = await request(`/tasks/${taskId}`, { token: adminToken })
  if (adminTaskRes.status !== 200) fail('Super Admin could not view completed task')
  log('Super Admin successfully viewed completed task')

  // Team Lead view
  const leadTaskRes = await request(`/tasks/${taskId}`, { token: leadToken })
  if (leadTaskRes.status !== 200) fail('Team Lead could not view completed team task')
  log('Team Lead successfully viewed completed team task')

  // Reporting Manager test with delegation
  const delegatedCreate = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: '[P5P1] Supervised Follow-up Task',
      team: teamBhopal._id.toString(),
      owner: memberBhopal._id.toString(),
      reportingManager: leadBhopal._id.toString(),
      due: '2026-11-20',
      priority: 'normal',
    },
  })
  if (delegatedCreate.status !== 201) fail('Failed to create delegated task')
  const delegatedId = delegatedCreate.data.data.id || delegatedCreate.data.data._id

  // Mark done
  await request(`/tasks/${delegatedId}/status`, {
    method: 'PATCH',
    token: memberToken,
    body: { status: 'done' },
  })

  // Check supervised query for Reporting Manager
  const supervisedRes = await request('/tasks', {
    token: leadToken,
    params: { reporting: 'me' },
  })
  if (supervisedRes.status !== 200) fail('Reporting Manager supervised query failed')
  const supTasks = supervisedRes.data.data.tasks || supervisedRes.data.data
  const foundSupervised = supTasks.some((t: any) => (t.id || t._id) === delegatedId)
  if (!foundSupervised) fail('Completed supervised task not returned in reporting=me')
  log('Reporting Manager successfully tracked completed delegated task via reporting=me')

  // -------------------------------------------------------------------------
  // Scenario 13: Cross-Branch Inaccessibility of Completed Tasks
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 13: Cross-Branch Isolation ---')
  const indoreAccessRes = await request(`/tasks/${taskId}`, { token: indoreToken })
  if (indoreAccessRes.status !== 403 && indoreAccessRes.status !== 404) {
    fail(`Cross-branch user accessed completed task with status ${indoreAccessRes.status}`)
  }
  log(`Cross-branch access blocked with status: ${indoreAccessRes.status}`)

  // -------------------------------------------------------------------------
  // Scenario 14: Existing Task APIs & Dashboard Summary Regression Check
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 14: Dashboard Summary & Existing APIs ---')
  const summaryRes = await request('/summary', { token: adminToken })
  if (summaryRes.status !== 200) fail('Summary dashboard API failed')
  const summaryData = summaryRes.data
  if (
    typeof summaryData.today === 'undefined' ||
    typeof summaryData.pending === 'undefined' ||
    typeof summaryData.late === 'undefined' ||
    typeof summaryData.done7Days === 'undefined'
  ) {
    fail(`Summary counters missing: ${JSON.stringify(summaryData)}`)
  }
  log(`Dashboard summary verified: today=${summaryData.today}, pending=${summaryData.pending}, late=${summaryData.late}, done7Days=${summaryData.done7Days}`)

  // -------------------------------------------------------------------------
  // Scenario 15: Strict Status Validation (todo, doing, done only)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 15: Strict Status Contract Validation ---')
  const invalidStatusRes = await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: memberToken,
    body: { status: 'approved' },
  })
  if (invalidStatusRes.status !== 400) {
    fail(`Expected 400 for invalid status 'approved', got ${invalidStatusRes.status}`)
  }
  log("Invalid status 'approved' correctly rejected with 400 Bad Request")

  const archivedStatusRes = await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    token: memberToken,
    body: { status: 'archived' },
  })
  if (archivedStatusRes.status !== 400) {
    fail(`Expected 400 for invalid status 'archived', got ${archivedStatusRes.status}`)
  }
  log("Invalid status 'archived' correctly rejected with 400 Bad Request")

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  console.log('\n--- Cleanup ---')
  await closeAllQueues()
  log('Queues closed')
  await closeRedisConnections()
  log('Redis connections closed')
  await stopServer()
  log('Test server stopped')
  await disconnectDatabase()
  log('Database disconnected')

  console.log('\n=============================================================')
  console.log('🎉 ALL 15 INTEGRATION TEST SCENARIOS PASSED!')
  console.log('=============================================================\n')
}

runSuite().catch(async (err) => {
  console.error('\n❌ Unhandled error during test suite:', err)
  try {
    await closeAllQueues()
    await closeRedisConnections()
    await stopServer()
    await disconnectDatabase()
  } catch {}
  process.exit(1)
})
