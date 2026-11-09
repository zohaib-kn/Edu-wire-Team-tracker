/**
 * Comprehensive Integration Test Suite: Multi-Assignee Task System (Phase 1)
 * Tests all 20 required scenarios from Section 12 + Phase 1 Security Boundaries:
 *
 * 1. Existing single-assignee task creation still works (taskLevel: standalone).
 * 2. Super Admin creates Parent Task with two employees (Multi-assignee payload).
 * 3. Correct Subtasks are created in DB.
 * 4. Each Subtask has exactly one owner.
 * 5. Employee A sees only authorized assignments (GET /tasks?owner=me).
 * 6. Employee B sees their own work (GET /tasks?owner=me).
 * 7. Employee A completes Frontend (status -> done).
 * 8. Backend remains incomplete (status -> todo).
 * 9. Parent progress becomes 50% and parent status becomes 'doing'.
 * 10. Employee B completes Backend (status -> done).
 * 11. Parent status automatically becomes 'done' with doneAt recorded.
 * 12. Parent and Subtasks appear in Completed History.
 * 13. Reopen Backend and recalculate Parent status back to 'doing'.
 * 14. Reporting Manager can monitor authorized Parent Task (reporting=me).
 * 15. Cross-branch assignments are rejected.
 * 16. Invalid employee is rejected.
 * 17. Partial creation fails atomically (rollback leaves zero orphans).
 * 18. Duplicate Subtask creation is rejected safely.
 * 19. Existing dashboard counts remain logically correct.
 * 20. Existing reporting APIs still function.
 * 21. Manual status change on parent task is rejected (PARENT_STATUS_DERIVED).
 * 22. POST /tasks/:id/subtasks adds subtask and promotes standalone to parent.
 * 23. Discussion isolation: sibling subtask owners cannot access each other's discussions.
 */
import '../models/index.js'
import http from 'http'
import mongoose from 'mongoose'
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
import { TaskMessage } from '../models/TaskMessage.js'
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

async function runTests() {
  console.log('\n🧪 Starting Multi-Assignee Task System (Phase 1) Test Suite...\n')

  setRedisMockMode(true)
  await connectDatabase()
  log('Database connected successfully')

  server = http.createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`
      log(`Test server running at ${baseUrl}`)
      resolve()
    })
  })

  // -----------------------------------------------------------------
  // Setup: Roles, Branches, Teams & Test Users
  // -----------------------------------------------------------------
  console.log('\n--- Setup: Test Fixtures ---')
  const superAdminRole = await Role.findOne({ name: 'Super Admin' }).exec()
  const teamLeadRole = await Role.findOne({ name: 'Team Lead' }).exec()
  const memberRole = await Role.findOne({ name: 'Member' }).exec()

  if (!superAdminRole || !teamLeadRole || !memberRole) {
    fail('System roles missing')
  }

  let branchBhopal = await Branch.findOne({ name: /Bhopal/i }).exec()
  if (!branchBhopal) {
    branchBhopal = await Branch.create({ name: 'Bhopal Central Branch', city: 'Bhopal' })
  }

  let branchIndore = await Branch.findOne({ name: /Indore/i }).exec()
  if (!branchIndore) {
    branchIndore = await Branch.create({ name: 'Indore Branch', city: 'Indore' })
  }

  const testTeam = await Team.create({
    name: `MA Team Alpha ${Date.now()}`,
    branch: branchBhopal._id,
    isActive: true,
  })

  const indoreTeam = await Team.create({
    name: `MA Indore Team ${Date.now()}`,
    branch: branchIndore._id,
    isActive: true,
  })

  const passwordHash = await passwordService.hashPassword('Pass@1234')

  const superAdmin = await User.create({
    name: 'MA Super Admin',
    email: `ma-admin-${Date.now()}@eduwire.test`,
    passwordHash,
    role: superAdminRole._id,
    isActive: true,
    mustChangePassword: false,
  })

  const leadBhopal = await User.create({
    name: 'MA Lead Bhopal',
    email: `ma-lead-${Date.now()}@eduwire.test`,
    passwordHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [testTeam._id],
    isActive: true,
    mustChangePassword: false,
  })

  testTeam.lead = leadBhopal._id
  await testTeam.save()

  const empA = await User.create({
    name: 'Employee A',
    email: `emp-a-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [testTeam._id],
    isActive: true,
    mustChangePassword: false,
  })

  const empB = await User.create({
    name: 'Employee B',
    email: `emp-b-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [testTeam._id],
    isActive: true,
    mustChangePassword: false,
  })

  const empC = await User.create({
    name: 'Employee C',
    email: `emp-c-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [testTeam._id],
    isActive: true,
    mustChangePassword: false,
  })

  const empIndore = await User.create({
    name: 'Employee Indore',
    email: `emp-indore-${Date.now()}@eduwire.test`,
    passwordHash,
    role: memberRole._id,
    branch: branchIndore._id,
    teams: [indoreTeam._id],
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

  const empCToken = tokenService.generateAccessToken({
    userId: empC._id.toString(),
    email: empC.email,
    role: 'Member',
  })

  log('Fixtures initialized: Super Admin, Lead, 3 Bhopal Employees, 1 Indore Employee')

  // Track created task IDs for cleanup
  const createdTaskIds: mongoose.Types.ObjectId[] = []

  // -----------------------------------------------------------------
  // SCENARIO 1: Existing single-assignee task creation still works
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 1: Standalone Single-Assignee Task Creation ---')
  const singleTaskRes = await request('/tasks', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'Legacy Standalone Task',
      team: testTeam._id.toString(),
      owner: empA._id.toString(),
      due: '2026-11-20',
      priority: 'high',
      note: 'Standalone task notes',
    },
  })
  if (singleTaskRes.status !== 201) fail(`Single task creation failed with ${singleTaskRes.status}: ${JSON.stringify(singleTaskRes.data)}`)
  const singleTask = singleTaskRes.data?.data || singleTaskRes.data?.task
  if (singleTask.taskLevel !== 'standalone') fail(`Expected taskLevel 'standalone', got ${singleTask.taskLevel}`)
  if (singleTask.parentTask !== null) fail('Expected parentTask to be null')
  createdTaskIds.push(new mongoose.Types.ObjectId(singleTask.id))
  log('Scenario 1: Single-assignee task created with taskLevel: standalone')

  // -----------------------------------------------------------------
  // SCENARIO 2: Super Admin creates Parent Task with two employees
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 2: Super Admin Creates Parent Task with Two Employees ---')
  const parentPayload = {
    title: 'Build a New CRM',
    team: testTeam._id.toString(),
    reportingManager: leadBhopal._id.toString(),
    due: '2026-11-25',
    priority: 'high',
    note: 'Build the CRM frontend and backend.',
    subtasks: [
      {
        title: 'Frontend Development',
        owner: empA._id.toString(),
        responsibilityLabel: 'Frontend Developer',
        note: 'Build Login, Dashboard and Contacts UI.',
        due: '2026-11-20',
        priority: 'high',
        isRequired: true,
      },
      {
        title: 'Backend Development',
        owner: empB._id.toString(),
        responsibilityLabel: 'Backend Developer',
        note: 'Build API, Database and Authentication.',
        due: '2026-11-22',
        priority: 'high',
        isRequired: true,
      },
    ],
  }

  const parentRes = await request('/tasks', {
    method: 'POST',
    token: superAdminToken,
    body: parentPayload,
  })

  if (parentRes.status !== 201) fail(`Parent creation failed with ${parentRes.status}: ${JSON.stringify(parentRes.data)}`)
  const parentTask = parentRes.data?.data || parentRes.data?.task
  createdTaskIds.push(new mongoose.Types.ObjectId(parentTask.id))

  if (parentTask.taskLevel !== 'parent') fail(`Expected taskLevel 'parent', got ${parentTask.taskLevel}`)
  if (!parentTask.subtasks || parentTask.subtasks.length !== 2) fail(`Expected 2 subtasks in parent response, got ${parentTask.subtasks?.length}`)
  if (parentTask.progress?.progressPercentage !== 0) fail(`Expected initial progress 0%, got ${parentTask.progress?.progressPercentage}`)
  if (parentTask.status !== 'todo') fail(`Expected parent status 'todo', got ${parentTask.status}`)
  log('Scenario 2: Parent Task created successfully with 2 subtasks, 0% progress, status: todo')

  // -----------------------------------------------------------------
  // SCENARIO 3 & 4: Subtasks Created Correctly with Single Owners
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 3 & 4: Subtasks Verification in DB & Ownership ---')
  const dbSubtasks = await Task.find({ parentTask: parentTask.id, deletedAt: null }).exec()
  if (dbSubtasks.length !== 2) fail(`Expected 2 subtasks in DB, found ${dbSubtasks.length}`)
  for (const st of dbSubtasks) {
    createdTaskIds.push(st._id as mongoose.Types.ObjectId)
    if (st.taskLevel !== 'subtask') fail(`Expected subtask taskLevel 'subtask', got ${st.taskLevel}`)
    if (st.parentTask?.toString() !== parentTask.id) fail('Subtask parentTask mismatch')
    if (st.team.toString() !== testTeam._id.toString()) fail('Subtask team mismatch')
    if (st.branch.toString() !== branchBhopal._id.toString()) fail('Subtask branch mismatch')
  }

  const subtaskA = dbSubtasks.find((s) => s.owner.toString() === empA._id.toString())
  const subtaskB = dbSubtasks.find((s) => s.owner.toString() === empB._id.toString())

  if (!subtaskA) fail('Subtask for Employee A not found in DB')
  if (!subtaskB) fail('Subtask for Employee B not found in DB')
  if (subtaskA.responsibilityLabel !== 'Frontend Developer') fail(`Expected Frontend Developer label, got ${subtaskA.responsibilityLabel}`)
  if (subtaskB.responsibilityLabel !== 'Backend Developer') fail(`Expected Backend Developer label, got ${subtaskB.responsibilityLabel}`)
  log('Scenario 3: Subtasks correctly persisted with taskLevel: subtask, matching team, branch and parent link')
  log('Scenario 4: Each subtask has exactly one unique owner')

  // -----------------------------------------------------------------
  // SCENARIO 5 & 6: My Tasks (owner=me) Scoped Assignment Visibility
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 5 & 6: My Tasks (owner=me) Assignment Isolation ---')
  const empAListRes = await request('/tasks?owner=me', {
    method: 'GET',
    token: empAToken,
  })
  if (empAListRes.status !== 200) fail('Failed fetching My Tasks for Emp A')
  const empATasks: any[] = empAListRes.data?.data || empAListRes.data?.tasks || []
  const empAHasOwnSubtask = empATasks.some((t) => t.id === subtaskA._id.toString())
  const empAHasSiblingSubtask = empATasks.some((t) => t.id === subtaskB._id.toString())

  if (!empAHasOwnSubtask) fail('Employee A cannot see their own assigned subtask in owner=me')
  if (empAHasSiblingSubtask) fail('Employee A can see Employee B subtask in owner=me!')
  log('Scenario 5: Employee A sees only their own assignment under owner=me')

  const empBListRes = await request('/tasks?owner=me', {
    method: 'GET',
    token: empBToken,
  })
  if (empBListRes.status !== 200) fail('Failed fetching My Tasks for Emp B')
  const empBTasks: any[] = empBListRes.data?.data || empBListRes.data?.tasks || []
  const empBHasOwnSubtask = empBTasks.some((t) => t.id === subtaskB._id.toString())
  const empBHasSiblingSubtask = empBTasks.some((t) => t.id === subtaskA._id.toString())

  if (!empBHasOwnSubtask) fail('Employee B cannot see their own assigned subtask in owner=me')
  if (empBHasSiblingSubtask) fail('Employee B can see Employee A subtask in owner=me!')
  log('Scenario 6: Employee B sees only their own work; sibling subtasks are isolated')

  // -----------------------------------------------------------------
  // SCENARIO 7, 8, 9: Employee A Completes Frontend -> Parent 50% & Doing
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 7, 8 & 9: Subtask Completion & Parent Status Derivation (50%) ---')
  const doneSubtaskARes = await request(`/tasks/${subtaskA._id}/status`, {
    method: 'PATCH',
    token: empAToken,
    body: { status: 'done' },
  })
  if (doneSubtaskARes.status !== 200) fail(`Emp A status update failed with ${doneSubtaskARes.status}`)
  log('Scenario 7: Employee A marked Frontend Development as done directly')

  const subtaskBCheck = await Task.findById(subtaskB._id).exec()
  if (subtaskBCheck?.status !== 'todo') fail('Subtask B status changed unexpectedly')
  log('Scenario 8: Backend Development subtask remains incomplete (todo)')

  const parentAfterFirstDone = await request(`/tasks/${parentTask.id}`, {
    method: 'GET',
    token: superAdminToken,
  })
  if (parentAfterFirstDone.status !== 200) fail('Failed fetching parent task after first subtask completion')
  const pData1 = parentAfterFirstDone.data?.data || parentAfterFirstDone.data?.task
  if (pData1.status !== 'doing') fail(`Expected parent status 'doing', got ${pData1.status}`)
  if (pData1.progress?.completedRequiredSubtasks !== 1) fail(`Expected 1 completed required subtask, got ${pData1.progress?.completedRequiredSubtasks}`)
  if (pData1.progress?.progressPercentage !== 50) fail(`Expected progress 50%, got ${pData1.progress?.progressPercentage}%`)
  log('Scenario 9: Parent status automatically derived to doing and progress calculated to 50%')

  // -----------------------------------------------------------------
  // SCENARIO 10 & 11: Employee B Completes Backend -> Parent Done & doneAt Set
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 10 & 11: Second Subtask Done -> Parent Becomes Done (100%) ---')
  const doneSubtaskBRes = await request(`/tasks/${subtaskB._id}/status`, {
    method: 'PATCH',
    token: empBToken,
    body: { status: 'done' },
  })
  if (doneSubtaskBRes.status !== 200) fail(`Emp B status update failed with ${doneSubtaskBRes.status}`)
  log('Scenario 10: Employee B marked Backend Development as done directly')

  const parentAfterAllDone = await request(`/tasks/${parentTask.id}`, {
    method: 'GET',
    token: superAdminToken,
  })
  const pData2 = parentAfterAllDone.data?.data || parentAfterAllDone.data?.task
  if (pData2.status !== 'done') fail(`Expected parent status 'done', got ${pData2.status}`)
  if (pData2.progress?.progressPercentage !== 100) fail(`Expected progress 100%, got ${pData2.progress?.progressPercentage}%`)
  if (!pData2.doneAt) fail('Expected parent doneAt timestamp to be set')
  log('Scenario 11: All required subtasks complete -> Parent status automatically became done with doneAt recorded')

  // -----------------------------------------------------------------
  // SCENARIO 12: Parent and Subtasks Appear in Completed History
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 12: Completed Task History Verification ---')
  const historyRes = await request('/tasks?status=done', {
    method: 'GET',
    token: superAdminToken,
  })
  if (historyRes.status !== 200) fail('Failed querying completed tasks')
  const historyTasks: any[] = historyRes.data?.data || historyRes.data?.tasks || []
  const hasParentInHistory = historyTasks.some((t) => t.id === parentTask.id)
  const hasSubAInHistory = historyTasks.some((t) => t.id === subtaskA._id.toString())
  const hasSubBInHistory = historyTasks.some((t) => t.id === subtaskB._id.toString())

  if (!hasParentInHistory) fail('Parent task missing from Completed History')
  if (!hasSubAInHistory || !hasSubBInHistory) fail('Subtasks missing from Completed History')
  log('Scenario 12: Parent Task and Subtasks are preserved and appear in Completed History')

  // -----------------------------------------------------------------
  // SCENARIO 13: Reopen Backend and Recalculate Parent Status
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 13: Reopening Subtask Recalculates Parent Status ---')
  const reopenSubtaskBRes = await request(`/tasks/${subtaskB._id}/status`, {
    method: 'PATCH',
    token: empBToken,
    body: { status: 'doing' },
  })
  if (reopenSubtaskBRes.status !== 200) fail(`Failed reopening subtask B: ${reopenSubtaskBRes.status}`)

  const parentAfterReopen = await request(`/tasks/${parentTask.id}`, {
    method: 'GET',
    token: superAdminToken,
  })
  const pData3 = parentAfterReopen.data?.data || parentAfterReopen.data?.task
  if (pData3.status !== 'doing') fail(`Expected parent status reverted to 'doing', got ${pData3.status}`)
  if (pData3.doneAt !== null) fail(`Expected parent doneAt cleared to null on reopen, got ${pData3.doneAt}`)
  if (pData3.progress?.progressPercentage !== 50) fail(`Expected progress reverted to 50%, got ${pData3.progress?.progressPercentage}%`)
  log('Scenario 13: Reopening subtask reverted parent status to doing, cleared doneAt, and recalculated progress to 50%')

  // -----------------------------------------------------------------
  // SCENARIO 14: Reporting Manager Monitors Supervised Parent Task
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 14: Reporting Manager Supervision & Visibility ---')
  const leadReportingRes = await request('/tasks?reporting=me', {
    method: 'GET',
    token: leadToken,
  })
  if (leadReportingRes.status !== 200) fail('Failed querying reporting=me for team lead')
  const leadSupervised: any[] = leadReportingRes.data?.data || leadReportingRes.data?.tasks || []
  const leadSeesParent = leadSupervised.some((t) => t.id === parentTask.id)
  if (!leadSeesParent) fail('Reporting manager does not see parent task under reporting=me')

  const leadTaskDetailRes = await request(`/tasks/${parentTask.id}`, {
    method: 'GET',
    token: leadToken,
  })
  if (leadTaskDetailRes.status !== 200) fail(`Reporting manager cannot view parent task details: ${leadTaskDetailRes.status}`)
  log('Scenario 14: Reporting Manager monitors authorized Parent Task via reporting=me and task details')

  // -----------------------------------------------------------------
  // SCENARIO 15: Cross-branch Assignments Rejected
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 15: Cross-branch Assignment Rejection ---')
  const crossBranchRes = await request('/tasks', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'Cross Branch Parent Attempt',
      team: testTeam._id.toString(),
      reportingManager: leadBhopal._id.toString(),
      due: '2026-11-25',
      subtasks: [
        {
          title: 'Subtask 1',
          owner: empIndore._id.toString(), // Indore user assigned to Bhopal team task!
          due: '2026-11-20',
        },
      ],
    },
  })
  if (crossBranchRes.status !== 400) fail(`Expected 400 for cross-branch assignment, got ${crossBranchRes.status}`)
  log('Scenario 15: Cross-branch subtask assignment correctly rejected with 400 Bad Request')

  // -----------------------------------------------------------------
  // SCENARIO 16: Invalid Employee Rejected
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 16: Invalid Employee Rejection ---')
  const fakeId = new mongoose.Types.ObjectId().toString()
  const invalidEmpRes = await request('/tasks', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'Invalid Employee Parent Attempt',
      team: testTeam._id.toString(),
      reportingManager: leadBhopal._id.toString(),
      due: '2026-11-25',
      subtasks: [
        {
          title: 'Subtask 1',
          owner: fakeId,
          due: '2026-11-20',
        },
      ],
    },
  })
  if (invalidEmpRes.status !== 400) fail(`Expected 400 for invalid employee, got ${invalidEmpRes.status}`)
  log('Scenario 16: Invalid subtask assignee correctly rejected with 400 Bad Request')

  // -----------------------------------------------------------------
  // SCENARIO 17: Partial Creation Fails Atomically (Rollback Verification)
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 17: Atomic Rollback on Partial Subtask Failure ---')
  const beforeCount = await Task.countDocuments({ deletedAt: null }).exec()
  const atomicFailRes = await request('/tasks', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'Atomic Rollback Parent Task',
      team: testTeam._id.toString(),
      reportingManager: leadBhopal._id.toString(),
      due: '2026-11-25',
      subtasks: [
        {
          title: 'Valid Subtask A',
          owner: empA._id.toString(),
          due: '2026-11-20',
        },
        {
          title: 'Invalid Subtask B (cross-branch)',
          owner: empIndore._id.toString(),
          due: '2026-11-22',
        },
      ],
    },
  })
  if (atomicFailRes.status !== 400) fail(`Expected 400 for atomic fail, got ${atomicFailRes.status}`)

  const afterCount = await Task.countDocuments({ deletedAt: null }).exec()
  if (afterCount !== beforeCount) fail(`Atomic rollback failed! Tasks changed from ${beforeCount} to ${afterCount}`)
  log('Scenario 17: Atomic rollback verified: zero orphaned parent or subtask records created on validation failure')

  // -----------------------------------------------------------------
  // SCENARIO 18: Duplicate Subtask Creation Handled Safely
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 18: Duplicate Subtask Assignee Rejection ---')
  const duplicateSubtaskRes = await request('/tasks', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'Duplicate Assignee Parent',
      team: testTeam._id.toString(),
      reportingManager: leadBhopal._id.toString(),
      due: '2026-11-25',
      subtasks: [
        {
          title: 'Subtask 1',
          owner: empA._id.toString(),
          due: '2026-11-20',
        },
        {
          title: 'Subtask 2 (duplicate owner)',
          owner: empA._id.toString(),
          due: '2026-11-22',
        },
      ],
    },
  })
  if (duplicateSubtaskRes.status !== 400) fail(`Expected 400 for duplicate assignees, got ${duplicateSubtaskRes.status}`)
  log('Scenario 18: Duplicate subtask assignees under the same parent task rejected with 400 Bad Request')

  // -----------------------------------------------------------------
  // SCENARIO 19: Dashboard Summary Remains Logically Correct
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 19: Dashboard Summary Compatibility ---')
  const summaryRes = await request('/summary', {
    method: 'GET',
    token: superAdminToken,
  })
  if (summaryRes.status !== 200) fail(`GET /summary failed with ${summaryRes.status}`)
  const summaryData = summaryRes.data?.data || summaryRes.data
  if (typeof summaryData.pending !== 'number' || typeof summaryData.done7Days !== 'number') {
    fail('Dashboard summary payload missing required metrics')
  }
  log(`Scenario 19: Dashboard summary functioning correctly: pending=${summaryData.pending}, done7Days=${summaryData.done7Days}`)

  // -----------------------------------------------------------------
  // SCENARIO 20: Reporting & Listing Filters
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 20: Task Listing Filters (taskLevel & parentTask) ---')
  const parentOnlyRes = await request('/tasks?taskLevel=parent', {
    method: 'GET',
    token: superAdminToken,
  })
  if (parentOnlyRes.status !== 200) fail('Failed querying taskLevel=parent')
  const parentTasksList: any[] = parentOnlyRes.data?.data || parentOnlyRes.data?.tasks || []
  for (const pt of parentTasksList) {
    if (pt.taskLevel !== 'parent') fail(`Expected only parent tasks, got ${pt.taskLevel}`)
  }

  const subtasksByParentRes = await request(`/tasks?parentTask=${parentTask.id}`, {
    method: 'GET',
    token: superAdminToken,
  })
  if (subtasksByParentRes.status !== 200) fail('Failed querying parentTask filter')
  const subtaskList: any[] = subtasksByParentRes.data?.data || subtasksByParentRes.data?.tasks || []
  if (subtaskList.length !== 2) fail(`Expected 2 subtasks from parentTask filter, got ${subtaskList.length}`)
  log('Scenario 20: Reporting and filtering by taskLevel and parentTask function accurately')

  // -----------------------------------------------------------------
  // SCENARIO 21: Direct Manual Status Update on Parent Task Blocked
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 21: Manual Parent Status Change Blocked ---')
  const directParentStatusRes = await request(`/tasks/${parentTask.id}/status`, {
    method: 'PATCH',
    token: superAdminToken,
    body: { status: 'done' },
  })
  if (directParentStatusRes.status !== 400) fail(`Expected 400 when updating parent status manually, got ${directParentStatusRes.status}`)
  log('Scenario 21: Manual status modification on parent task rejected (PARENT_STATUS_DERIVED)')

  // -----------------------------------------------------------------
  // SCENARIO 22: POST /tasks/:id/subtasks Adds Subtask & Promotes Standalone
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 22: POST /tasks/:id/subtasks Adds Subtask & Promotes Standalone ---')
  // Add a subtask to singleTask from Scenario 1
  const addSubtaskRes = await request(`/tasks/${singleTask.id}/subtasks`, {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'Newly Added Subtask',
      owner: empC._id.toString(),
      responsibilityLabel: 'Support Specialist',
      note: 'Added to standalone task',
      due: '2026-11-24',
      isRequired: true,
    },
  })
  if (addSubtaskRes.status !== 201) fail(`Adding subtask failed with ${addSubtaskRes.status}: ${JSON.stringify(addSubtaskRes.data)}`)
  const newSubtask = addSubtaskRes.data?.data || addSubtaskRes.data?.task
  createdTaskIds.push(new mongoose.Types.ObjectId(newSubtask.id))

  // Verify parent task was promoted from standalone to parent
  const promotedParent = await Task.findById(singleTask.id).exec()
  if (promotedParent?.taskLevel !== 'parent') fail(`Expected promoted taskLevel 'parent', got ${promotedParent?.taskLevel}`)
  log('Scenario 22: POST /tasks/:id/subtasks successfully created subtask and promoted standalone task to parent')

  // Nested subtask rejection check: Cannot add subtask to subtask
  const nestedSubtaskRes = await request(`/tasks/${newSubtask.id}/subtasks`, {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'Nested Subtask Attempt',
      owner: empA._id.toString(),
      due: '2026-11-24',
    },
  })
  if (nestedSubtaskRes.status !== 400) fail(`Expected 400 for nested subtask, got ${nestedSubtaskRes.status}`)
  log('Scenario 22 (Bonus): Nested subtask-of-subtask creation correctly rejected with 400 Bad Request')

  // -----------------------------------------------------------------
  // SCENARIO 23: Discussion Isolation Between Sibling Subtasks
  // -----------------------------------------------------------------
  console.log('\n--- Scenario 23: Discussion Isolation Across Subtasks & Parent ---')
  // Emp A posts in subtask A discussion
  const empAMsgRes = await request(`/tasks/${subtaskA._id}/messages`, {
    method: 'POST',
    token: empAToken,
    body: {
      body: 'Frontend components are 90% built',
      type: 'reply',
    },
  })
  if (empAMsgRes.status !== 201) fail(`Emp A failed to post message in own subtask: ${empAMsgRes.status}`)
  log('Scenario 23a: Employee A can post in their own subtask discussion')

  // Emp B tries to read subtask A discussion -> MUST BE FORBIDDEN (403)
  const empBTryReadRes = await request(`/tasks/${subtaskA._id}/messages`, {
    method: 'GET',
    token: empBToken,
  })
  if (empBTryReadRes.status !== 403) fail(`Expected 403 for sibling subtask discussion access, got ${empBTryReadRes.status}`)
  log('Scenario 23b: Employee B strictly blocked (403) from accessing sibling Employee A subtask discussion')

  // Both Emp A and Emp B can participate in Parent Task discussion for overall coordination
  const empAParentMsgRes = await request(`/tasks/${parentTask.id}/messages`, {
    method: 'POST',
    token: empAToken,
    body: {
      body: 'Frontend is ready for backend integration testing',
      type: 'reply',
    },
  })
  if (empAParentMsgRes.status !== 201) fail(`Emp A failed to post in parent discussion: ${empAParentMsgRes.status}`)

  const empBParentMsgRes = await request(`/tasks/${parentTask.id}/messages`, {
    method: 'POST',
    token: empBToken,
    body: {
      body: 'Backend APIs are ready to connect with frontend',
      type: 'reply',
    },
  })
  if (empBParentMsgRes.status !== 201) fail(`Emp B failed to post in parent discussion: ${empBParentMsgRes.status}`)
  log('Scenario 23c: Both subtask owners can participate in the Parent Task discussion for overall coordination')

  // -----------------------------------------------------------------
  // Teardown & Clean Test Data Cleanup
  // -----------------------------------------------------------------
  console.log('\n--- Teardown: Purging Test Data ---')
  server.close()
  await closeAllQueues()
  await closeRedisConnections()

  // Clean test tasks and activities
  await TaskMessage.deleteMany({ task: { $in: createdTaskIds } })
  await Activity.deleteMany({ task: { $in: createdTaskIds } })
  await Task.deleteMany({ _id: { $in: createdTaskIds } })

  // Clean test users and teams
  await User.deleteMany({
    _id: { $in: [superAdmin._id, leadBhopal._id, empA._id, empB._id, empC._id, empIndore._id] },
  })
  await Team.deleteMany({ _id: { $in: [testTeam._id, indoreTeam._id] } })

  await disconnectDatabase()
  log('All test fixtures cleaned up safely')

  console.log('\n========================================================================')
  console.log('🎉 ALL 20+ MULTI-ASSIGNEE PHASE 1 SCENARIOS & SECURITY TESTS PASSED! 🎉')
  console.log('========================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Multi-Assignee Phase 1 Test Suite Failed:', err)
  process.exit(1)
})

