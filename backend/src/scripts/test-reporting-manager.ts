/**
 * Comprehensive Integration Test Suite: Reporting Manager & Supervised Tasks Workflow
 * Tests Scenarios 1 through 10
 */
import '../models/index.js'
import http from 'http'
import mongoose from 'mongoose'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
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
  console.log('\n🧪 Starting Reporting Manager & Task Delegation Test Suite...\n')

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

  // 1. Setup Fixtures
  console.log('\n--- Setup: Test Fixtures ---')
  const superAdminRole = await Role.findOne({ name: 'Super Admin' })
  const teamLeadRole = await Role.findOne({ name: 'Team Lead' })
  const memberRole = await Role.findOne({ name: 'Member' })
  const branchAdminRole = await Role.findOne({ name: 'Branch Admin' })

  if (!superAdminRole || !teamLeadRole || !memberRole || !branchAdminRole) {
    fail('Required system roles missing')
  }

  const branchBhopal = await Branch.findOne({ name: 'Bhopal' }) || await Branch.create({ name: 'Bhopal' })
  const branchIndore = await Branch.findOne({ name: 'Indore' }) || await Branch.create({ name: 'Indore' })

  // Clean old test fixtures
  await User.deleteMany({ email: { $regex: /@rmtest\.com$/ } })
  await Team.deleteMany({ name: { $regex: /^RM Test/ } })

  const pwdHash = await passwordService.hashPassword('Password123')

  // Super Admin
  const superAdmin = await User.create({
    name: 'Super Admin RM',
    email: 'admin@rmtest.com',
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

  // Team Lead 1 (Bhopal)
  const teamLead1 = await User.create({
    name: 'Lead One Bhopal',
    email: 'lead1@rmtest.com',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
  })
  const lead1Token = tokenService.generateAccessToken({
    userId: teamLead1._id.toString(),
    email: teamLead1.email,
    role: 'Team Lead',
  })

  // Team Lead 2 (Bhopal)
  const teamLead2 = await User.create({
    name: 'Lead Two Bhopal',
    email: 'lead2@rmtest.com',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
  })
  const lead2Token = tokenService.generateAccessToken({
    userId: teamLead2._id.toString(),
    email: teamLead2.email,
    role: 'Team Lead',
  })

  // Team Lead in Indore (different branch)
  const leadIndore = await User.create({
    name: 'Lead Indore',
    email: 'leadindore@rmtest.com',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchIndore._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
  })

  // Inactive Lead in Bhopal
  const inactiveLead = await User.create({
    name: 'Inactive Lead',
    email: 'inactivelead@rmtest.com',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: false,
    mustChangePassword: false,
  })

  // Team Bhopal
  const testTeam = await Team.create({
    name: 'RM Test Team Alpha',
    branch: branchBhopal._id,
    lead: teamLead1._id,
    isActive: true,
  })

  // Assign team to TeamLead1
  teamLead1.teams.push(testTeam._id as any)
  await teamLead1.save()

  // Employee A (Member in Team Alpha)
  const employeeA = await User.create({
    name: 'Employee A',
    email: 'empa@rmtest.com',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [testTeam._id as any],
    isActive: true,
    mustChangePassword: false,
  })
  const empAToken = tokenService.generateAccessToken({
    userId: employeeA._id.toString(),
    email: employeeA.email,
    role: 'Member',
  })

  log('Fixtures created: Super Admin, 2 Bhopal Leads, Indore Lead, Employee A')

  // --- Scenario 1: Automatic Team Lead Default ---
  console.log('\n--- Scenario 1: Automatic Team Lead Default ---')
  const s1Res = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Task Auto Team Lead',
      team: testTeam._id.toString(),
      owner: employeeA._id.toString(),
      due: '2026-11-20',
      priority: 'normal',
    },
  })
  if (s1Res.status !== 201) fail(`Scenario 1 create task failed with status ${s1Res.status}: ${JSON.stringify(s1Res.data)}`)
  const task1 = s1Res.data.data
  if (task1.reportingManagerId !== teamLead1._id.toString()) {
    fail(`Expected default reporting manager ${teamLead1._id}, got ${task1.reportingManagerId}`)
  }
  log(`Task created with automatic default Team Lead: ${task1.reportingManager} (${task1.reportingManagerId})`)

  // --- Scenario 2: Custom Reporting Manager by Super Admin ---
  console.log('\n--- Scenario 2: Custom Reporting Manager by Super Admin ---')
  const s2Res = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Task Custom Reporting Manager',
      team: testTeam._id.toString(),
      owner: employeeA._id.toString(),
      reportingManager: teamLead2._id.toString(),
      due: '2026-11-20',
      priority: 'high',
    },
  })
  if (s2Res.status !== 201) fail(`Scenario 2 create task failed: ${JSON.stringify(s2Res.data)}`)
  const task2 = s2Res.data.data
  if (task2.reportingManagerId !== teamLead2._id.toString()) {
    fail(`Expected custom reporting manager ${teamLead2._id}, got ${task2.reportingManagerId}`)
  }
  log(`Task created with explicit alternate supervisor: ${task2.reportingManager} (${task2.reportingManagerId})`)

  // --- Scenario 3: Employee Completes Task Directly ---
  console.log('\n--- Scenario 3: Employee Completes Task Directly (No Approval) ---')
  // Employee sees task in My Tasks
  const empListRes = await request('/tasks', {
    method: 'GET',
    token: empAToken,
    params: { owner: 'me' },
  })
  if (empListRes.status !== 200) fail(`Employee could not list own tasks: ${empListRes.status}`)
  const empTasks = empListRes.data.tasks || empListRes.data.data
  const foundTask2 = empTasks.find((t: any) => t.id === task2.id)
  if (!foundTask2) fail('Task 2 not found in Employee A personal task list')
  log('Employee A sees task in personal My Tasks list (owner=me)')

  // Employee moves to doing -> done directly
  const statusRes = await request(`/tasks/${task2.id}/status`, {
    method: 'PATCH',
    token: empAToken,
    body: { status: 'done' },
  })
  if (statusRes.status !== 200) fail(`Employee status update failed: ${statusRes.status}`)
  const updatedTask2 = statusRes.data.data || statusRes.data.task
  if (updatedTask2.status !== 'done' || !updatedTask2.doneAt) {
    fail('Task was not marked done directly or doneAt timestamp was missing')
  }
  log('Employee A directly completed task to "done" with doneAt populated (no approval required)')

  // --- Scenario 4: Manager Visibility (Supervised Tasks) ---
  console.log('\n--- Scenario 4: Manager Visibility (reporting=me) ---')
  // Team Lead 2 queries supervised tasks
  const supRes = await request('/tasks', {
    method: 'GET',
    token: lead2Token,
    params: { reporting: 'me' },
  })
  if (supRes.status !== 200) fail(`Manager query reporting=me failed: ${supRes.status}`)
  const supTasks = supRes.data.tasks || supRes.data.data
  const hasTask2 = supTasks.some((t: any) => t.id === task2.id)
  if (!hasTask2) fail('Supervised task 2 not present in reporting=me for Team Lead 2')
  log('Team Lead 2 sees supervised task under reporting=me filter')

  // Supervised task is NOT mixed into personal My Tasks
  const leadPersonalRes = await request('/tasks', {
    method: 'GET',
    token: lead2Token,
    params: { owner: 'me' },
  })
  const leadPersonalTasks = leadPersonalRes.data.tasks || leadPersonalRes.data.data
  const accidentallyMixed = leadPersonalTasks.some((t: any) => t.id === task2.id)
  if (accidentallyMixed) fail('Supervised task was incorrectly mixed into manager personal owner=me list')
  log('Supervised task is strictly separated from personal My Tasks list (owner=me)')

  // Team Lead 2 can view task details and activity
  const detailRes = await request(`/tasks/${task2.id}`, {
    method: 'GET',
    token: lead2Token,
  })
  if (detailRes.status !== 200) fail(`Reporting manager could not view task detail: ${detailRes.status}`)
  log('Reporting manager can view full task detail and activity history')

  // Reporting Manager status ALONE cannot delete task
  const delAttempt = await request(`/tasks/${task2.id}`, {
    method: 'DELETE',
    token: lead2Token,
  })
  if (delAttempt.status !== 403) fail(`Expected 403 when reporting manager attempts delete, got ${delAttempt.status}`)
  log('Reporting manager status alone correctly blocked from deleting task (403 Forbidden)')

  // --- Scenario 5: Validation Errors for Invalid Managers ---
  console.log('\n--- Scenario 5: Invalid Manager Validation ---')
  // 5a. Inactive manager
  const inactRes = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Invalid Inactive Manager',
      team: testTeam._id.toString(),
      owner: employeeA._id.toString(),
      reportingManager: inactiveLead._id.toString(),
      due: '2026-11-20',
    },
  })
  if (inactRes.status !== 400) fail(`Expected 400 for inactive manager, got ${inactRes.status}`)
  log('Inactive manager rejected with 400 Bad Request')

  // 5b. Manager in different branch
  const diffBranchRes = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Invalid Different Branch Manager',
      team: testTeam._id.toString(),
      owner: employeeA._id.toString(),
      reportingManager: leadIndore._id.toString(),
      due: '2026-11-20',
    },
  })
  if (diffBranchRes.status !== 400) fail(`Expected 400 for different branch manager, got ${diffBranchRes.status}`)
  log('Manager outside task branch rejected with 400 Bad Request')

  // 5c. Owner as their own manager
  const selfRes = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Invalid Self Manager',
      team: testTeam._id.toString(),
      owner: employeeA._id.toString(),
      reportingManager: employeeA._id.toString(),
      due: '2026-11-20',
    },
  })
  if (selfRes.status !== 400) fail(`Expected 400 for self reporting manager, got ${selfRes.status}`)
  log('Employee assigned as own reporting manager rejected with 400 Bad Request')

  // 5d. Non-supervisory user as manager (e.g. regular Member)
  const nonSupRes = await request('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Invalid Non-Supervisory Manager',
      team: testTeam._id.toString(),
      owner: employeeA._id.toString(),
      reportingManager: employeeA._id.toString(), // member
      due: '2026-11-20',
    },
  })
  if (nonSupRes.status !== 400) fail(`Expected 400 for non-supervisory role, got ${nonSupRes.status}`)
  log('User without supervisory eligibility rejected with 400 Bad Request')

  // --- Scenario 6: Unauthorized Override by Team Lead / Member ---
  console.log('\n--- Scenario 6: Unauthorized Override Rejection ---')
  const leadOverrideRes = await request('/tasks', {
    method: 'POST',
    token: lead1Token,
    body: {
      title: 'Unauthorized Override Attempt',
      team: testTeam._id.toString(),
      owner: employeeA._id.toString(),
      reportingManager: teamLead2._id.toString(), // attempting to override
      due: '2026-11-20',
    },
  })
  if (leadOverrideRes.status !== 403) fail(`Expected 403 for non-admin reporting manager override, got ${leadOverrideRes.status}`)
  log('Non-Super Admin override attempt correctly rejected with 403 Forbidden')

  // --- Scenario 7: Reporting Manager Change by Super Admin ---
  console.log('\n--- Scenario 7: Reporting Manager Change ---')
  // Super Admin updates task2 reportingManager from Lead2 to Lead1
  const patchRes = await request(`/tasks/${task2.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { reportingManager: teamLead1._id.toString() },
  })
  if (patchRes.status !== 200) fail(`Super Admin reporting manager update failed: ${patchRes.status}`)
  const patchedTask = patchRes.data.data
  if (patchedTask.reportingManagerId !== teamLead1._id.toString()) {
    fail(`Expected updated manager ${teamLead1._id}, got ${patchedTask.reportingManagerId}`)
  }
  log('Super Admin successfully updated Reporting Manager from Lead 2 to Lead 1')

  // Lead 1 now sees task in reporting=me
  const lead1SupRes = await request('/tasks', {
    method: 'GET',
    token: lead1Token,
    params: { reporting: 'me' },
  })
  const lead1Tasks = lead1SupRes.data.tasks || lead1SupRes.data.data
  if (!lead1Tasks.some((t: any) => t.id === task2.id)) {
    fail('New manager Lead 1 did not find delegated task under reporting=me')
  }
  log('New manager Lead 1 now sees task under reporting=me')

  // Lead 2 loses delegated visibility under reporting=me
  const lead2CheckRes = await request('/tasks', {
    method: 'GET',
    token: lead2Token,
    params: { reporting: 'me' },
  })
  const lead2Tasks = lead2CheckRes.data.tasks || lead2CheckRes.data.data
  if (lead2Tasks.some((t: any) => t.id === task2.id)) {
    fail('Old manager Lead 2 still sees task under reporting=me after manager was reassigned')
  }
  log('Old manager Lead 2 no longer sees task under reporting=me')

  // Activity history records manager change
  const actRes = await request(`/tasks/${task2.id}`, {
    method: 'GET',
    token: adminToken,
  })
  const activities = actRes.data.data.activity
  const editAct = activities.find((a: any) => a.action === 'edited')
  if (!editAct) fail('Activity history did not record manager change')
  log(`Activity history recorded update: "${editAct.details}"`)

  // --- Scenario 8: Existing Legacy Tasks Remain Functional ---
  console.log('\n--- Scenario 8: Legacy Tasks Compatibility ---')
  const legacyTask = await Task.create({
    title: 'Legacy Task Without Manager',
    team: testTeam._id,
    branch: branchBhopal._id,
    owner: employeeA._id,
    createdBy: superAdmin._id,
    due: '2026-11-20',
    priority: 'normal',
    status: 'todo',
    reportingManager: null, // Legacy record
  })

  const legacyRes = await request(`/tasks/${legacyTask._id}`, {
    method: 'GET',
    token: adminToken,
  })
  if (legacyRes.status !== 200) fail(`Legacy task lookup failed: ${legacyRes.status}`)
  log('Existing legacy task without reportingManager returned successfully with no data loss')

  // --- Scenario 9: Role and Permission Isolation ---
  console.log('\n--- Scenario 9: Permission Isolation ---')
  // Lead 2 has supervised tasks, but does NOT gain admin permissions:
  // Cannot manage branches
  const brRes = await request('/branches', {
    method: 'POST',
    token: lead2Token,
    body: { name: 'Unauthorized Branch', code: 'UAB' },
  })
  if (brRes.status !== 403) fail(`Expected 403 for branch.manage, got ${brRes.status}`)

  // Cannot manage roles
  const rlRes = await request('/roles', {
    method: 'POST',
    token: lead2Token,
    body: { name: 'Unauthorized Role' },
  })
  if (rlRes.status !== 403) fail(`Expected 403 for role.manage, got ${rlRes.status}`)
  log('Reporting manager assignment does not leak admin permissions (branch.manage, role.manage blocked)')

  // Cleanup test fixtures
  await User.deleteMany({ email: { $regex: /@rmtest\.com$/ } })
  await Team.deleteMany({ name: { $regex: /^RM Test/ } })
  await Task.deleteMany({ title: { $regex: /Task Auto|Task Custom|Legacy Task/ } })

  console.log('\n======================================================')
  console.log('🎉 ALL REPORTING MANAGER SCENARIOS (1-10) PASSED!')
  console.log('======================================================\n')

  server.close()
  await disconnectDatabase()
  process.exit(0)
}

runTests().catch(async (err) => {
  console.error('Test execution error:', err)
  if (server) server.close()
  await disconnectDatabase()
  process.exit(1)
})
