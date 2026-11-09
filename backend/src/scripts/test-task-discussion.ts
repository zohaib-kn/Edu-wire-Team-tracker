/**
 * Integration Test Suite: Task Discussion Feature (Phase 1)
 * Covers Scenarios 1 through 16 directly and prepares assertions for full test compliance.
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
import { TaskMessage } from '../models/TaskMessage.js'
import { tokenService } from '../services/token.service.js'
import { passwordService } from '../services/password.service.js'
import { getTodayDateIST } from '../utils/dateUtils.js'

let server: http.Server
let baseUrl: string

function log(msg: string) {
  console.log(`  ✓ ${msg}`)
}

function fail(msg: string): never {
  console.error(`  ❌ ${msg}`)
  throw new Error(`Test failed: ${msg}`)
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
  console.log('\n🧪 Starting Task Discussion Feature (Phase 1) Test Suite...\n')

  setRedisMockMode(true)
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

  // -----------------------------------------------------------------
  // Setup Fixtures
  // -----------------------------------------------------------------
  console.log('\n--- Setup: Test Fixtures ---')
  const superAdminRole = await Role.findOne({ name: 'Super Admin' })
  const branchAdminRole = await Role.findOne({ name: 'Branch Admin' })
  const teamLeadRole = await Role.findOne({ name: 'Team Lead' })
  const memberRole = await Role.findOne({ name: 'Member' })

  if (!superAdminRole || !branchAdminRole || !teamLeadRole || !memberRole) {
    fail('Required system roles missing in database')
  }

  let branchBhopal = await Branch.findOne({ name: 'Bhopal' })
  if (!branchBhopal) {
    branchBhopal = await Branch.create({ name: 'Bhopal', city: 'Bhopal' })
  }
  let branchIndore = await Branch.findOne({ name: 'Indore' })
  if (!branchIndore) {
    branchIndore = await Branch.create({ name: 'Indore', city: 'Indore' })
  }

  // Clean prior test fixtures
  await TaskMessage.deleteMany({})
  await User.deleteMany({ email: { $regex: /@discussiontest\.com$/ } })
  await Team.deleteMany({ name: { $regex: /^DiscTest/ } })
  await Task.deleteMany({ title: { $regex: /^DiscTest/ } })

  const pwdHash = await passwordService.hashPassword('Password123')

  // Super Admin
  const superAdmin = await User.create({
    name: 'Super Admin Disc',
    email: 'superadmin@discussiontest.com',
    passwordHash: pwdHash,
    role: superAdminRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
  })
  const superAdminToken = tokenService.generateAccessToken({
    userId: superAdmin._id.toString(),
    email: superAdmin.email,
    role: 'Super Admin',
  })

  // Bhopal Branch Admin
  const bhopalBranchAdmin = await User.create({
    name: 'Branch Admin Bhopal',
    email: 'bhopal.admin@discussiontest.com',
    passwordHash: pwdHash,
    role: branchAdminRole._id,
    branch: branchBhopal._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
  })
  const bhopalAdminToken = tokenService.generateAccessToken({
    userId: bhopalBranchAdmin._id.toString(),
    email: bhopalBranchAdmin.email,
    role: 'Branch Admin',
  })

  // Indore Branch Admin
  const indoreBranchAdmin = await User.create({
    name: 'Branch Admin Indore',
    email: 'indore.admin@discussiontest.com',
    passwordHash: pwdHash,
    role: branchAdminRole._id,
    branch: branchIndore._id,
    teams: [],
    isActive: true,
    mustChangePassword: false,
  })
  const indoreAdminToken = tokenService.generateAccessToken({
    userId: indoreBranchAdmin._id.toString(),
    email: indoreBranchAdmin.email,
    role: 'Branch Admin',
  })

  // Teams in Bhopal
  const teamAdmissions = await Team.create({
    name: 'DiscTest Admissions Bhopal',
    branch: branchBhopal._id,
    isActive: true,
  })

  const teamVisa = await Team.create({
    name: 'DiscTest Visa Bhopal',
    branch: branchBhopal._id,
    isActive: true,
  })

  // Team in Indore
  const teamIndore = await Team.create({
    name: 'DiscTest Indore Desk',
    branch: branchIndore._id,
    isActive: true,
  })

  // Indore Team Lead
  const indoreLead = await User.create({
    name: 'Lead Indore',
    email: 'indore.lead@discussiontest.com',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchIndore._id,
    teams: [teamIndore._id],
    isActive: true,
    mustChangePassword: false,
  })
  teamIndore.lead = indoreLead._id as any
  await teamIndore.save()

  // Bhopal Admissions Team Lead
  const admissionsLead = await User.create({
    name: 'Lead Admissions Bhopal',
    email: 'admissions.lead@discussiontest.com',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [teamAdmissions._id],
    isActive: true,
    mustChangePassword: false,
  })
  teamAdmissions.lead = admissionsLead._id as any
  await teamAdmissions.save()
  const admissionsLeadToken = tokenService.generateAccessToken({
    userId: admissionsLead._id.toString(),
    email: admissionsLead.email,
    role: 'Team Lead',
  })

  // Bhopal Visa Team Lead
  const visaLead = await User.create({
    name: 'Lead Visa Bhopal',
    email: 'visa.lead@discussiontest.com',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [teamVisa._id],
    isActive: true,
    mustChangePassword: false,
  })
  teamVisa.lead = visaLead._id as any
  await teamVisa.save()
  const visaLeadToken = tokenService.generateAccessToken({
    userId: visaLead._id.toString(),
    email: visaLead.email,
    role: 'Team Lead',
  })

  // Bhopal Reporting Manager (Assigned supervisor from Visa team or another supervisory role)
  const reportingManager = await User.create({
    name: 'Reporting Manager Bhopal',
    email: 'manager.bhopal@discussiontest.com',
    passwordHash: pwdHash,
    role: teamLeadRole._id,
    branch: branchBhopal._id,
    teams: [teamVisa._id],
    isActive: true,
    mustChangePassword: false,
  })
  const reportingManagerToken = tokenService.generateAccessToken({
    userId: reportingManager._id.toString(),
    email: reportingManager.email,
    role: 'Team Lead',
  })

  // Bhopal Employee 1 (Assigned Owner on Task)
  const employee1 = await User.create({
    name: 'Employee One',
    email: 'emp1@discussiontest.com',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [teamAdmissions._id],
    isActive: true,
    mustChangePassword: false,
  })
  const employee1Token = tokenService.generateAccessToken({
    userId: employee1._id.toString(),
    email: employee1.email,
    role: 'Member',
  })

  // Bhopal Employee 2 (Unrelated member in same Admissions team)
  const employee2 = await User.create({
    name: 'Employee Two (Unrelated)',
    email: 'emp2@discussiontest.com',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchBhopal._id,
    teams: [teamAdmissions._id],
    isActive: true,
    mustChangePassword: false,
  })
  const employee2Token = tokenService.generateAccessToken({
    userId: employee2._id.toString(),
    email: employee2.email,
    role: 'Member',
  })

  // Indore Employee (Cross-branch member)
  const indoreEmployee = await User.create({
    name: 'Employee Indore',
    email: 'emp.indore@discussiontest.com',
    passwordHash: pwdHash,
    role: memberRole._id,
    branch: branchIndore._id,
    teams: [teamIndore._id],
    isActive: true,
    mustChangePassword: false,
  })
  const indoreEmployeeToken = tokenService.generateAccessToken({
    userId: indoreEmployee._id.toString(),
    email: indoreEmployee.email,
    role: 'Member',
  })

  // Create Primary Test Task in Admissions Desk Bhopal with explicit reporting manager
  const taskRes = await request('/tasks', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'DiscTest Primary Task: Student Document Verification',
      team: teamAdmissions._id.toString(),
      owner: employee1._id.toString(),
      reportingManager: reportingManager._id.toString(),
      due: getTodayDateIST(),
      priority: 'high',
      note: 'Verify incoming applicant dossiers',
    },
  })
  if (taskRes.status !== 201) {
    fail(`Failed to create primary test task. Status: ${taskRes.status}`)
  }
  const primaryTaskId = taskRes.data.task.id
  log(`Primary test task created: ${primaryTaskId}`)

  // Create Indore Task for cross-branch isolation tests
  const indoreTaskRes = await request('/tasks', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'DiscTest Indore Task',
      team: teamIndore._id.toString(),
      owner: indoreEmployee._id.toString(),
      due: getTodayDateIST(),
      priority: 'normal',
    },
  })
  if (indoreTaskRes.status !== 201) {
    fail('Failed to create Indore task')
  }
  const indoreTaskId = indoreTaskRes.data.task.id

  // -----------------------------------------------------------------
  // 1. Super Admin posts a question
  // -----------------------------------------------------------------
  console.log('\n--- Test 1: Super Admin posts a question ---')
  const qRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: superAdminToken,
    body: {
      body: 'Student documents kitne verify hue?',
      type: 'question',
    },
  })
  if (qRes.status !== 201) {
    fail(`Expected 201 for Super Admin question, got ${qRes.status}`)
  }
  const qMsg = qRes.data.message || qRes.data.data
  if (qMsg.type !== 'question') fail(`Expected type 'question', got ${qMsg.type}`)
  if (qMsg.body !== 'Student documents kitne verify hue?') fail('Message body mismatch')
  if (qMsg.sender.id !== superAdmin._id.toString()) fail('Sender ID mismatch')
  if (qMsg.sender.name !== 'Super Admin Disc') fail('Sender name mismatch')
  if (qMsg.sender.role !== 'Super Admin') fail('Sender role mismatch')
  if ((qMsg.sender as any).passwordHash || (qMsg.sender as any).tokens) {
    fail('Private credentials leaked in sender payload')
  }
  log('Super Admin posted question successfully: "Student documents kitne verify hue?"')

  // -----------------------------------------------------------------
  // 2. Task Owner reads the question
  // -----------------------------------------------------------------
  console.log('\n--- Test 2: Task Owner reads the question ---')
  const readRes1 = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: employee1Token,
  })
  if (readRes1.status !== 200) {
    fail(`Expected 200 for Task Owner reading messages, got ${readRes1.status}`)
  }
  const msgs1 = readRes1.data.messages || readRes1.data.data
  if (!Array.isArray(msgs1) || msgs1.length !== 1) {
    fail(`Expected 1 message, got ${msgs1?.length}`)
  }
  if (msgs1[0].body !== 'Student documents kitne verify hue?') {
    fail('Retrieved message body mismatch')
  }
  if (msgs1[0].sender.id !== superAdmin._id.toString()) {
    fail('Retrieved sender ID mismatch')
  }
  log('Task Owner read the Super Admin question successfully')

  // -----------------------------------------------------------------
  // 3. Employee posts a reply
  // -----------------------------------------------------------------
  console.log('\n--- Test 3: Employee posts a reply ---')
  const replyRes1 = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: employee1Token,
    body: {
      body: '18 complete hain, 2 pending hain.',
      type: 'reply',
    },
  })
  if (replyRes1.status !== 201) {
    fail(`Expected 201 for Employee reply, got ${replyRes1.status}`)
  }
  const empMsg = replyRes1.data.message || replyRes1.data.data
  if (empMsg.type !== 'reply') fail('Expected type reply')
  if (empMsg.sender.id !== employee1._id.toString()) fail('Sender ID mismatch')
  if (empMsg.sender.role !== 'Member') fail('Sender role mismatch')
  log('Employee posted reply successfully: "18 complete hain, 2 pending hain."')

  // -----------------------------------------------------------------
  // 4. Reporting Manager reads and replies
  // -----------------------------------------------------------------
  console.log('\n--- Test 4: Reporting Manager reads and replies ---')
  const rmReadRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: reportingManagerToken,
  })
  if (rmReadRes.status !== 200) {
    fail(`Expected 200 for Reporting Manager reading messages, got ${rmReadRes.status}`)
  }
  const rmMsgs = rmReadRes.data.messages || rmReadRes.data.data
  if (!Array.isArray(rmMsgs) || rmMsgs.length !== 2) {
    fail(`Expected 2 messages, got ${rmMsgs?.length}`)
  }

  const rmReplyRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: reportingManagerToken,
    body: {
      body: 'Remaining 2 kal complete ho jayenge.',
      type: 'reply',
    },
  })
  if (rmReplyRes.status !== 201) {
    fail(`Expected 201 for Reporting Manager reply, got ${rmReplyRes.status}`)
  }
  const rmReplyMsg = rmReplyRes.data.message || rmReplyRes.data.data
  if (rmReplyMsg.sender.id !== reportingManager._id.toString()) fail('Reporting manager ID mismatch')
  log('Reporting Manager read 2 existing messages and replied: "Remaining 2 kal complete ho jayenge."')

  // -----------------------------------------------------------------
  // 5. Branch Admin accesses only authorized tasks
  // -----------------------------------------------------------------
  console.log('\n--- Test 5: Branch Admin accesses only authorized tasks ---')
  const bhopalAdminAccess = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: bhopalAdminToken,
  })
  if (bhopalAdminAccess.status !== 200) {
    fail(`Bhopal Branch Admin should access Bhopal task, got ${bhopalAdminAccess.status}`)
  }
  log('Bhopal Branch Admin successfully accessed discussion for Bhopal task')

  const bhopalAdminIndoreAccess = await request(`/tasks/${indoreTaskId}/messages`, {
    method: 'GET',
    token: bhopalAdminToken,
  })
  if (bhopalAdminIndoreAccess.status !== 403) {
    fail(`Bhopal Branch Admin accessing Indore task should return 403, got ${bhopalAdminIndoreAccess.status}`)
  }
  log('Bhopal Branch Admin blocked from Indore task (403 Forbidden)')

  // -----------------------------------------------------------------
  // 6. Team Lead accesses only authorized team tasks
  // -----------------------------------------------------------------
  console.log('\n--- Test 6: Team Lead accesses only authorized team tasks ---')
  // Admissions Lead accesses Admissions task
  const admissionsLeadAccess = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: admissionsLeadToken,
  })
  if (admissionsLeadAccess.status !== 200) {
    fail(`Admissions Lead should access Admissions task, got ${admissionsLeadAccess.status}`)
  }
  log('Admissions Team Lead accessed authorized Admissions team task')

  // Visa Lead attempts to access Admissions task (Visa Lead is not owner, not reporting manager, not team lead of admissions)
  const visaLeadAccess = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: visaLeadToken,
  })
  if (visaLeadAccess.status !== 403) {
    fail(`Visa Lead accessing Admissions task should return 403, got ${visaLeadAccess.status}`)
  }
  log('Visa Team Lead blocked from unauthorized Admissions team task (403 Forbidden)')

  // -----------------------------------------------------------------
  // 7. Unrelated employee receives 403
  // -----------------------------------------------------------------
  console.log('\n--- Test 7: Unrelated employee receives 403 ---')
  // Employee 2 is Member in Admissions team, but is NOT the task owner and NOT reporting manager
  const emp2Get = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: employee2Token,
  })
  if (emp2Get.status !== 403) {
    fail(`Unrelated employee GET should return 403, got ${emp2Get.status}`)
  }

  const emp2Post = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: employee2Token,
    body: {
      body: 'Can I view this conversation?',
      type: 'reply',
    },
  })
  if (emp2Post.status !== 403) {
    fail(`Unrelated employee POST should return 403, got ${emp2Post.status}`)
  }
  log('Unrelated employee correctly received 403 Forbidden for both GET and POST')

  // -----------------------------------------------------------------
  // 8. Cross-branch access is denied
  // -----------------------------------------------------------------
  console.log('\n--- Test 8: Cross-branch access is denied ---')
  const indoreAdminOnBhopal = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: indoreAdminToken,
  })
  if (indoreAdminOnBhopal.status !== 403) {
    fail(`Indore Branch Admin accessing Bhopal task should return 403, got ${indoreAdminOnBhopal.status}`)
  }

  const indoreEmpOnBhopal = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: indoreEmployeeToken,
    body: {
      body: 'Cross-branch test message',
      type: 'question',
    },
  })
  if (indoreEmpOnBhopal.status !== 403) {
    fail(`Indore Employee posting on Bhopal task should return 403, got ${indoreEmpOnBhopal.status}`)
  }
  log('Cross-branch access strictly denied (403 Forbidden)')

  // -----------------------------------------------------------------
  // 9. Invalid task ID is rejected
  // -----------------------------------------------------------------
  console.log('\n--- Test 9: Invalid task ID is rejected ---')
  const malformedGet = await request('/tasks/invalid-task-id-123/messages', {
    method: 'GET',
    token: superAdminToken,
  })
  if (malformedGet.status !== 400) {
    fail(`Expected 400 for malformed task ID, got ${malformedGet.status}`)
  }

  const malformedPost = await request('/tasks/invalid-task-id-123/messages', {
    method: 'POST',
    token: superAdminToken,
    body: {
      body: 'Testing invalid task ID',
      type: 'question',
    },
  })
  if (malformedPost.status !== 400) {
    fail(`Expected 400 for malformed task ID POST, got ${malformedPost.status}`)
  }

  const nonExistentId = new mongoose.Types.ObjectId().toString()
  const notFoundGet = await request(`/tasks/${nonExistentId}/messages`, {
    method: 'GET',
    token: superAdminToken,
  })
  if (notFoundGet.status !== 404) {
    fail(`Expected 404 for non-existent task ID, got ${notFoundGet.status}`)
  }
  log('Invalid task ID (both malformed and non-existent) correctly rejected')

  // -----------------------------------------------------------------
  // 10. Empty message is rejected
  // -----------------------------------------------------------------
  console.log('\n--- Test 10: Empty message is rejected ---')
  const emptyBodyRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: superAdminToken,
    body: {
      body: '',
      type: 'question',
    },
  })
  if (emptyBodyRes.status !== 400) {
    fail(`Expected 400 for empty body, got ${emptyBodyRes.status}`)
  }

  const whitespaceBodyRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: superAdminToken,
    body: {
      body: '     ',
      type: 'question',
    },
  })
  if (whitespaceBodyRes.status !== 400) {
    fail(`Expected 400 for whitespace body, got ${whitespaceBodyRes.status}`)
  }

  const invalidTypeRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: superAdminToken,
    body: {
      body: 'Valid message body',
      type: 'invalid_type_enum',
    },
  })
  if (invalidTypeRes.status !== 400) {
    fail(`Expected 400 for invalid message type, got ${invalidTypeRes.status}`)
  }
  log('Empty, whitespace-only, and invalid message types rejected with 400 Bad Request')

  // -----------------------------------------------------------------
  // 11. Hindi/Hinglish content is preserved
  // -----------------------------------------------------------------
  console.log('\n--- Test 11: Hindi/Hinglish content is preserved ---')
  const hindiQuestion = 'काम कितना बचा है? क्या सभी दस्तावेज प्राप्त हो गए?'
  const hindiPostRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: superAdminToken,
    body: {
      body: hindiQuestion,
      type: 'question',
    },
  })
  if (hindiPostRes.status !== 201) {
    fail(`Expected 201 for Hindi question post, got ${hindiPostRes.status}`)
  }

  const hinglishReply = 'Sir, 18 documents verify ho gaye hain, 2 baaki hain. Sham tak sab complete ho jayega.'
  const hinglishPostRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: employee1Token,
    body: {
      body: hinglishReply,
      type: 'reply',
    },
  })
  if (hinglishPostRes.status !== 201) {
    fail(`Expected 201 for Hinglish reply post, got ${hinglishPostRes.status}`)
  }

  const fetchUnicodeRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: employee1Token,
  })
  if (fetchUnicodeRes.status !== 200) {
    fail('Failed to fetch messages for Unicode check')
  }
  const unicodeList = fetchUnicodeRes.data.messages || fetchUnicodeRes.data.data
  const foundHindi = unicodeList.find((m: any) => m.body === hindiQuestion)
  const foundHinglish = unicodeList.find((m: any) => m.body === hinglishReply)

  if (!foundHindi) fail('Hindi Unicode text was not preserved accurately')
  if (!foundHinglish) fail('Hinglish text was not preserved accurately')
  log('Hindi (Devanagari) and Hinglish content preserved with 100% character fidelity')

  // -----------------------------------------------------------------
  // 12. Pagination returns correct ordering
  // -----------------------------------------------------------------
  console.log('\n--- Test 12: Pagination returns correct ordering ---')
  // Total messages on primaryTaskId so far: 3 initial + 2 unicode = 5 messages
  const page1Res = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: superAdminToken,
    params: { limit: '2' },
  })
  if (page1Res.status !== 200) fail('Failed page 1 fetch')
  const page1Data = page1Res.data
  const page1Msgs = page1Data.messages || page1Data.data
  if (page1Msgs.length !== 2) fail(`Expected 2 items in page 1, got ${page1Msgs.length}`)
  if (!page1Data.hasMore) fail('Expected hasMore=true for page 1')
  if (!page1Data.nextCursor) fail('Expected non-null nextCursor for page 1')

  // Verify chronological order (page1Msgs[0] <= page1Msgs[1])
  const t0 = new Date(page1Msgs[0].createdAt).getTime()
  const t1 = new Date(page1Msgs[1].createdAt).getTime()
  if (t0 > t1) fail('Messages are not returned in chronological order')

  // Fetch Page 2 with cursor
  const page2Res = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: superAdminToken,
    params: { limit: '2', cursor: page1Data.nextCursor },
  })
  if (page2Res.status !== 200) fail('Failed page 2 fetch')
  const page2Data = page2Res.data
  const page2Msgs = page2Data.messages || page2Data.data
  if (page2Msgs.length !== 2) fail(`Expected 2 items in page 2, got ${page2Msgs.length}`)
  if (!page2Data.hasMore) fail('Expected hasMore=true for page 2')

  // Verify page 2 is strictly after page 1
  const t2 = new Date(page2Msgs[0].createdAt).getTime()
  if (t2 < t1) fail('Cursor pagination failed to return chronologically subsequent records')

  // Fetch Page 3 (remaining 1 message)
  const page3Res = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: superAdminToken,
    params: { limit: '2', cursor: page2Data.nextCursor },
  })
  const page3Data = page3Res.data
  const page3Msgs = page3Data.messages || page3Data.data
  if (page3Msgs.length !== 1) fail(`Expected 1 item in page 3, got ${page3Msgs.length}`)
  if (page3Data.hasMore) fail('Expected hasMore=false for final page')
  if (page3Data.nextCursor !== null) fail('Expected nextCursor=null for final page')

  log('Chronological pagination & cursor traversal verified successfully')

  // -----------------------------------------------------------------
  // 13. Messages remain after task completion
  // -----------------------------------------------------------------
  console.log('\n--- Test 13: Messages remain after task completion ---')
  // Employee 1 completes task
  const doneRes = await request(`/tasks/${primaryTaskId}/status`, {
    method: 'PATCH',
    token: employee1Token,
    body: { status: 'done' },
  })
  if (doneRes.status !== 200) fail('Failed to mark task done')
  if (doneRes.data.task.status !== 'done') fail('Task status is not done')

  // Fetch messages after task marked done
  const msgsAfterDoneRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: employee1Token,
  })
  if (msgsAfterDoneRes.status !== 200) fail('Failed to fetch messages for completed task')
  const msgsAfterDone = msgsAfterDoneRes.data.messages || msgsAfterDoneRes.data.data
  if (msgsAfterDone.length !== 5) {
    fail(`Expected all 5 messages to remain after task completion, got ${msgsAfterDone.length}`)
  }
  log('All 5 discussion messages remained intact after task was marked Done')

  // -----------------------------------------------------------------
  // 14. Messages remain after task reopening
  // -----------------------------------------------------------------
  console.log('\n--- Test 14: Messages remain after task reopening ---')
  // Super Admin reopens task
  const reopenRes = await request(`/tasks/${primaryTaskId}/status`, {
    method: 'PATCH',
    token: superAdminToken,
    body: { status: 'doing' },
  })
  if (reopenRes.status !== 200) fail('Failed to reopen task')
  if (reopenRes.data.task.status !== 'doing') fail('Task status is not doing')

  // Post message on reopened task
  const postAfterReopenRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: superAdminToken,
    body: {
      body: 'Task has been reopened for additional verification.',
      type: 'instruction',
    },
  })
  if (postAfterReopenRes.status !== 201) fail('Failed to post message on reopened task')

  const msgsAfterReopenRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: reportingManagerToken,
  })
  const msgsAfterReopen = msgsAfterReopenRes.data.messages || msgsAfterReopenRes.data.data
  if (msgsAfterReopen.length !== 6) {
    fail(`Expected 6 messages after reopening, got ${msgsAfterReopen.length}`)
  }
  log('Messages preserved through reopening and new instruction successfully attached')

  // -----------------------------------------------------------------
  // 15. Posting "Ho gaya" does not change task status
  // -----------------------------------------------------------------
  console.log('\n--- Test 15: Posting "Ho gaya" does not change task status ---')
  // Verify current status is 'doing'
  const taskBeforeMsg = await Task.findById(primaryTaskId).exec()
  if (taskBeforeMsg?.status !== 'doing') fail('Task should currently be in doing status')

  // Employee posts "Ho gaya sir."
  const hoGayaRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: employee1Token,
    body: {
      body: 'Ho gaya sir.',
      type: 'reply',
    },
  })
  if (hoGayaRes.status !== 201) fail('Failed to post reply')

  // Verify task status is STILL 'doing'
  const taskAfterMsg = await Task.findById(primaryTaskId).exec()
  if (taskAfterMsg?.status !== 'doing') {
    fail(`Task status was modified! Expected 'doing', got '${taskAfterMsg?.status}'`)
  }
  log('Posting "Ho gaya sir." did NOT mutate task status (still "doing")')

  // -----------------------------------------------------------------
  // 16. Posting instructions does not mutate task fields
  // -----------------------------------------------------------------
  console.log('\n--- Test 16: Posting instructions does not mutate task fields ---')
  const taskSnapshotBefore = await Task.findById(primaryTaskId).lean().exec()
  if (!taskSnapshotBefore) fail('Task not found before instruction post')

  const instructionRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'POST',
    token: superAdminToken,
    body: {
      body: 'Is task mein 5 aur documents verify karo.',
      type: 'instruction',
    },
  })
  if (instructionRes.status !== 201) fail('Failed to post instruction')

  const taskSnapshotAfter = await Task.findById(primaryTaskId).lean().exec()
  if (!taskSnapshotAfter) fail('Task not found after instruction post')

  if (taskSnapshotAfter.title !== taskSnapshotBefore.title) fail('Task title was mutated')
  if (taskSnapshotAfter.note !== taskSnapshotBefore.note) fail('Task note was mutated')
  if (taskSnapshotAfter.due !== taskSnapshotBefore.due) fail('Task due date was mutated')
  if (taskSnapshotAfter.priority !== taskSnapshotBefore.priority) fail('Task priority was mutated')
  if (taskSnapshotAfter.owner.toString() !== taskSnapshotBefore.owner.toString()) fail('Task owner was mutated')
  if (
    taskSnapshotAfter.reportingManager?.toString() !==
    taskSnapshotBefore.reportingManager?.toString()
  ) {
    fail('Task reportingManager was mutated')
  }
  if (taskSnapshotAfter.status !== taskSnapshotBefore.status) fail('Task status was mutated')
  log('Posting instruction message did NOT mutate any task fields (title, note, due, priority, owner, manager)')

  // -----------------------------------------------------------------
  // Extra: Soft-deleted task discussions must not be accessible
  // -----------------------------------------------------------------
  console.log('\n--- Extra Verification: Soft-deleted task discussion isolation ---')
  const deleteRes = await request(`/tasks/${primaryTaskId}`, {
    method: 'DELETE',
    token: superAdminToken,
  })
  if (deleteRes.status !== 200) fail('Failed to soft-delete task')

  const getDeletedMessagesRes = await request(`/tasks/${primaryTaskId}/messages`, {
    method: 'GET',
    token: employee1Token,
  })
  if (getDeletedMessagesRes.status !== 404) {
    fail(`Expected 404 for soft-deleted task discussion, got ${getDeletedMessagesRes.status}`)
  }

  // Verify TaskMessage records still exist in database (not cascade deleted)
  const remainingCount = await TaskMessage.countDocuments({ task: primaryTaskId }).exec()
  if (remainingCount !== 8) {
    fail(`Expected 8 messages to persist in DB without cascade delete, got ${remainingCount}`)
  }
  log('Soft-deleted task returns 404 for discussion and messages are safely preserved in database')

  // -----------------------------------------------------------------
  // Cleanup Fixtures
  // -----------------------------------------------------------------
  await TaskMessage.deleteMany({})
  await User.deleteMany({ email: { $regex: /@discussiontest\.com$/ } })
  await Team.deleteMany({ name: { $regex: /^DiscTest/ } })
  await Task.deleteMany({ title: { $regex: /^DiscTest/ } })

  console.log('\n===============================================================')
  console.log('🎉 ALL 16 DIRECT INTEGRATION TEST SCENARIOS PASSED SUCCESSFULLY!')
  console.log('===============================================================\n')

  await closeAllQueues()
  await closeRedisConnections()
  server.close()
  await disconnectDatabase()
  process.exit(0)
}

runTests().catch(async (err) => {
  console.error('\n❌ Test execution failed with error:', err)
  try {
    await closeAllQueues()
    await closeRedisConnections()
    if (server) server.close()
    await disconnectDatabase()
  } catch {}
  process.exit(1)
})
