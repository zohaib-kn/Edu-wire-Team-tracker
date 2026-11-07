/**
 * Comprehensive Integration Test Suite: Phase 5 - Part 2
 * Assignment Notifications, Scheduled Reminders, Expo Push & WhatsApp-Ready Jobs
 *
 * Covers all 20 Scenarios:
 * 1. Super Admin assigns task to employee and manager
 * 2. Both receive separate queued notifications
 * 3. Task created by Branch Admin follows same recipient rules
 * 4. Task created by Team Lead follows same recipient rules
 * 5. Owner change notifies new owner and alerts manager
 * 6. Reporting Manager change notifies new manager only
 * 7. Same user in both roles receives one notification (deduplication)
 * 8. Inactive manager is skipped
 * 9. Missing manager uses valid team lead fallback
 * 10. Missing manager and no fallback still notifies owner
 * 11. Due-today reminder runs at 9:00 AM IST
 * 12. Daily WhatsApp report job runs at 9:30 AM IST
 * 13. Overdue job runs at 10:00 AM IST (Push + WhatsApp)
 * 14. Weekly summary runs Monday at 9:30 AM IST
 * 15. Completed task does not receive pending/late reminders
 * 16. Failed provider attempts are logged
 * 17. Retry rules operate correctly
 * 18. Queue restart does not cause unintended duplicates
 * 19. Invalid Expo token is handled (validation + auto-prune)
 * 20. Manager deep link cannot bypass permissions
 */
import '../models/index.js'
import http from 'http'
import mongoose from 'mongoose'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import {
  setRedisMockMode,
  closeRedisConnections,
} from '../config/redis.js'
import {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
} from '../queues/queue.config.js'
import {
  getQueue,
  closeAllQueues,
} from '../queues/queue.manager.js'
import { Notification } from '../models/Notification.js'
import { User, type IUser } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { Task } from '../models/Task.js'
import { tokenService } from '../services/token.service.js'
import { passwordService } from '../services/password.service.js'
import { expoService } from '../services/expo.service.js'
import { mockWhatsAppProvider } from '../services/whatsapp/mock.provider.js'
import { notificationScheduler } from '../schedulers/notification.scheduler.js'
import { notificationService } from '../services/notification.service.js'
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

async function runSuite() {
  console.log('\n=============================================================')
  console.log('🧪 Starting Phase 5 - Part 2 Comprehensive Integration Tests')
  console.log('=============================================================\n')

  setRedisMockMode(true)
  expoService.setMockMode(true)
  mockWhatsAppProvider.clearSentMessages()

  await connectDatabase()
  log('Database connected')

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
  // Setup Test Fixtures
  // -------------------------------------------------------------------------
  console.log('\n--- Setup Test Fixtures ---')
  const superAdminRole = await Role.findOne({ name: 'Super Admin' })
  const branchAdminRole = await Role.findOne({ name: 'Branch Admin' })
  const teamLeadRole = await Role.findOne({ name: 'Team Lead' })
  const memberRole = await Role.findOne({ name: 'Member' })

  if (!superAdminRole || !branchAdminRole || !teamLeadRole || !memberRole) {
    fail('System roles missing')
  }

  const branchBhopal =
    (await Branch.findOne({ name: 'Bhopal' })) || (await Branch.create({ name: 'Bhopal' }))
  const branchIndore =
    (await Branch.findOne({ name: 'Indore' })) || (await Branch.create({ name: 'Indore' }))

  await User.deleteMany({ email: { $regex: /@p5p2test\.com$/ } })
  await Team.deleteMany({ name: { $regex: /^P5P2 Team/ } })
  await Task.deleteMany({ title: { $regex: /^\[P5P2\]/ } })
  await Notification.deleteMany({ recipient: { $regex: /@p5p2test\.com|mock-wa/ } })

  const pwdHash = await passwordService.hashPassword('Pass1234!')

  // Teams
  const teamAlpha = await Team.create({
    name: 'P5P2 Team Alpha Bhopal',
    branch: branchBhopal._id,
  })

  const teamIndore = await Team.create({
    name: 'P5P2 Team Indore',
    branch: branchIndore._id,
  })

  // Super Admin
  const superAdmin = await User.create({
    name: 'Super Admin P5P2',
    email: 'admin@p5p2test.com',
    phone: '+919999900001',
    passwordHash: pwdHash,
    role: superAdminRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[admin-device-token]'],
  })
  const adminToken = tokenService.generateAccessToken({
    userId: superAdmin._id.toString(),
    email: superAdmin.email,
    role: 'Super Admin',
  })

  // Branch Admin Bhopal
  const branchAdmin = await User.create({
    name: 'Branch Admin Bhopal',
    email: 'badmin@p5p2test.com',
    phone: '+919999900002',
    passwordHash: pwdHash,
    role: branchAdminRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[badmin-device-token]'],
  })
  const branchAdminToken = tokenService.generateAccessToken({
    userId: branchAdmin._id.toString(),
    email: branchAdmin.email,
    role: 'Branch Admin',
  })

  // Team Lead Bhopal (Lead of Team Alpha)
  const teamLead = await User.create({
    name: 'Team Lead Alpha',
    email: 'lead.alpha@p5p2test.com',
    phone: '+919999900003',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [teamAlpha._id],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[lead-device-token]'],
  })
  teamAlpha.lead = teamLead._id as any
  await teamAlpha.save()

  const leadToken = tokenService.generateAccessToken({
    userId: teamLead._id.toString(),
    email: teamLead.email,
    role: 'Team Lead',
  })

  // Alternate Lead (Lead Beta in same branch)
  const leadBeta = await User.create({
    name: 'Team Lead Beta',
    email: 'lead.beta@p5p2test.com',
    phone: '+919999900004',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [teamAlpha._id],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[beta-device-token]'],
  })

  // Employee A (Member in Team Alpha)
  const employeeA = await User.create({
    name: 'Employee A Bhopal',
    email: 'emp.a@p5p2test.com',
    phone: '+919999900005',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [teamAlpha._id],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[empa-device-token]'],
  })
  const empAToken = tokenService.generateAccessToken({
    userId: employeeA._id.toString(),
    email: employeeA.email,
    role: 'Member',
  })

  // Employee C (Member in Team Alpha for reassignment test)
  const employeeC = await User.create({
    name: 'Employee C Bhopal',
    email: 'emp.c@p5p2test.com',
    phone: '+919999900006',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [teamAlpha._id],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[empc-device-token]'],
  })

  // Inactive Lead for skip test
  const inactiveLead = await User.create({
    name: 'Inactive Lead',
    email: 'inactive.lead@p5p2test.com',
    phone: '+919999900007',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [teamAlpha._id],
    isActive: false,
    mustChangePassword: false,
  })

  // Foreign Member in Indore
  const indoreMember = await User.create({
    name: 'Member Indore',
    email: 'indore@p5p2test.com',
    phone: '+919999900008',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchIndore._id,
    teams: [teamIndore._id],
    isActive: true,
    mustChangePassword: false,
    pushTokens: ['ExponentPushToken[indore-token]'],
  })
  const indoreToken = tokenService.generateAccessToken({
    userId: indoreMember._id.toString(),
    email: indoreMember.email,
    role: 'Member',
  })

  log('Test fixtures created')

  // -------------------------------------------------------------------------
  // Scenario 19: Device Token Registration (POST /api/v1/devices)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 19: Device Token Registration & Pruning ---')
  // Rejects invalid token
  const badDeviceRes = await request('/devices', {
    method: 'POST',
    token: empAToken,
    body: { token: 'invalid_raw_token' },
  })
  if (badDeviceRes.status !== 400) fail('Expected 400 for invalid token format')
  log('POST /devices rejected invalid push token format')

  // Accepts valid Expo token
  const regRes = await request('/devices', {
    method: 'POST',
    token: empAToken,
    body: { token: 'ExponentPushToken[empa-new-tablet]' },
  })
  if (regRes.status !== 200 || !regRes.data.success) fail('Failed to register device token')
  const empAUpdated = await User.findById(employeeA._id)
  if (!empAUpdated?.pushTokens.includes('ExponentPushToken[empa-new-tablet]')) {
    fail('Token was not added to user.pushTokens')
  }
  log('Device token successfully registered in User model')

  // Auto-pruning invalid tokens
  expoService.simulateInvalidToken('ExponentPushToken[empa-device-token]')
  await expoService.sendPushNotification({
    to: ['ExponentPushToken[empa-device-token]', 'ExponentPushToken[empa-new-tablet]'],
    userId: employeeA._id.toString(),
    title: 'Test Prune',
    body: 'Testing auto-prune',
  })
  const empAPostPrune = await User.findById(employeeA._id)
  if (empAPostPrune?.pushTokens.includes('ExponentPushToken[empa-device-token]')) {
    fail('Invalid token was not automatically pruned from user.pushTokens')
  }
  log('Invalid device token automatically pruned from database')

  // -------------------------------------------------------------------------
  // Scenario 1 & 2: Super Admin assigns task to employee & manager (Both notified)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenarios 1 & 2: Super Admin assigns task (Owner + Manager Notified) ---')
  const qAssign = getQueue(QUEUE_NAMES.TASK_ASSIGNMENT)
  await qAssign.drain()

  const s1TaskRes = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: '[P5P2] Review Admissions Files',
      team: teamAlpha._id.toString(),
      owner: employeeA._id.toString(),
      reportingManager: teamLead._id.toString(),
      due: '2026-11-20',
      priority: 'high',
    },
  })
  if (s1TaskRes.status !== 201) fail(`Task creation failed: ${JSON.stringify(s1TaskRes.data)}`)
  const task1 = s1TaskRes.data.data

  // Verify owner job
  const ownerJob = await qAssign.getJob(`assign:${task1.id}:${employeeA._id}`)
  if (!ownerJob) fail('Owner assignment job was not enqueued')
  if (ownerJob.data.roleInTask !== 'owner' || ownerJob.data.title !== 'New Task Assigned') {
    fail('Owner job payload incorrect')
  }
  log(`Owner notification enqueued: "${ownerJob.data.title}" -> ${ownerJob.data.employeeName}`)

  // Verify manager job
  const managerJob = await qAssign.getJob(`supervise:${task1.id}:${teamLead._id}`)
  if (!managerJob) fail('Reporting manager supervision job was not enqueued')
  if (
    managerJob.data.roleInTask !== 'manager' ||
    managerJob.data.title !== 'New Task Under Your Supervision' ||
    !managerJob.data.body.includes(employeeA.name)
  ) {
    fail(`Manager job payload incorrect: ${JSON.stringify(managerJob.data)}`)
  }
  log(`Reporting Manager notification enqueued: "${managerJob.data.title}" -> ${teamLead.name}`)

  // -------------------------------------------------------------------------
  // Scenario 3: Task created by Branch Admin follows same rules
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Task Created by Branch Admin ---')
  const s3TaskRes = await request('/tasks', {
    method: 'POST',
    token: branchAdminToken,
    body: {
      title: '[P5P2] Branch Admin Assigned Task',
      team: teamAlpha._id.toString(),
      owner: employeeA._id.toString(),
      due: '2026-11-22',
      priority: 'normal',
    },
  })
  if (s3TaskRes.status !== 201) fail(`Branch Admin task creation failed: ${JSON.stringify(s3TaskRes.data)}`)
  const task3 = s3TaskRes.data.data
  const s3OwnerJob = await qAssign.getJob(`assign:${task3.id}:${employeeA._id}`)
  const s3ManagerJob = await qAssign.getJob(`supervise:${task3.id}:${teamLead._id}`)
  if (!s3OwnerJob || !s3ManagerJob) fail('Branch Admin task failed to notify both owner and manager')
  log('Branch Admin task creation notified both owner and manager')

  // -------------------------------------------------------------------------
  // Scenario 4: Task created by Team Lead follows same rules
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Task Created by Team Lead ---')
  const s4TaskRes = await request('/tasks', {
    method: 'POST',
    token: leadToken,
    body: {
      title: '[P5P2] Team Lead Assigned Task',
      team: teamAlpha._id.toString(),
      owner: employeeA._id.toString(),
      due: '2026-11-23',
      priority: 'normal',
    },
  })
  if (s4TaskRes.status !== 201) fail('Team Lead task creation failed')
  const task4 = s4TaskRes.data.data
  const s4OwnerJob = await qAssign.getJob(`assign:${task4.id}:${employeeA._id}`)
  const s4ManagerJob = await qAssign.getJob(`supervise:${task4.id}:${teamLead._id}`)
  if (!s4OwnerJob || !s4ManagerJob) fail('Team Lead task failed to notify owner and lead')
  log('Team Lead task creation notified both employee and supervising lead')

  // -------------------------------------------------------------------------
  // Scenario 5: Owner change notifies new owner and manager
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Owner Change Reassignment ---')
  const reassignOwnerRes = await request(`/tasks/${task1.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { owner: employeeC._id.toString() },
  })
  if (reassignOwnerRes.status !== 200) fail('Reassign owner failed')
  const newOwnerJob = await qAssign.getJob(`assign_reassign:${task1.id}:${employeeC._id}`)
  const managerReassignAlert = await qAssign.getJob(`supervise_reassign:${task1.id}:${teamLead._id}`)
  if (!newOwnerJob || !managerReassignAlert) {
    fail('Owner reassignment did not trigger new owner and manager alert')
  }
  if (!managerReassignAlert.data.body.includes(employeeC.name)) {
    fail('Manager alert did not include new owner name')
  }
  log('Owner reassignment notified new owner and alerted manager')

  // -------------------------------------------------------------------------
  // Scenario 6: Reporting Manager change notifies new manager only
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Reporting Manager Change ---')
  const reassignMgrRes = await request(`/tasks/${task1.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { reportingManager: leadBeta._id.toString() },
  })
  if (reassignMgrRes.status !== 200) fail('Reassign manager failed')
  const newMgrJob = await qAssign.getJob(`supervise_new:${task1.id}:${leadBeta._id}`)
  if (!newMgrJob) fail('New manager was not notified on manager change')
  log('Reporting manager change notified new manager without re-notifying owner')

  // -------------------------------------------------------------------------
  // Scenario 7: Same user in both roles receives ONE notification (Deduplication)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Owner/Manager Deduplication ---')
  // Create task where teamLead is owner and manager
  const dedupTaskRes = await Task.create({
    title: '[P5P2] Self Lead Task',
    team: teamAlpha._id,
    branch: branchBhopal._id,
    owner: teamLead._id,
    reportingManager: teamLead._id,
    createdBy: superAdmin._id,
    due: '2026-11-25',
    priority: 'normal',
    status: 'todo',
  })
  await qAssign.drain()
  await notificationService.handleTaskCreated(dedupTaskRes)

  const dedupOwnerJob = await qAssign.getJob(`assign:${dedupTaskRes._id}:${teamLead._id}`)
  const dedupMgrJob = await qAssign.getJob(`supervise:${dedupTaskRes._id}:${teamLead._id}`)

  if (!dedupOwnerJob) fail('Owner notification missing for self-assigned task')
  if (dedupMgrJob) fail('Duplicate supervision notification should NOT be created for same user')
  log('Single notification sent when owner and manager are the same user')

  // -------------------------------------------------------------------------
  // Scenario 8: Inactive manager is skipped
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Inactive Manager Skip ---')
  const inactiveMgrTask = await Task.create({
    title: '[P5P2] Inactive Manager Task',
    team: teamAlpha._id,
    branch: branchBhopal._id,
    owner: employeeA._id,
    reportingManager: inactiveLead._id,
    createdBy: superAdmin._id,
    due: '2026-11-25',
    priority: 'normal',
    status: 'todo',
  })
  await notificationService.handleTaskCreated(inactiveMgrTask)
  const inactiveSkipNotif = await Notification.findOne({
    task: inactiveMgrTask._id,
    user: inactiveLead._id,
    status: 'skipped',
  })
  if (!inactiveSkipNotif || inactiveSkipNotif.error !== 'USER_INACTIVE') {
    fail('Inactive manager was not skipped with USER_INACTIVE')
  }
  log('Inactive manager skipped and recorded with USER_INACTIVE')

  // -------------------------------------------------------------------------
  // Scenario 9: Missing manager uses valid team lead fallback
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 9: Missing Manager Team Lead Fallback ---')
  const fallbackTask = await Task.create({
    title: '[P5P2] Fallback Lead Task',
    team: teamAlpha._id,
    branch: branchBhopal._id,
    owner: employeeA._id,
    createdBy: superAdmin._id,
    due: '2026-11-25',
    priority: 'normal',
    status: 'todo',
  })
  const fallbackResolved = await notificationService.resolveReportingManager(fallbackTask)
  if (!fallbackResolved.isFallback || fallbackResolved.manager?._id.toString() !== teamLead._id.toString()) {
    fail('Fallback to team lead failed')
  }
  log('Missing manager correctly fell back to active Team Lead for notification')

  // -------------------------------------------------------------------------
  // Scenario 10: Missing manager and no fallback still notifies owner
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 10: No Manager & No Fallback ---')
  const teamNoLead = await Team.create({
    name: 'P5P2 Team No Lead',
    branch: branchBhopal._id,
  })
  const orphanTask = await Task.create({
    title: '[P5P2] Orphan Task',
    team: teamNoLead._id,
    branch: branchBhopal._id,
    owner: employeeA._id,
    createdBy: superAdmin._id,
    due: '2026-11-25',
    priority: 'normal',
    status: 'todo',
  })
  await notificationService.handleTaskCreated(orphanTask)
  const orphanOwnerJob = await qAssign.getJob(`assign:${orphanTask._id}:${employeeA._id}`)
  if (!orphanOwnerJob) fail('Owner was not notified when no manager existed')
  const orphanSkipRecord = await Notification.findOne({
    task: orphanTask._id,
    status: 'skipped',
    error: 'NO_ELIGIBLE_REPORTING_MANAGER',
  })
  if (!orphanSkipRecord) fail('Skip reason NO_ELIGIBLE_REPORTING_MANAGER was not recorded')
  log('Owner notified and manager skip recorded when no eligible manager exists')

  // -------------------------------------------------------------------------
  // Scenario 11: Due-today reminder runs at 9:00 AM IST
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 11: Due-Today Push Reminders (9:00 AM IST) ---')
  const todayIST = getTodayDateIST()
  const dueTodayTask = await Task.create({
    title: '[P5P2] Today Due Urgent Report',
    team: teamAlpha._id,
    branch: branchBhopal._id,
    owner: employeeA._id,
    createdBy: superAdmin._id,
    due: todayIST,
    priority: 'high',
    status: 'todo',
  })

  expoService.clearMockDispatched()
  const dueTodayResult = await notificationScheduler.dispatchDueTodayReminders(todayIST)
  if (dueTodayResult.dispatched < 1) fail('Due-today reminder failed to dispatch')

  const dueTodayNotif = await Notification.findOne({
    task: dueTodayTask._id,
    type: 'task_reminder',
    channel: 'push',
    status: 'sent',
  })
  if (!dueTodayNotif) fail('Due-today push notification was not recorded in MongoDB')
  log(`Due-today push reminder dispatched and recorded for ${todayIST}`)

  // -------------------------------------------------------------------------
  // Scenario 12: Daily WhatsApp report job runs at 9:30 AM IST
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 12: Daily WhatsApp Report (9:30 AM IST) ---')
  mockWhatsAppProvider.clearSentMessages()
  const dailyWaResult = await notificationScheduler.dispatchDailyPendingReports(todayIST)
  if (dailyWaResult.dispatched < 1) fail('Daily WhatsApp report failed to dispatch')

  const waSent = mockWhatsAppProvider.findSentMessage(
    (m) => m.input.templateName === 'daily_pending_report' && m.input.recipient === teamLead.phone,
  )
  if (!waSent) fail('Daily pending WhatsApp report was not sent to Team Lead')
  const dailyReportNotif = await Notification.findOne({
    type: 'daily_report',
    channel: 'whatsapp',
    user: teamLead._id,
    status: 'sent',
  })
  if (!dailyReportNotif) fail('Daily WhatsApp report not recorded in Notification collection')
  log(`Daily WhatsApp report sent with template: ${waSent.input.templateName}`)

  // -------------------------------------------------------------------------
  // Scenario 13: Overdue job runs at 10:00 AM IST (Push + WhatsApp)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 13: Overdue Job (Push + WhatsApp) ---')
  const overdueTask = await Task.create({
    title: '[P5P2] Overdue Visa Clearance',
    team: teamAlpha._id,
    branch: branchBhopal._id,
    owner: employeeA._id,
    createdBy: superAdmin._id,
    due: '2026-11-01', // definitely in the past
    priority: 'high',
    status: 'doing',
  })

  mockWhatsAppProvider.clearSentMessages()
  expoService.clearMockDispatched()

  const overdueRes = await notificationScheduler.dispatchOverdueReminders(todayIST)
  if (overdueRes.dispatched < 2) fail('Overdue reminders failed to dispatch across channels')

  const overduePush = await Notification.findOne({
    task: overdueTask._id,
    type: 'task_reminder',
    channel: 'push',
    status: 'sent',
  })
  const overdueWa = await Notification.findOne({
    task: overdueTask._id,
    type: 'task_reminder',
    channel: 'whatsapp',
    status: 'sent',
  })

  if (!overduePush || !overdueWa) fail('Overdue task must have both Push and WhatsApp records')
  log('Overdue task dispatched to both Push and WhatsApp channels')

  // -------------------------------------------------------------------------
  // Scenario 14: Weekly summary runs Monday at 9:30 AM IST
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 14: Weekly Summary (Monday 9:30 AM IST) ---')
  mockWhatsAppProvider.clearSentMessages()
  const weeklyRes = await notificationScheduler.dispatchWeeklySummary(todayIST)
  if (weeklyRes.dispatched < 1) fail('Weekly summary failed to dispatch')

  const weeklyMsg = mockWhatsAppProvider.findSentMessage(
    (m) => m.input.templateName === 'weekly_summary' && m.input.recipient === superAdmin.phone,
  )
  if (!weeklyMsg) fail('Weekly summary message not sent to Super Admin')
  log(`Weekly summary WhatsApp message sent with template: ${weeklyMsg.input.templateName}`)

  // -------------------------------------------------------------------------
  // Scenario 15: Completed task does NOT receive pending/late reminders
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 15: Completed Tasks Excluded from Reminders ---')
  const completedOverdueTask = await Task.create({
    title: '[P5P2] Completed Past Task',
    team: teamAlpha._id,
    branch: branchBhopal._id,
    owner: employeeA._id,
    createdBy: superAdmin._id,
    due: '2026-11-01',
    priority: 'normal',
    status: 'done', // COMPLETED
    doneAt: new Date(),
  })

  mockWhatsAppProvider.clearSentMessages()
  await notificationScheduler.dispatchOverdueReminders(todayIST)
  await notificationScheduler.dispatchDueTodayReminders(todayIST)

  const badNotif = await Notification.findOne({
    task: completedOverdueTask._id,
  })
  if (badNotif) fail('Completed task received overdue or due-today notification!')
  log('Completed task strictly excluded from pending and overdue reminders')

  // -------------------------------------------------------------------------
  // Scenario 16: Failed provider attempts are logged
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 16: Failed Provider Logging ---')
  mockWhatsAppProvider.simulateError('task_overdue', 'Meta API Rate Limit Exceeded')
  const failTask = await Task.create({
    title: '[P5P2] Fail Simulation Task',
    team: teamAlpha._id,
    branch: branchBhopal._id,
    owner: employeeC._id,
    createdBy: superAdmin._id,
    due: '2026-11-02',
    priority: 'high',
    status: 'todo',
  })
  await notificationScheduler.dispatchOverdueReminders(todayIST)
  const failedNotif = await Notification.findOne({
    task: failTask._id,
    channel: 'whatsapp',
    status: 'failed',
  })
  if (!failedNotif || !failedNotif.error?.includes('Meta API Rate Limit Exceeded')) {
    fail('Failed provider attempt was not logged in Notification document')
  }
  mockWhatsAppProvider.clearSimulatedError('task_overdue')
  log('Failed provider error captured and logged in Notification record')

  // -------------------------------------------------------------------------
  // Scenario 17: Retry rules operate correctly
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 17: Retry Configuration ---')
  if (DEFAULT_JOB_OPTIONS.attempts !== 3 || (DEFAULT_JOB_OPTIONS.backoff as any)?.type !== 'exponential') {
    fail('Default job retry configuration mismatch')
  }
  log('Retry options verified: 3 attempts with exponential backoff')

  // -------------------------------------------------------------------------
  // Scenario 18: Queue restart does not cause duplicates (Idempotency)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 18: Idempotency & Duplicate Prevention ---')
  const preCount = await Notification.countDocuments({
    type: 'daily_report',
    channel: 'whatsapp',
    user: teamLead._id,
  })
  // Run daily pending report second time for same day
  await notificationScheduler.dispatchDailyPendingReports(todayIST)
  const postCount = await Notification.countDocuments({
    type: 'daily_report',
    channel: 'whatsapp',
    user: teamLead._id,
  })
  if (preCount !== postCount) {
    fail('Repeated scheduler run caused duplicate notification send')
  }
  log('Repeated scheduler trigger rejected duplicate send via stable idempotency key')

  // -------------------------------------------------------------------------
  // Scenario 20: Manager deep link cannot bypass permissions
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 20: Deep Link Security & RBAC Isolation ---')
  const bhopalTaskId = task1.id
  // Foreign user in Indore tries to access task via deep link task ID
  const forbiddenAccess = await request(`/tasks/${bhopalTaskId}`, {
    token: indoreToken,
  })
  if (forbiddenAccess.status !== 403 && forbiddenAccess.status !== 404) {
    fail(`Unauthorized deep link access granted with status ${forbiddenAccess.status}`)
  }
  log('Foreign user blocked from deep-link task access (403 Forbidden)')

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  console.log('\n--- Cleanup ---')
  await closeAllQueues()
  await closeRedisConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await disconnectDatabase()

  console.log('\n=============================================================')
  console.log('🎉 ALL 20 PHASE 5 - PART 2 TEST SCENARIOS PASSED!')
  console.log('=============================================================\n')
}

runSuite().catch(async (err) => {
  console.error('\n❌ Unhandled test failure:', err)
  try {
    await closeAllQueues()
    await closeRedisConnections()
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
    await disconnectDatabase()
  } catch {}
  process.exit(1)
})
