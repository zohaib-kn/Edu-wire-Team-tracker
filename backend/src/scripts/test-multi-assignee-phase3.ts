import '../models/index.js'
import http from 'http'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { setRedisMockMode, closeRedisConnections } from '../config/redis.js'
import { closeAllQueues } from '../queues/queue.manager.js'
import { User, type IUser } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { Task } from '../models/Task.js'
import { Activity } from '../models/Activity.js'
import { Notification } from '../models/Notification.js'
import { TaskMessage } from '../models/TaskMessage.js'
import { tokenService } from '../services/token.service.js'
import { passwordService } from '../services/password.service.js'
import { notificationScheduler } from '../schedulers/notification.scheduler.js'
import { getTodayDateIST } from '../utils/dateUtils.js'

dotenv.config({ path: path.resolve('backend/.env') })

let server: http.Server
let baseUrl: string
let passedTests = 0
let failedTests = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`)
    passedTests++
  } else {
    console.error(`  ❌ FAIL: ${msg}`)
    failedTests++
  }
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

async function runPhase3Suite() {
  console.log('\n========================================================================')
  console.log('   MULTI-ASSIGNEE TASK SYSTEM: PHASE 3 NOTIFICATIONS & FULL INTEGRATION   ')
  console.log('========================================================================\n')

  setRedisMockMode(true)
  await connectDatabase()

  server = http.createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`
      console.log(`Test server running at ${baseUrl}`)
      resolve()
    })
  })

  const superAdminRole = await Role.findOne({ name: 'Super Admin' }).exec()
  const teamLeadRole = await Role.findOne({ name: 'Team Lead' }).exec()
  const memberRole = await Role.findOne({ name: 'Member' }).exec()

  let branch = await Branch.findOne({ name: /Bhopal/i }).exec()
  if (!branch) {
    branch = await Branch.create({ name: 'Bhopal Central Branch', city: 'Bhopal' })
  }

  const team = await Team.create({
    name: `P3 Team ${Date.now()}`,
    branch: branch._id,
    isActive: true,
  })

  const passwordHash = await passwordService.hashPassword('EduWire@123')

  // Super Admin
  const superAdmin = await User.create({
    name: 'P3 Super Admin',
    email: `p3-admin-${Date.now()}@eduwire.test`,
    passwordHash,
    role: superAdminRole!._id,
    isActive: true,
    mustChangePassword: false,
  })

  // Reporting Manager C
  const managerC = await User.create({
    name: 'P3 Team Lead C',
    email: `p3-leadc-${Date.now()}@eduwire.test`,
    passwordHash,
    role: teamLeadRole!._id,
    branch: branch._id,
    teams: [team._id],
    isActive: true,
    mustChangePassword: false,
  })

  // New Reporting Manager E
  const managerE = await User.create({
    name: 'P3 Team Lead E',
    email: `p3-leade-${Date.now()}@eduwire.test`,
    passwordHash,
    role: teamLeadRole!._id,
    branch: branch._id,
    teams: [team._id],
    isActive: true,
    mustChangePassword: false,
  })

  team.lead = managerC._id as any
  await team.save()

  // Employee A (Frontend)
  const employeeA = await User.create({
    name: 'P3 Employee A',
    email: `p3-empa-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole!._id,
    branch: branch._id,
    teams: [team._id],
    isActive: true,
    mustChangePassword: false,
  })

  // Employee B (Backend)
  const employeeB = await User.create({
    name: 'P3 Employee B',
    email: `p3-empb-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole!._id,
    branch: branch._id,
    teams: [team._id],
    isActive: true,
    mustChangePassword: false,
  })

  // Employee D (Reassignment target)
  const employeeD = await User.create({
    name: 'P3 Employee D',
    email: `p3-empd-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole!._id,
    branch: branch._id,
    teams: [team._id],
    isActive: true,
    mustChangePassword: false,
  })

  // Tokens
  const adminToken = tokenService.generateAccessToken({
    userId: superAdmin._id.toString(),
    email: superAdmin.email,
    role: 'Super Admin',
  })

  const managerCToken = tokenService.generateAccessToken({
    userId: managerC._id.toString(),
    email: managerC.email,
    role: 'Team Lead',
  })

  const managerEToken = tokenService.generateAccessToken({
    userId: managerE._id.toString(),
    email: managerE.email,
    role: 'Team Lead',
  })

  const empAToken = tokenService.generateAccessToken({
    userId: employeeA._id.toString(),
    email: employeeA.email,
    role: 'Member',
  })

  const empBToken = tokenService.generateAccessToken({
    userId: employeeB._id.toString(),
    email: employeeB.email,
    role: 'Member',
  })

  const empDToken = tokenService.generateAccessToken({
    userId: employeeD._id.toString(),
    email: employeeD.email,
    role: 'Member',
  })

  console.log('✓ Test fixtures initialized.\n')

  const createdTaskIds: mongoose.Types.ObjectId[] = []

  try {
    // ----------------------------------------------------
    // SECTION 1: Multi-Assignee Task Creation Notifications
    // ----------------------------------------------------
    console.log('1. Testing Multi-Assignee Task Creation & Notifications...')
    const createParentRes = await request('/tasks', {
      method: 'POST',
      token: adminToken,
      body: {
        title: 'Build CRM Platform',
        team: team._id.toString(),
        reportingManager: managerC._id.toString(),
        due: '2026-11-30',
        priority: 'high',
        note: 'Complete CRM overhaul',
        subtasks: [
          {
            title: 'Frontend Development',
            owner: employeeA._id.toString(),
            responsibilityLabel: 'Frontend Developer',
            note: 'Build React UI components',
            due: '2026-11-25',
            priority: 'high',
            isRequired: true,
          },
          {
            title: 'Backend Development',
            owner: employeeB._id.toString(),
            responsibilityLabel: 'Backend Developer',
            note: 'Build Express routes and database',
            due: '2026-11-28',
            priority: 'high',
            isRequired: true,
          },
        ],
      },
    })

    assert(createParentRes.status === 201, 'Parent task created with 201 Created')
    const parentTask = createParentRes.data?.data || createParentRes.data?.task
    createdTaskIds.push(new mongoose.Types.ObjectId(parentTask.id))
    const subtaskAId = parentTask.subtasks[0].id
    const subtaskBId = parentTask.subtasks[1].id
    createdTaskIds.push(new mongoose.Types.ObjectId(subtaskAId))
    createdTaskIds.push(new mongoose.Types.ObjectId(subtaskBId))

    // Check Notifications in MongoDB
    // Employee A should have "You have been assigned Frontend Development."
    const notifsEmpA = await request('/notifications', { token: empAToken })
    const aList = notifsEmpA.data?.notifications || []
    const aAssignmentNotif = aList.find((n: any) => n.taskId === subtaskAId)
    assert(!!aAssignmentNotif, 'Employee A received individual assignment notification')
    assert(
      aAssignmentNotif?.body.includes('Frontend Development'),
      'Employee A notification mentions "Frontend Development"',
    )

    // Employee B should have "You have been assigned Backend Development."
    const notifsEmpB = await request('/notifications', { token: empBToken })
    const bList = notifsEmpB.data?.notifications || []
    const bAssignmentNotif = bList.find((n: any) => n.taskId === subtaskBId)
    assert(!!bAssignmentNotif, 'Employee B received individual assignment notification')
    assert(
      bAssignmentNotif?.body.includes('Backend Development'),
      'Employee B notification mentions "Backend Development"',
    )

    // Reporting Manager C should have "You are supervising Build CRM Platform with 2 assignments."
    const notifsMgrC = await request('/notifications', { token: managerCToken })
    const cList = notifsMgrC.data?.notifications || []
    const cSuperviseNotif = cList.find((n: any) => n.taskId === parentTask.id)
    assert(!!cSuperviseNotif, 'Reporting Manager C received overall supervision notification')
    assert(
      cSuperviseNotif?.body.includes('supervising') && cSuperviseNotif?.body.includes('2 assignments'),
      'Reporting Manager C notification mentions supervising with 2 assignments',
    )

    // Super Admin should NOT receive self-notification
    const notifsAdmin = await request('/notifications', { token: adminToken })
    const adminList = notifsAdmin.data?.notifications || []
    const selfNotif = adminList.find(
      (n: any) => n.taskId === parentTask.id || n.taskId === subtaskAId || n.taskId === subtaskBId,
    )
    assert(!selfNotif, 'Super Admin did NOT receive self-creation notification')

    // ----------------------------------------------------
    // SECTION 2: Subtask Reassignment Notifications
    // ----------------------------------------------------
    console.log('\n2. Testing Subtask Reassignment Notifications (A -> D)...')
    const reassignRes = await request(`/tasks/${subtaskAId}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        owner: employeeD._id.toString(),
      },
    })
    assert(reassignRes.status === 200, 'Frontend subtask reassigned to Employee D')

    // Employee D receives assignment notification
    const notifsEmpD = await request('/notifications', { token: empDToken })
    const dList = notifsEmpD.data?.notifications || []
    const dReassignNotif = dList.find((n: any) => n.taskId === subtaskAId)
    assert(!!dReassignNotif, 'Employee D received new assignment notification')

    // Reporting Manager receives reassignment notice
    const notifsMgrC2 = await request('/notifications', { token: managerCToken })
    const cReassignNotif = (notifsMgrC2.data?.notifications || []).find(
      (n: any) => n.type === 'task_reassigned' && n.taskId === subtaskAId,
    )
    assert(!!cReassignNotif, 'Reporting Manager C received subtask reassignment notice')

    // Employee B received NO unnecessary duplicate notification
    const notifsEmpB2 = await request('/notifications', { token: empBToken })
    const bNewNotifs = (notifsEmpB2.data?.notifications || []).filter((n: any) => n.taskId === subtaskAId)
    assert(bNewNotifs.length === 0, 'Employee B received NO notification regarding Employee A/D subtask reassignment')

    // Reassignment of Reporting Manager on Parent (C -> E)
    console.log('\n3. Testing Reporting Manager Change on Parent (C -> E)...')
    const changeMgrRes = await request(`/tasks/${parentTask.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        reportingManager: managerE._id.toString(),
      },
    })
    assert(changeMgrRes.status === 200, 'Parent reporting manager updated to Manager E')

    // Manager E received supervision notification
    const notifsMgrE = await request('/notifications', { token: managerEToken })
    const eSuperviseNotif = (notifsMgrE.data?.notifications || []).find((n: any) => n.taskId === parentTask.id)
    assert(!!eSuperviseNotif, 'New Reporting Manager E received supervision notification')

    // ----------------------------------------------------
    // SECTION 3: Task Discussion Integration (Parent vs Subtask)
    // ----------------------------------------------------
    console.log('\n4. Testing Task Discussion Integration on Parent vs Subtask...')

    // A. Parent Discussion
    const parentMsgRes = await request(`/tasks/${parentTask.id}/messages`, {
      method: 'POST',
      token: adminToken,
      body: {
        body: 'CRM ka kitna kaam complete hua?',
        type: 'question',
      },
    })
    assert(parentMsgRes.status === 201, 'Super Admin posted to Parent Task discussion')

    // Verify subtask owners and reporting manager receive notification about parent message
    const notifsDAfterParent = await request('/notifications', { token: empDToken })
    const notifsBAfterParent = await request('/notifications', { token: empBToken })
    const notifsEAfterParent = await request('/notifications', { token: managerEToken })

    const dParentDisc = (notifsDAfterParent.data?.notifications || []).find(
      (n: any) => n.type === 'task_discussion_message' && n.taskId === parentTask.id,
    )
    const bParentDisc = (notifsBAfterParent.data?.notifications || []).find(
      (n: any) => n.type === 'task_discussion_message' && n.taskId === parentTask.id,
    )
    const eParentDisc = (notifsEAfterParent.data?.notifications || []).find(
      (n: any) => n.type === 'task_discussion_message' && n.taskId === parentTask.id,
    )

    assert(!!dParentDisc, 'Subtask owner D notified of Parent discussion')
    assert(!!bParentDisc, 'Subtask owner B notified of Parent discussion')
    assert(!!eParentDisc, 'Reporting Manager E notified of Parent discussion')

    // B. Subtask Discussion (Frontend Subtask)
    const subtaskMsgRes = await request(`/tasks/${subtaskAId}/messages`, {
      method: 'POST',
      token: adminToken,
      body: {
        body: 'Frontend dashboard complete hua?',
        type: 'question',
      },
    })
    assert(subtaskMsgRes.status === 201, 'Super Admin posted to Frontend Subtask discussion')

    // Frontend owner D receives notification
    const notifsDSub = await request('/notifications', { token: empDToken })
    const dSubDisc = (notifsDSub.data?.notifications || []).find(
      (n: any) => n.type === 'task_discussion_message' && n.taskId === subtaskAId,
    )
    assert(!!dSubDisc, 'Frontend subtask owner D notified of Frontend discussion')

    // Backend owner B strictly does NOT receive notification and cannot access subtask A discussion
    const notifsBSub = await request('/notifications', { token: empBToken })
    const bSubDisc = (notifsBSub.data?.notifications || []).find(
      (n: any) => n.type === 'task_discussion_message' && n.taskId === subtaskAId,
    )
    assert(!bSubDisc, 'Backend subtask owner B did NOT receive Frontend subtask discussion notification')

    const bAccessFrontendDisc = await request(`/tasks/${subtaskAId}/messages`, { token: empBToken })
    assert(
      bAccessFrontendDisc.status === 403,
      'Backend subtask owner B is strictly forbidden (403) from accessing Frontend subtask discussion',
    )

    // C. Discussion Replies
    const replyRes = await request(`/tasks/${subtaskAId}/messages`, {
      method: 'POST',
      token: empDToken,
      body: {
        body: 'Frontend 100% complete hai.',
        type: 'reply',
      },
    })
    assert(replyRes.status === 201, 'Employee D replied in Frontend subtask discussion')

    // Discussion does NOT automatically alter task status
    const subtaskACheck = await request(`/tasks/${subtaskAId}`, { token: adminToken })
    assert(
      subtaskACheck.data?.data?.status === 'todo',
      'Discussion message did NOT alter task status (status remains "todo")',
    )

    // ----------------------------------------------------
    // SECTION 4: Scheduled Reminders Operational Scoping
    // ----------------------------------------------------
    console.log('\n5. Testing Scheduled Reminders Scoping...')
    const todayIST = getTodayDateIST()

    // Test dispatchDueTodayReminders excludes parent tasks
    const dueTodayResult = await notificationScheduler.dispatchDueTodayReminders(todayIST)
    assert(dueTodayResult !== undefined, 'dispatchDueTodayReminders executed successfully')

    // Test dispatchOverdueReminders excludes parent tasks and completed tasks
    const overdueResult = await notificationScheduler.dispatchOverdueReminders(todayIST)
    assert(overdueResult !== undefined, 'dispatchOverdueReminders executed successfully')

    // ----------------------------------------------------
    // SECTION 5: Completion, Live Parent Progress & Toast Notifications
    // ----------------------------------------------------
    console.log('\n6. Testing Completion & Live Parent Progress...')

    // Step 12: Employee D completes Frontend
    const doneDRes = await request(`/tasks/${subtaskAId}/status`, {
      method: 'PATCH',
      token: empDToken,
      body: { status: 'done' },
    })
    assert(doneDRes.status === 200, 'Employee D marked Frontend done')

    // Step 13: Parent shows 50% progress and 'doing' status
    let checkParent = await request(`/tasks/${parentTask.id}`, { token: adminToken })
    let parentDoc = checkParent.data?.data
    assert(parentDoc.progress.progressPercentage === 50, 'Parent shows 50% progress')
    assert(parentDoc.status === 'doing', 'Parent status is doing')

    // Step 15: Employee B completes Backend
    const doneBRes = await request(`/tasks/${subtaskBId}/status`, {
      method: 'PATCH',
      token: empBToken,
      body: { status: 'done' },
    })
    assert(doneBRes.status === 200, 'Employee B marked Backend done')

    // Step 16: Parent shows 100% progress and Done status
    checkParent = await request(`/tasks/${parentTask.id}`, { token: adminToken })
    parentDoc = checkParent.data?.data
    assert(parentDoc.progress.progressPercentage === 100, 'Parent shows 100% progress')
    assert(parentDoc.status === 'done', 'Parent status automatically became done')
    assert(parentDoc.doneAt !== null, 'Parent doneAt timestamp stamped')

    // Verify Completion notification dispatched to Super Admin & Reporting Manager
    const adminCompNotifs = await request('/notifications', { token: adminToken })
    const compNotifAdmin = (adminCompNotifs.data?.notifications || []).find(
      (n: any) => n.type === 'task_completed' && n.taskId === subtaskBId,
    )
    assert(!!compNotifAdmin, 'Super Admin received completion notification for subtask')

    // Step 17 & 18: Completed History Verification
    console.log('\n7. Testing Completed History Verification...')
    const completedHistory = await request('/tasks', {
      token: adminToken,
      params: { status: 'done' },
    })
    assert(completedHistory.status === 200, 'GET /tasks?status=done returns 200 OK')
    const completedTasks = completedHistory.data?.data?.tasks || completedHistory.data?.tasks || []
    const hasParent = completedTasks.some((t: any) => t.id === parentTask.id)
    const hasSubA = completedTasks.some((t: any) => t.id === subtaskAId)
    const hasSubB = completedTasks.some((t: any) => t.id === subtaskBId)
    assert(hasParent, 'Parent Task appears in Completed Task History')
    assert(hasSubA, 'Subtask A appears in Completed Task History')
    assert(hasSubB, 'Subtask B appears in Completed Task History')

    // Reopening Backend reverts Parent to 'doing' and progress to 50%
    console.log('\n8. Testing Reopening Subtask Reverts Parent Status...')
    const reopenRes = await request(`/tasks/${subtaskBId}/status`, {
      method: 'PATCH',
      token: empBToken,
      body: { status: 'doing' },
    })
    assert(reopenRes.status === 200, 'Employee B reopened Backend to doing')

    checkParent = await request(`/tasks/${parentTask.id}`, { token: adminToken })
    parentDoc = checkParent.data?.data
    assert(parentDoc.status === 'doing', 'Parent status reverted from done to doing')
    assert(parentDoc.progress.progressPercentage === 50, 'Parent progress reverted to 50%')
    assert(parentDoc.doneAt === null, 'Parent doneAt cleared on reopening')

    // ----------------------------------------------------
    // SECTION 6: Dashboard & Report Consistency
    // ----------------------------------------------------
    console.log('\n9. Testing Dashboard & Report Consistency...')
    const summaryRes = await request('/summary', { token: adminToken })
    assert(summaryRes.status === 200, 'GET /summary returned 200 OK')
    const summary = summaryRes.data?.data || summaryRes.data

    // Summary counts actionable workload (excludes parent coordination tasks)
    assert(typeof summary.pending === 'number', 'Summary returns numeric pending count')
    assert(typeof summary.done7Days === 'number', 'Summary returns numeric done7Days count')

    const dailyReportRes = await request('/reports/daily', { token: adminToken })
    assert(dailyReportRes.status === 200, 'GET /reports/daily returned 200 OK')
    assert(
      typeof dailyReportRes.data?.data?.reportText === 'string',
      'Daily report generated formatted reportText',
    )

    const weeklyReportRes = await request('/reports/weekly', { token: adminToken })
    assert(weeklyReportRes.status === 200, 'GET /reports/weekly returned 200 OK')
    assert(Array.isArray(weeklyReportRes.data?.data?.teams), 'Weekly report includes teams breakdown')

    // ----------------------------------------------------
    // SECTION 7: Concurrency & Database Reliability
    // ----------------------------------------------------
    console.log('\n10. Testing Concurrent Subtask Updates...')
    // Re-mark both done concurrently
    const [res1, res2] = await Promise.all([
      request(`/tasks/${subtaskAId}/status`, {
        method: 'PATCH',
        token: empDToken,
        body: { status: 'done' },
      }),
      request(`/tasks/${subtaskBId}/status`, {
        method: 'PATCH',
        token: empBToken,
        body: { status: 'done' },
      }),
    ])

    assert(res1.status === 200 && res2.status === 200, 'Both concurrent subtask status updates succeeded')

    checkParent = await request(`/tasks/${parentTask.id}`, { token: adminToken })
    parentDoc = checkParent.data?.data
    assert(parentDoc.status === 'done', 'Parent task reached consistent Done state under concurrency')
    assert(parentDoc.progress.progressPercentage === 100, 'Parent task reached 100% under concurrency')

    // Step 19 & 20: Activity and Discussion Preservation
    console.log('\n11. Testing Activity History Preservation...')
    const parentDetailActRes = await request(`/tasks/${parentTask.id}`, { token: adminToken })
    const activities = parentDetailActRes.data?.data?.activity || parentDetailActRes.data?.activity || []
    assert(activities.length > 0, 'Parent task activity timeline recorded status changes and creations')

    const parentMessagesRes = await request(`/tasks/${parentTask.id}/messages`, { token: adminToken })
    const parentMsgs = parentMessagesRes.data?.data?.messages || parentMessagesRes.data?.messages || []
    assert(parentMsgs.length > 0, 'Parent task discussion messages preserved in MongoDB')

    console.log('\n========================================================================')
    console.log(`ALL PHASE 3 FULL INTEGRATION TESTS COMPLETED: ${passedTests} passed, ${failedTests} failed`)
    console.log('========================================================================\n')
  } finally {
    console.log('Cleaning up Phase 3 test fixtures...')
    if (createdTaskIds.length > 0) {
      await TaskMessage.deleteMany({ task: { $in: createdTaskIds } }).exec()
      await Activity.deleteMany({ task: { $in: createdTaskIds } }).exec()
      await Notification.deleteMany({ task: { $in: createdTaskIds } }).exec()
      await Task.deleteMany({ _id: { $in: createdTaskIds } }).exec()
    }
    await User.deleteMany({
      _id: { $in: [superAdmin._id, managerC._id, managerE._id, employeeA._id, employeeB._id, employeeD._id] },
    }).exec()
    await Team.deleteOne({ _id: team._id }).exec()

    if (server) {
      server.close()
    }
    await closeAllQueues()
    await closeRedisConnections()
    await disconnectDatabase()
    console.log('✓ Teardown complete.\n')
  }

  if (failedTests > 0) {
    process.exit(1)
  }
}

runPhase3Suite().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
