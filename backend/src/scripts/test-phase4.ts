import type { Server } from 'node:http'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { setRedisMockMode, closeRedisConnections } from '../config/redis.js'
import { closeAllQueues } from '../queues/queue.manager.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { Task } from '../models/Task.js'
import { Session } from '../models/Session.js'
import { Activity } from '../models/Activity.js'
import { tokenService } from '../services/token.service.js'
import { passwordService } from '../services/password.service.js'
import { getTodayDateIST } from '../utils/dateUtils.js'

let server: Server
let baseUrl: string

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`  ✓ ${message}`)
}

async function runTests() {
  console.log('🧪 Starting Backend Phase 4: Administration, Organizational Structure & Reports Test Suite...\n')

  setRedisMockMode(true)
  await connectDatabase()

  // Start server on an ephemeral port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 5000
      baseUrl = `http://127.0.0.1:${port}/api/v1`
      console.log(`📡 Test server running at ${baseUrl}\n`)
      resolve()
    })
  })

  try {
    // ---------------------------------------------------------------
    // Step 1: Bootstrap Test Roles & Super Admin
    // ---------------------------------------------------------------
    console.log('--- Step 1: Auth & Role Setup ---')
    const superAdminRole = await Role.findOne({ name: 'Super Admin' })
    const branchAdminRole = await Role.findOne({ name: 'Branch Admin' })
    const teamLeadRole = await Role.findOne({ name: 'Team Lead' })
    const memberRole = await Role.findOne({ name: 'Member' })

    assert(Boolean(superAdminRole && branchAdminRole && teamLeadRole && memberRole), 'All 4 default system roles exist in DB')

    // Find or create test super admin
    const superAdmin = await User.findOne({ email: 'zohaib.works022@gmail.com' }).populate('role')
    assert(Boolean(superAdmin), 'Super Admin user account exists')

    const superAdminToken = tokenService.generateAccessToken({
      userId: superAdmin!._id.toString(),
      email: superAdmin!.email,
      role: 'Super Admin',
    })

    const bhopalBranch = await Branch.findOne({ name: 'Bhopal' })
    assert(Boolean(bhopalBranch), 'Bhopal branch exists')

    const admissionsTeam = await Team.findOne({ name: 'Admissions Desk', branch: bhopalBranch!._id })
    assert(Boolean(admissionsTeam), 'Admissions Desk team in Bhopal exists')

    // ---------------------------------------------------------------
    // Step 2: Branch Management (POST, GET, PATCH /branches)
    // ---------------------------------------------------------------
    console.log('\n--- Step 2: Branch Management Tests ---')
    const testBranchName = `Test Branch ${Date.now()}`
    const createBranchRes = await fetch(`${baseUrl}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: testBranchName,
        city: 'Jabalpur',
      }),
    })
    const createBranchJson = (await createBranchRes.json()) as any
    assert(createBranchRes.status === 201, `POST /branches creates branch (Status: ${createBranchRes.status})`)
    assert(createBranchJson.branch && createBranchJson.branch.name === testBranchName, 'Created branch returned with correct name')
    const testBranchId = createBranchJson.branch.id

    // Duplicate branch name rejected
    const dupBranchRes = await fetch(`${baseUrl}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: testBranchName,
        city: 'Jabalpur',
      }),
    })
    assert(dupBranchRes.status === 409, 'Duplicate branch name returns 409 Conflict')

    // Update branch
    const updateBranchRes = await fetch(`${baseUrl}/branches/${testBranchId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        city: 'Gwalior',
      }),
    })
    const updateBranchJson = (await updateBranchRes.json()) as any
    assert(updateBranchRes.status === 200, 'PATCH /branches/:id updates branch')
    assert(updateBranchJson.branch.city === 'Gwalior', 'Branch city successfully updated')

    // Read branches list
    const getBranchesRes = await fetch(`${baseUrl}/branches`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const getBranchesJson = (await getBranchesRes.json()) as any
    assert(getBranchesRes.status === 200, 'GET /branches returns 200')
    assert(Array.isArray(getBranchesJson.branches) && getBranchesJson.branches.some((b: any) => b.id === testBranchId), 'New branch appears in branch listing')

    // ---------------------------------------------------------------
    // Step 3: Team Management (POST, GET, PATCH /teams)
    // ---------------------------------------------------------------
    console.log('\n--- Step 3: Team Management Tests ---')
    const testTeamName = `Test Team ${Date.now()}`
    const createTeamRes = await fetch(`${baseUrl}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: testTeamName,
        branch: testBranchId,
      }),
    })
    const createTeamJson = (await createTeamRes.json()) as any
    assert(createTeamRes.status === 201, `POST /teams creates team (Status: ${createTeamRes.status})`)
    assert(createTeamJson.team && createTeamJson.team.name === testTeamName, 'Created team returned with correct name')
    const testTeamId = createTeamJson.team.id

    // Duplicate team in same branch rejected
    const dupTeamRes = await fetch(`${baseUrl}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: testTeamName,
        branch: testBranchId,
      }),
    })
    assert(dupTeamRes.status === 409, 'Duplicate team in same branch returns 409 Conflict')

    // Update team
    const updateTeamRes = await fetch(`${baseUrl}/teams/${testTeamId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `${testTeamName} Updated`,
      }),
    })
    const updateTeamJson = (await updateTeamRes.json()) as any
    assert(updateTeamRes.status === 200, 'PATCH /teams/:id updates team')
    assert(updateTeamJson.team.name === `${testTeamName} Updated`, 'Team name successfully updated')

    // ---------------------------------------------------------------
    // Step 4: User Administration (POST, GET, PATCH, Reset Password /users)
    // ---------------------------------------------------------------
    console.log('\n--- Step 4: User Administration Tests ---')
    const testUserEmail = `staff_${Date.now()}@eduwire.test`
    const createUserRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Staff Test User',
        email: testUserEmail,
        phone: '+919876543210',
        role: 'Member',
        branch: bhopalBranch!._id.toString(),
        teams: [admissionsTeam!._id.toString()],
        temporaryPassword: 'TempPassword@123',
      }),
    })
    const createUserJson = (await createUserRes.json()) as any
    assert(createUserRes.status === 201, `POST /users creates employee (Status: ${createUserRes.status})`)
    assert(createUserJson.user && createUserJson.user.email === testUserEmail, 'Created user returned with correct email')
    assert(createUserJson.user.role === 'Member', 'Created user assigned Member role')
    assert(createUserJson.user.branch === bhopalBranch!.name, 'Created user branch set to Bhopal')
    assert(createUserJson.user.teams.includes('Admissions Desk'), 'Created user assigned to Admissions Desk')
    assert(Boolean(createUserJson.user.temporaryPassword), 'Temporary password returned in creation response')

    const createdUserId = createUserJson.user.id

    // Verify User record in DB has mustChangePassword = false and hashed password
    const dbUser = await User.findById(createdUserId).select('+passwordHash')
    assert(Boolean(dbUser), 'User found in database')
    assert(dbUser!.mustChangePassword === false, 'New user initialized with mustChangePassword = false')
    assert(dbUser!.passwordHash.startsWith('$2b$'), 'Password saved as bcrypt hash, not plaintext')

    // Duplicate email rejected
    const dupUserRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Duplicate Staff',
        email: testUserEmail,
        role: 'Member',
        branch: bhopalBranch!._id.toString(),
      }),
    })
    assert(dupUserRes.status === 409, 'Duplicate user email returns 409 Conflict')

    // Cross-branch team assignment rejected
    const crossBranchUserRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Cross Branch Staff',
        email: `cross_${Date.now()}@eduwire.test`,
        role: 'Member',
        branch: bhopalBranch!._id.toString(),
        teams: [testTeamId], // testTeam belongs to testBranchId (Jabalpur), not Bhopal
      }),
    })
    assert(crossBranchUserRes.status === 400, 'Cross-branch team assignment rejected with 400 Bad Request')

    // Update user details
    const updateUserRes = await fetch(`${baseUrl}/users/${createdUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        phone: '+919999999999',
      }),
    })
    const updateUserJson = (await updateUserRes.json()) as any
    assert(updateUserRes.status === 200, 'PATCH /users/:id updates user details')
    assert(updateUserJson.user.phone === '+919999999999', 'Phone number updated')

    // Reset password
    const resetPassRes = await fetch(`${baseUrl}/users/${createdUserId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
    })
    const resetPassJson = (await resetPassRes.json()) as any
    assert(resetPassRes.status === 200, 'POST /users/:id/reset-password returns 200')
    assert(Boolean(resetPassJson.temporaryPassword), 'Temporary password issued in reset response')

    const dbUserAfterReset = await User.findById(createdUserId)
    assert(dbUserAfterReset!.mustChangePassword === false, 'mustChangePassword remains false after reset')

    // Self role modification guardrail
    const selfRoleRes = await fetch(`${baseUrl}/users/${superAdmin!._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        role: 'Member',
      }),
    })
    assert(selfRoleRes.status === 403, 'Self role change blocked with 403 Forbidden')

    // ---------------------------------------------------------------
    // Step 5: Roles & Permissions (GET, POST, PATCH /roles)
    // ---------------------------------------------------------------
    console.log('\n--- Step 5: Roles & Permissions Tests ---')
    const getRolesRes = await fetch(`${baseUrl}/roles`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const getRolesJson = (await getRolesRes.json()) as any
    assert(getRolesRes.status === 200, 'GET /roles returns 200')
    assert(Array.isArray(getRolesJson.roles) && getRolesJson.roles.length >= 4, 'Returns all system roles')

    const memberRoleItem = getRolesJson.roles.find((r: any) => r.name === 'Member')
    assert(Boolean(memberRoleItem), 'Member role returned in role list')
    assert(Array.isArray(memberRoleItem.permissions), 'Member role has structured permissions array')

    // Update role permissions
    const updateRoleRes = await fetch(`${baseUrl}/roles/${memberRole!._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        permissions: [
          { permission: 'task.view', scope: 'own' },
          { permission: 'task.status', scope: 'own' },
        ],
      }),
    })
    const updateRoleJson = (await updateRoleRes.json()) as any
    assert(updateRoleRes.status === 200, 'PATCH /roles/:id updates role permissions')
    assert(updateRoleJson.role.permissions.some((p: any) => p.permission === 'task.status' && p.scope === 'own'), 'Updated role permissions persisted')

    // Rename system role blocked (tested on Branch Admin role since Super Admin cannot edit own role)
    const renameSystemRes = await fetch(`${baseUrl}/roles/${branchAdminRole!._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Custom Admin Name',
        permissions: [],
      }),
    })
    assert(renameSystemRes.status === 400, 'Renaming system role rejected with 400 Bad Request')

    // ---------------------------------------------------------------
    // Step 6: Reports Backend (GET /reports/daily & GET /reports/weekly)
    // ---------------------------------------------------------------
    console.log('\n--- Step 6: Reports Backend Tests ---')
    // Member access denied
    const memberToken = tokenService.generateAccessToken({
      userId: createdUserId,
      email: testUserEmail,
      role: 'Member',
    })

    const memberReportRes = await fetch(`${baseUrl}/reports/daily`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    assert(memberReportRes.status === 403, 'Member access to reports denied with 403 Forbidden')

    // Super Admin Daily Report
    const dailyReportRes = await fetch(`${baseUrl}/reports/daily?branch=${bhopalBranch!._id}&team=${admissionsTeam!._id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const dailyReportJson = (await dailyReportRes.json()) as any
    assert(dailyReportRes.status === 200, 'GET /reports/daily returns 200')
    assert(typeof dailyReportJson.reportText === 'string' && dailyReportJson.reportText.length > 0, 'Daily report returns non-empty formatted reportText')
    assert(dailyReportJson.reportText.includes('DAILY PENDING TASKS REPORT'), 'Report text contains valid header')

    // Super Admin Weekly Performance Report
    const weeklyReportRes = await fetch(`${baseUrl}/reports/weekly`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const weeklyReportJson = (await weeklyReportRes.json()) as any
    assert(weeklyReportRes.status === 200, 'GET /reports/weekly returns 200')
    assert(typeof weeklyReportJson.completed === 'number', 'Weekly report has completed count')
    assert(typeof weeklyReportJson.pending === 'number', 'Weekly report has pending count')
    assert(Array.isArray(weeklyReportJson.teams) && weeklyReportJson.teams.length > 0, 'Weekly report contains teams breakdown')

    // ---------------------------------------------------------------
    // Step 7: MANDATORY FULL WORKFLOW VERIFICATION
    // Admin creates employee -> Team Lead selects employee -> Team Lead assigns task ->
    // Employee opens My Tasks -> Employee marks Done directly -> Team Lead sees completion
    // ---------------------------------------------------------------
    console.log('\n--- Step 7: Complete Team Lead -> Employee Real Workflow Verification ---')

    // Scenario A: Administrator creates Employee A
    console.log('• Scenario A: Admin creates Employee A')
    const employeeAEmail = `emp_a_${Date.now()}@eduwire.test`
    const empARes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Employee Alpha',
        email: employeeAEmail,
        role: 'Member',
        branch: bhopalBranch!._id.toString(),
        teams: [admissionsTeam!._id.toString()],
        temporaryPassword: 'InitialPass@123',
      }),
    })
    const empAJson = (await empARes.json()) as any
    assert(empARes.status === 201, 'Scenario A: Admin successfully created Employee A')
    const employeeAId = empAJson.user.id

    // Create a Team Lead for Admissions Desk
    const teamLeadEmail = `lead_${Date.now()}@eduwire.test`
    const leadCreateRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Team Lead Admissions',
        email: teamLeadEmail,
        role: 'Team Lead',
        branch: bhopalBranch!._id.toString(),
        teams: [admissionsTeam!._id.toString()],
        temporaryPassword: 'LeadPass@123',
      }),
    })
    const leadCreateJson = (await leadCreateRes.json()) as any
    assert(leadCreateRes.status === 201, 'Created Team Lead account')
    const teamLeadId = leadCreateJson.user.id

    // Update team lead in Team model
    admissionsTeam!.lead = teamLeadId as any
    await admissionsTeam!.save()

    const teamLeadToken = tokenService.generateAccessToken({
      userId: teamLeadId,
      email: teamLeadEmail,
      role: 'Team Lead',
    })

    // Scenario B: Team Lead finds Employee A in team member dropdown and assigns task
    console.log('• Scenario B: Team Lead looks up members and assigns task to Employee A')
    const membersLookupRes = await fetch(`${baseUrl}/teams/${admissionsTeam!._id}/members`, {
      headers: { Authorization: `Bearer ${teamLeadToken}` },
    })
    const membersLookupJson = (await membersLookupRes.json()) as any
    assert(membersLookupRes.status === 200, 'GET /teams/:id/members succeeded')
    assert(membersLookupJson.members.some((m: any) => m.id === employeeAId), 'Employee A appears in Admissions Desk members dropdown')

    const todayDate = getTodayDateIST()
    const taskCreateRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teamLeadToken}`,
      },
      body: JSON.stringify({
        title: 'Review Visa Applications Batch #12',
        note: 'Process applications for incoming UK students',
        team: admissionsTeam!._id.toString(),
        owner: employeeAId,
        due: todayDate,
        priority: 'high',
      }),
    })
    const taskCreateJson = (await taskCreateRes.json()) as any
    assert(taskCreateRes.status === 201, 'Scenario B: Team Lead assigned task to Employee A')
    const assignedTaskId = taskCreateJson.task.id
    assert(taskCreateJson.task.owner === 'Employee Alpha', 'Task owner in DB is Employee Alpha')
    assert(taskCreateJson.task.status === 'todo', 'Initial task status is todo')

    // Scenario C: Employee A logs in and retrieves assigned tasks via GET /tasks?owner=me
    console.log('• Scenario C: Employee A logs in and retrieves My Tasks')

    const empAToken = tokenService.generateAccessToken({
      userId: employeeAId,
      email: employeeAEmail,
      role: 'Member',
    })

    const myTasksRes = await fetch(`${baseUrl}/tasks?owner=me`, {
      headers: { Authorization: `Bearer ${empAToken}` },
    })
    const myTasksJson = (await myTasksRes.json()) as any
    assert(myTasksRes.status === 200, 'GET /tasks?owner=me succeeded')
    assert(myTasksJson.tasks.some((t: any) => t.id === assignedTaskId), 'Newly assigned task appears immediately in Employee A My Tasks')

    // Scenario D: Employee A starts and completes task DIRECTLY without Team Lead approval
    console.log('• Scenario D: Employee A marks task Doing -> Done directly without approval')
    // Move to doing
    const toDoingRes = await fetch(`${baseUrl}/tasks/${assignedTaskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empAToken}`,
      },
      body: JSON.stringify({ status: 'doing' }),
    })
    const toDoingJson = (await toDoingRes.json()) as any
    assert(toDoingRes.status === 200, 'Employee changed status to doing')
    assert(toDoingJson.task.status === 'doing', 'Status is doing')

    // Mark Done directly
    const toDoneRes = await fetch(`${baseUrl}/tasks/${assignedTaskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empAToken}`,
      },
      body: JSON.stringify({ status: 'done' }),
    })
    const toDoneJson = (await toDoneRes.json()) as any
    assert(toDoneRes.status === 200, 'Scenario D: Employee marked task Done directly')
    assert(toDoneJson.task.status === 'done', 'Status is done (No approval required!)')
    assert(Boolean(toDoneJson.task.doneAt), 'doneAt timestamp recorded in MongoDB')

    // Team Lead checks task details, sees done status and activity history
    const leadCheckRes = await fetch(`${baseUrl}/tasks/${assignedTaskId}`, {
      headers: { Authorization: `Bearer ${teamLeadToken}` },
    })
    const leadCheckJson = (await leadCheckRes.json()) as any
    assert(leadCheckRes.status === 200, 'Team Lead retrieved task details')
    assert(leadCheckJson.task.status === 'done', 'Team Lead observes completed task status')
    assert(leadCheckJson.task.activity.some((a: any) => a.action === 'status_changed'), 'Activity log reflects direct status change by Employee A')

    // Scenario E: Unauthorized assignment outside team is rejected
    console.log('• Scenario E: Unauthorized task assignment rejected')
    const outsiderEmail = `outsider_${Date.now()}@eduwire.test`
    const outsiderRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Outsider Staff',
        email: outsiderEmail,
        role: 'Member',
        branch: testBranchId, // Jabalpur branch
        teams: [testTeamId],
      }),
    })
    const outsiderJson = (await outsiderRes.json()) as any
    const outsiderId = outsiderJson.user.id

    // Team lead in Bhopal tries to assign Bhopal Admissions Desk task to outsider in Jabalpur
    const unauthorizedAssignRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teamLeadToken}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Task',
        team: admissionsTeam!._id.toString(),
        owner: outsiderId,
        due: todayDate,
        priority: 'normal',
      }),
    })
    assert(unauthorizedAssignRes.status === 400 || unauthorizedAssignRes.status === 403, 'Scenario E: Assignment to employee outside team rejected with 400/403')

    // Scenario F: Employee deactivation revokes sessions and excludes from future assignment
    console.log('• Scenario F: Employee account deactivation')
    const deactRes = await fetch(`${baseUrl}/users/${employeeAId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        isActive: false,
      }),
    })
    assert(deactRes.status === 200, 'Scenario F: Employee A deactivated')

    // Employee A should now be excluded from team member lookup
    const postDeactMembersRes = await fetch(`${baseUrl}/teams/${admissionsTeam!._id}/members`, {
      headers: { Authorization: `Bearer ${teamLeadToken}` },
    })
    const postDeactMembersJson = (await postDeactMembersRes.json()) as any
    assert(!postDeactMembersJson.members.some((m: any) => m.id === employeeAId), 'Deactivated employee excluded from future assignment dropdown')

    // Historical tasks of deactivated employee preserved
    const historicalTaskRes = await fetch(`${baseUrl}/tasks/${assignedTaskId}`, {
      headers: { Authorization: `Bearer ${teamLeadToken}` },
    })
    const historicalTaskJson = (await historicalTaskRes.json()) as any
    assert(historicalTaskRes.status === 200, 'Historical task of deactivated employee is preserved in database')
    assert(historicalTaskJson.task.owner === 'Employee Alpha', 'Owner attribution preserved')

    // Clean up test branch, teams, and test users
    await Task.deleteMany({ _id: assignedTaskId })
    await Team.deleteMany({ _id: testTeamId })
    await Branch.deleteMany({ _id: testBranchId })
    await User.deleteMany({ _id: { $in: [createdUserId, employeeAId, teamLeadId, outsiderId] } })
    await Activity.deleteMany({ action: { $in: ['branch_created', 'team_created', 'user_created', 'user_deactivated', 'password_reset', 'role_updated'] } })

    console.log('\n===============================================================')
    console.log('🎉 ALL BACKEND PHASE 4 INTEGRATION & WORKFLOW TESTS PASSED! 🎉')
    console.log('===============================================================\n')
  } catch (error) {
    console.error('\n❌ TEST RUN ENCOUNTERED AN ERROR:', error)
    process.exitCode = 1
  } finally {
    await closeAllQueues()
    await closeRedisConnections()
    if (server) {
      server.close()
    }
    await disconnectDatabase()
  }
}

runTests()
