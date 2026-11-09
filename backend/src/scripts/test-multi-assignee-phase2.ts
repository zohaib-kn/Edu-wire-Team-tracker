import '../models/index.js'
import http from 'http'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
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
import { TaskMessage } from '../models/TaskMessage.js'
import { tokenService } from '../services/token.service.js'
import { passwordService } from '../services/password.service.js'

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

async function request(path: string, options: {
  method?: string
  body?: unknown
  token?: string
  params?: Record<string, string>
} = {}) {
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

async function runPhase2Tests() {
  console.log('\n======================================================')
  console.log('   MULTI-ASSIGNEE TASK SYSTEM: PHASE 2 API & UX TEST   ')
  console.log('======================================================\n')

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

  let branchBhopal = await Branch.findOne({ name: /Bhopal/i }).exec()
  if (!branchBhopal) {
    branchBhopal = await Branch.create({ name: 'Bhopal Central Branch', city: 'Bhopal' })
  }

  const testTeam = await Team.create({
    name: `P2 UX Team ${Date.now()}`,
    branch: branchBhopal._id,
    isActive: true,
  })

  const passwordHash = await passwordService.hashPassword('EduWire@123')

  const superAdmin = await User.create({
    name: 'P2 Admin User',
    email: `p2-admin-${Date.now()}@eduwire.test`,
    passwordHash,
    role: superAdminRole!._id,
    isActive: true,
    mustChangePassword: false,
  })

  const leadBhopal = await User.create({
    name: 'P2 Lead Bhopal',
    email: `p2-lead-${Date.now()}@eduwire.test`,
    passwordHash,
    role: teamLeadRole!._id,
    branch: branchBhopal._id,
    teams: [testTeam._id],
    isActive: true,
    mustChangePassword: false,
  })

  testTeam.lead = leadBhopal._id as any
  await testTeam.save()

  const empA = await User.create({
    name: 'P2 Frontend Emp A',
    email: `p2-empa-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole!._id,
    branch: branchBhopal._id,
    teams: [testTeam._id],
    isActive: true,
    mustChangePassword: false,
  })

  const empB = await User.create({
    name: 'P2 Backend Emp B',
    email: `p2-empb-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole!._id,
    branch: branchBhopal._id,
    teams: [testTeam._id],
    isActive: true,
    mustChangePassword: false,
  })

  const empC = await User.create({
    name: 'P2 QA Emp C',
    email: `p2-empc-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole!._id,
    branch: branchBhopal._id,
    teams: [testTeam._id],
    isActive: true,
    mustChangePassword: false,
  })

  const superAdminToken = tokenService.generateAccessToken({
    userId: superAdmin._id.toString(),
    email: superAdmin.email,
    role: 'Super Admin',
  })

  const leadToken = tokenService.generateAccessToken({
    userId: leadBhopal._id.toString(),
    email: leadBhopal.email,
    role: 'Team Lead',
  })

  const empAToken = tokenService.generateAccessToken({
    userId: empA._id.toString(),
    email: empA.email,
    role: 'Member',
  })

  const empBToken = tokenService.generateAccessToken({
    userId: empB._id.toString(),
    email: empB.email,
    role: 'Member',
  })

  console.log('✓ Test fixtures initialized.\n')

  const createdTaskIds: mongoose.Types.ObjectId[] = []

  try {
    // ----------------------------------------------------
    // TEST 1: Single Assignment Mode (Default Frontend Creation Flow)
    // ----------------------------------------------------
    console.log('1. Testing Single Assignment Task Creation (TaskFormSheet Single Mode)...')
    const singleRes = await request('/tasks', {
      method: 'POST',
      token: superAdminToken,
      body: {
        title: 'Single Task Test Form',
        team: testTeam._id.toString(),
        owner: empA._id.toString(),
        reportingManager: leadBhopal._id.toString(),
        due: '2026-11-20',
        priority: 'high',
        note: 'Single task flow preserved intact',
      },
    })

    assert(singleRes.status === 201, 'Single assignment created with 201 Created')
    const singleData = singleRes.data?.data || singleRes.data?.task
    assert(singleData.taskLevel === 'standalone', 'Single task has taskLevel: standalone')
    assert(singleData.owner === empA.name, 'Single task has individual owner assigned')
    createdTaskIds.push(new mongoose.Types.ObjectId(singleData.id))

    // ----------------------------------------------------
    // TEST 2: Multiple Assignment Mode (TaskFormSheet Multiple Mode)
    // ----------------------------------------------------
    console.log('\n2. Testing Multiple Assignment Mode (TaskFormSheet Multiple Mode)...')
    const multiPayload = {
      title: 'Build EduWire CRM Platform',
      team: testTeam._id.toString(),
      reportingManager: leadBhopal._id.toString(),
      due: '2026-11-25',
      priority: 'high',
      note: 'Overall parent task description',
      subtasks: [
        {
          title: 'Frontend Development',
          owner: empA._id.toString(),
          responsibilityLabel: 'Frontend Developer',
          note: 'Build Login, Dashboard and Contacts UI',
          due: '2026-11-22',
          priority: 'high',
          isRequired: true,
        },
        {
          title: 'Backend Development',
          owner: empB._id.toString(),
          responsibilityLabel: 'Backend Developer',
          note: 'Build REST APIs, MongoDB integration and authentication',
          due: '2026-11-24',
          priority: 'normal',
          isRequired: true,
        },
      ],
    }

    const multiRes = await request('/tasks', {
      method: 'POST',
      token: superAdminToken,
      body: multiPayload,
    })

    assert(multiRes.status === 201, 'Parent task with subtasks created with 201 Created')
    const parentData = multiRes.data?.data || multiRes.data?.task
    assert(parentData.taskLevel === 'parent', 'Parent task has taskLevel: parent')
    assert(parentData.subtasks?.length === 2, 'Parent task contains 2 subtasks')
    assert(parentData.progress?.progressPercentage === 0, 'Parent progress initialized to 0%')
    assert(parentData.status === 'todo', 'Parent status initialized to todo')
    createdTaskIds.push(new mongoose.Types.ObjectId(parentData.id))

    const subtaskAId = parentData.subtasks[0].id
    const subtaskBId = parentData.subtasks[1].id
    createdTaskIds.push(new mongoose.Types.ObjectId(subtaskAId))
    createdTaskIds.push(new mongoose.Types.ObjectId(subtaskBId))

    // ----------------------------------------------------
    // TEST 3: Parent Task Detail Response Contract (TaskDetailPage)
    // ----------------------------------------------------
    console.log('\n3. Testing Parent Task Detail Endpoint Contract (TaskDetailPage)...')
    const parentDetailRes = await request(`/tasks/${parentData.id}`, {
      method: 'GET',
      token: superAdminToken,
    })

    assert(parentDetailRes.status === 200, 'GET /tasks/:id returns 200 OK')
    const parentDetail = parentDetailRes.data?.data || parentDetailRes.data?.task
    assert(parentDetail.taskLevel === 'parent', 'Detail confirms taskLevel: parent')
    assert(parentDetail.progress !== undefined, 'Detail contains progress summary object')
    assert(parentDetail.progress.totalSubtasks === 2, 'totalSubtasks === 2')
    assert(parentDetail.progress.requiredSubtasks === 2, 'requiredSubtasks === 2')
    assert(parentDetail.subtasks[0].responsibilityLabel === 'Frontend Developer', 'Subtask 0 has responsibilityLabel')
    assert(parentDetail.subtasks[1].responsibilityLabel === 'Backend Developer', 'Subtask 1 has responsibilityLabel')

    // ----------------------------------------------------
    // TEST 4: Subtask Detail Response Contract & Breadcrumbs
    // ----------------------------------------------------
    console.log('\n4. Testing Subtask Detail Endpoint Contract & Parent Ref...')
    const subtaskDetailRes = await request(`/tasks/${subtaskAId}`, {
      method: 'GET',
      token: empAToken,
    })

    assert(subtaskDetailRes.status === 200, 'GET /tasks/:subtaskId returns 200 OK')
    const subtaskDetail = subtaskDetailRes.data?.data || subtaskDetailRes.data?.task
    assert(subtaskDetail.taskLevel === 'subtask', 'Subtask has taskLevel: subtask')
    assert(subtaskDetail.responsibilityLabel === 'Frontend Developer', 'Subtask has responsibilityLabel: Frontend Developer')
    assert(subtaskDetail.parentTask !== null, 'Subtask includes parentTask reference object')
    assert(subtaskDetail.parentTask.title === 'Build EduWire CRM Platform', 'Parent reference title matches parent task title for breadcrumb')

    // ----------------------------------------------------
    // TEST 5: Status Progression & Live Parent Progress
    // ----------------------------------------------------
    console.log('\n5. Testing Status Progression & Live Parent Progress...')
    // Employee A marks subtask A as doing
    const doingRes = await request(`/tasks/${subtaskAId}/status`, {
      method: 'PATCH',
      token: empAToken,
      body: { status: 'doing' },
    })
    assert(doingRes.status === 200, 'Employee A successfully set subtask A to doing')

    // Parent task should derive to doing
    let checkParent = await request(`/tasks/${parentData.id}`, { token: superAdminToken })
    let parentDoc = checkParent.data?.data || checkParent.data?.task
    assert(parentDoc.status === 'doing', 'Parent task derived status updated to doing')

    // Employee A marks subtask A as done
    const doneRes = await request(`/tasks/${subtaskAId}/status`, {
      method: 'PATCH',
      token: empAToken,
      body: { status: 'done' },
    })
    assert(doneRes.status === 200, 'Employee A successfully set subtask A to done')

    // Parent task progress should be 50%
    checkParent = await request(`/tasks/${parentData.id}`, { token: superAdminToken })
    parentDoc = checkParent.data?.data || checkParent.data?.task
    assert(parentDoc.progress?.progressPercentage === 50, 'Parent progress calculated to 50%')
    assert(parentDoc.progress?.completedRequiredSubtasks === 1, '1 of 2 required subtasks completed')
    assert(parentDoc.status === 'doing', 'Parent remains doing while subtasks are pending')

    // Employee B marks subtask B as done
    const doneBRes = await request(`/tasks/${subtaskBId}/status`, {
      method: 'PATCH',
      token: empBToken,
      body: { status: 'done' },
    })
    assert(doneBRes.status === 200, 'Employee B successfully set subtask B to done')

    // Parent task should be done and 100%
    checkParent = await request(`/tasks/${parentData.id}`, { token: superAdminToken })
    parentDoc = checkParent.data?.data || checkParent.data?.task
    assert(parentDoc.progress?.progressPercentage === 100, 'Parent progress reached 100%')
    assert(parentDoc.status === 'done', 'Parent task automatically derived to done')
    assert(parentDoc.doneAt !== null, 'Parent task doneAt timestamp set')

    // ----------------------------------------------------
    // TEST 6: Reopening Subtask Reverts Parent Status
    // ----------------------------------------------------
    console.log('\n6. Testing Subtask Reopening...')
    const reopenRes = await request(`/tasks/${subtaskAId}/status`, {
      method: 'PATCH',
      token: empAToken,
      body: { status: 'doing' },
    })
    assert(reopenRes.status === 200, 'Employee A reopened subtask A to doing')

    checkParent = await request(`/tasks/${parentData.id}`, { token: superAdminToken })
    parentDoc = checkParent.data?.data || checkParent.data?.task
    assert(parentDoc.status === 'doing', 'Parent status reverted from done to doing')
    assert(parentDoc.progress?.progressPercentage === 50, 'Parent progress reverted to 50%')
    assert(parentDoc.doneAt === null, 'Parent task doneAt cleared on reopening')

    // ----------------------------------------------------
    // TEST 7: Add Subtask Dialog (POST /tasks/:id/subtasks)
    // ----------------------------------------------------
    console.log('\n7. Testing Add Subtask Flow (AddSubtaskDialog)...')
    const addSubtaskRes = await request(`/tasks/${parentData.id}/subtasks`, {
      method: 'POST',
      token: leadToken, // Reporting Manager adds subtask
      body: {
        title: 'QA Testing & Acceptance',
        owner: empC._id.toString(),
        responsibilityLabel: 'QA Engineer',
        note: 'Comprehensive manual and automated tests',
        due: '2026-11-26',
        priority: 'high',
        isRequired: true,
      },
    })

    assert(addSubtaskRes.status === 201, 'POST /tasks/:id/subtasks created subtask with 201 Created')
    const subtaskC = addSubtaskRes.data?.data || addSubtaskRes.data?.subtask
    assert(subtaskC.taskLevel === 'subtask', 'Created task has taskLevel: subtask')
    assert(subtaskC.responsibilityLabel === 'QA Engineer', 'Responsibility label QA Engineer saved')
    createdTaskIds.push(new mongoose.Types.ObjectId(subtaskC.id))

    // Parent should now have 3 subtasks and progress 33% (empB is done, empA & empC doing/todo)
    checkParent = await request(`/tasks/${parentData.id}`, { token: superAdminToken })
    parentDoc = checkParent.data?.data || checkParent.data?.task
    assert(parentDoc.subtasks?.length === 3, 'Parent task now lists 3 subtasks')
    assert(parentDoc.progress?.requiredSubtasks === 3, 'requiredSubtasks === 3')
    assert(parentDoc.progress?.progressPercentage === 33, 'Progress recalculated to 33%')

    // ----------------------------------------------------
    // TEST 8: Duplicate Assignee Protection in Add Subtask Dialog
    // ----------------------------------------------------
    console.log('\n8. Testing Duplicate Assignee Protection in Add Subtask...')
    const duplicateRes = await request(`/tasks/${parentData.id}/subtasks`, {
      method: 'POST',
      token: leadToken,
      body: {
        title: 'Duplicate Assignee Try',
        owner: empA._id.toString(), // Already assigned to this parent
        responsibilityLabel: 'Frontend Helper',
      },
    })
    assert(duplicateRes.status === 400, 'Duplicate assignee is rejected with 400 Bad Request')

    // ----------------------------------------------------
    // TEST 9: My Tasks (TaskCard UX) Isolation
    // ----------------------------------------------------
    console.log('\n9. Testing My Tasks View Scoping for Assignees...')
    const myTasksA = await request('/tasks', {
      token: empAToken,
      params: { owner: 'me' },
    })
    assert(myTasksA.status === 200, 'GET /tasks?owner=me succeeded')
    const listA = myTasksA.data?.data?.tasks || myTasksA.data?.tasks || []
    const aSubtaskItem = listA.find((t: any) => t.id === subtaskAId)
    const bSubtaskItem = listA.find((t: any) => t.id === subtaskBId)
    assert(!!aSubtaskItem, 'Employee A sees their own subtask')
    assert(!bSubtaskItem, 'Employee A cannot see Employee B subtask in My Tasks')
    assert(aSubtaskItem.responsibilityLabel === 'Frontend Developer', 'Employee A sees responsibility badge')
    assert(aSubtaskItem.parentTask?.title === 'Build EduWire CRM Platform', 'Subtask in list carries parent title for card prefix')

    // ----------------------------------------------------
    // TEST 10: Task Discussion Isolation Between Parent and Subtask
    // ----------------------------------------------------
    console.log('\n10. Testing Discussion Tab Isolation on Parent and Subtasks...')
    const postParentMsg = await request(`/tasks/${parentData.id}/messages`, {
      method: 'POST',
      token: superAdminToken,
      body: {
        body: 'Parent Discussion: Overall CRM milestone update required',
        type: 'instruction',
      },
    })
    assert(postParentMsg.status === 201, 'Parent discussion message posted')

    const postSubtaskMsg = await request(`/tasks/${subtaskAId}/messages`, {
      method: 'POST',
      token: empAToken,
      body: {
        body: 'Subtask Discussion: Frontend login page completed',
        type: 'reply',
      },
    })
    assert(postSubtaskMsg.status === 201, 'Subtask discussion message posted')

    const parentMsgs = await request(`/tasks/${parentData.id}/messages`, { token: superAdminToken })
    const subtaskMsgs = await request(`/tasks/${subtaskAId}/messages`, { token: empAToken })

    const parentList = parentMsgs.data?.data?.messages || parentMsgs.data?.messages || []
    const subtaskList = subtaskMsgs.data?.data?.messages || subtaskMsgs.data?.messages || []

    assert(parentList.some((m: any) => m.body.includes('Parent Discussion')), 'Parent discussion contains parent message')
    assert(!parentList.some((m: any) => m.body.includes('Frontend login page')), 'Parent discussion does NOT contain subtask messages')
    assert(subtaskList.some((m: any) => m.body.includes('Frontend login page')), 'Subtask discussion contains subtask message')
    assert(!subtaskList.some((m: any) => m.body.includes('Parent Discussion')), 'Subtask discussion does NOT contain parent messages')

    console.log('\n======================================================')
    console.log(`ALL PHASE 2 API & UX TESTS COMPLETED: ${passedTests} passed, ${failedTests} failed`)
    console.log('======================================================\n')
  } finally {
    console.log('Tearing down Phase 2 test fixtures...')
    if (createdTaskIds.length > 0) {
      await TaskMessage.deleteMany({ task: { $in: createdTaskIds } }).exec()
      await Activity.deleteMany({ task: { $in: createdTaskIds } }).exec()
      await Task.deleteMany({ _id: { $in: createdTaskIds } }).exec()
    }
    await User.deleteMany({
      _id: { $in: [superAdmin._id, leadBhopal._id, empA._id, empB._id, empC._id] },
    }).exec()
    await Team.deleteOne({ _id: testTeam._id }).exec()

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

runPhase2Tests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
