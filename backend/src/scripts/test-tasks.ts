import type { Server } from 'node:http'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { Task } from '../models/Task.js'
import { Activity } from '../models/Activity.js'
import { tokenService } from '../services/token.service.js'
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
  console.log('🧪 Starting Backend Phase 3: Task Management, Activity Log & Dashboard APIs Test Suite...\n')

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
    // 1. Prepare Auth Tokens
    // ---------------------------------------------------------------
    console.log('--- Step 1: Authentication & Test Fixtures ---')
    const superAdmin = await User.findOne({ email: 'zohaib.works022@gmail.com' }).populate('role')
    assert(Boolean(superAdmin), 'Super Admin user found in database')

    const superAdminRole = superAdmin!.role as any
    const superAdminToken = tokenService.generateAccessToken({
      userId: superAdmin!._id.toString(),
      email: superAdmin!.email,
      role: superAdminRole.name,
    })
    assert(Boolean(superAdminToken), 'Generated access token for Super Admin')

    const branch = await Branch.findOne({ isActive: true })
    assert(Boolean(branch), 'Active branch found')

    const team = await Team.findOne({ isActive: true })
    assert(Boolean(team), 'Active team found')

    // Find or assign a member to this team
    let member = await User.findOne({ teams: team!._id, isActive: true })
    if (!member) {
      // Temporarily assign superAdmin to team if no other user
      superAdmin!.teams = [team!._id]
      await superAdmin!.save()
      member = superAdmin
    }
    assert(Boolean(member), `Test member for team assignment resolved: ${member!.name}`)

    // ---------------------------------------------------------------
    // 2. Metadata Endpoints
    // ---------------------------------------------------------------
    console.log('\n--- Step 2: Metadata Endpoints ---')

    const branchesRes = await fetch(`${baseUrl}/branches`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const branchesJson = (await branchesRes.json()) as any
    assert(branchesRes.status === 200, 'GET /branches returns HTTP 200')
    assert(Array.isArray(branchesJson.branches) && branchesJson.branches.length > 0, 'GET /branches returns active branches array')

    const teamsRes = await fetch(`${baseUrl}/teams`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const teamsJson = (await teamsRes.json()) as any
    assert(teamsRes.status === 200, 'GET /teams returns HTTP 200')
    assert(Array.isArray(teamsJson.teams) && teamsJson.teams.length > 0, 'GET /teams returns active teams array')

    const membersRes = await fetch(`${baseUrl}/teams/${team!._id}/members`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const membersJson = (await membersRes.json()) as any
    assert(membersRes.status === 200, `GET /teams/:id/members returns HTTP 200`)
    assert(Array.isArray(membersJson.members) && membersJson.members.length > 0, 'GET /teams/:id/members returns member list with safe fields')
    assert(!('password' in membersJson.members[0]), 'Team member object does not expose password hashes')

    // ---------------------------------------------------------------
    // 3. Task Creation (POST /tasks)
    // ---------------------------------------------------------------
    console.log('\n--- Step 3: Task Creation ---')
    const todayIST = getTodayDateIST()

    const createPayload = {
      title: 'Automated Test Task 001',
      note: 'Initial notes for testing',
      team: team!._id.toString(),
      owner: member!._id.toString(),
      due: todayIST,
      priority: 'high',
    }

    const createRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(createPayload),
    })
    const createJson = (await createRes.json()) as any
    assert(createRes.status === 201, `POST /tasks returns HTTP 201 (Status: ${createRes.status})`)
    assert(createJson.task && createJson.task.id, 'Response contains created task ID')
    assert(createJson.task.status === 'todo', 'New task initialized with status: todo')
    assert(createJson.task.priority === 'high', 'Task priority is high')
    assert(createJson.task.due === todayIST, `Task due date is today IST (${todayIST})`)
    assert(createJson.task.team === team!.name, `Task team formatted label matches '${team!.name}'`)
    assert(createJson.task.owner === member!.name, `Task owner formatted label matches '${member!.name}'`)

    const createdTaskId = createJson.task.id

    // Check Activity log in DB
    const creationActivity = await Activity.findOne({ task: createdTaskId, action: 'created' })
    assert(Boolean(creationActivity), 'Activity log entry created for task creation')

    // ---------------------------------------------------------------
    // 4. Dashboard Summary (GET /summary)
    // ---------------------------------------------------------------
    console.log('\n--- Step 4: Dashboard Summary Calculations ---')
    const summaryRes = await fetch(`${baseUrl}/summary`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const summaryJson = (await summaryRes.json()) as any
    assert(summaryRes.status === 200, 'GET /summary returns HTTP 200')
    assert(typeof summaryJson.today === 'number' && summaryJson.today >= 1, `Today tasks count >= 1 (got ${summaryJson.today})`)
    assert(typeof summaryJson.pending === 'number' && summaryJson.pending >= 1, `Pending tasks count >= 1 (got ${summaryJson.pending})`)
    assert(typeof summaryJson.late === 'number', 'Summary contains late count')
    assert(typeof summaryJson.done7Days === 'number', 'Summary contains done7Days count')

    // ---------------------------------------------------------------
    // 5. Scoped Task Listing & Filters (GET /tasks)
    // ---------------------------------------------------------------
    console.log('\n--- Step 5: Task Listing & Query Filters ---')
    const listRes = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const listJson = (await listRes.json()) as any
    assert(listRes.status === 200, 'GET /tasks returns HTTP 200')
    assert(Array.isArray(listJson.tasks), 'GET /tasks returns tasks array')
    assert(listJson.tasks.some((t: any) => t.id === createdTaskId), 'Created task present in task listing')

    // Filter by due=today
    const todayRes = await fetch(`${baseUrl}/tasks?due=today`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const todayJson = (await todayRes.json()) as any
    assert(todayJson.tasks.some((t: any) => t.id === createdTaskId), 'Filter due=today contains created task')

    // Filter by status=todo
    const statusRes = await fetch(`${baseUrl}/tasks?status=todo`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const statusJson = (await statusRes.json()) as any
    assert(statusJson.tasks.some((t: any) => t.id === createdTaskId), 'Filter status=todo contains created task')

    // Filter by search query q
    const searchRes = await fetch(`${baseUrl}/tasks?q=Test+Task+001`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const searchJson = (await searchRes.json()) as any
    assert(searchJson.tasks.length >= 1, 'Search query q=Test+Task+001 matches created task')

    // ---------------------------------------------------------------
    // 6. Single Task Details & Timeline (GET /tasks/:id)
    // ---------------------------------------------------------------
    console.log('\n--- Step 6: Task Details & Activity Timeline ---')
    const detailRes = await fetch(`${baseUrl}/tasks/${createdTaskId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const detailJson = (await detailRes.json()) as any
    assert(detailRes.status === 200, 'GET /tasks/:id returns HTTP 200')
    assert(detailJson.task.id === createdTaskId, 'Detail matches task ID')
    assert(Array.isArray(detailJson.task.activity) && detailJson.task.activity.length >= 1, 'Detail response includes populated activity timeline')
    assert(detailJson.task.activity[0].action === 'created', 'First activity event is "created"')

    // ---------------------------------------------------------------
    // 7. Update Task Details (PATCH /tasks/:id)
    // ---------------------------------------------------------------
    console.log('\n--- Step 7: Update Task Details ---')
    const updateRes = await fetch(`${baseUrl}/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Updated Test Task Title',
        note: 'Updated notes',
      }),
    })
    const updateJson = (await updateRes.json()) as any
    assert(updateRes.status === 200, 'PATCH /tasks/:id returns HTTP 200')
    assert(updateJson.task.title === 'Updated Test Task Title', 'Task title updated successfully')
    assert(updateJson.task.note === 'Updated notes', 'Task note updated successfully')

    const editActivity = await Activity.findOne({ task: createdTaskId, action: 'edited' })
    assert(Boolean(editActivity), 'Activity log entry created for task editing')

    // ---------------------------------------------------------------
    // 8. Direct Status Transition (PATCH /tasks/:id/status)
    // ---------------------------------------------------------------
    console.log('\n--- Step 8: Direct Status Transitions ---')
    // Transition todo -> doing
    const doingRes = await fetch(`${baseUrl}/tasks/${createdTaskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'doing' }),
    })
    const doingJson = (await doingRes.json()) as any
    assert(doingRes.status === 200, 'PATCH /tasks/:id/status -> doing returns HTTP 200')
    assert(doingJson.task.status === 'doing', 'Task status successfully moved to "doing"')

    // Transition doing -> done (direct, no approval needed)
    const doneRes = await fetch(`${baseUrl}/tasks/${createdTaskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'done' }),
    })
    const doneJson = (await doneRes.json()) as any
    assert(doneRes.status === 200, 'PATCH /tasks/:id/status -> done returns HTTP 200')
    assert(doneJson.task.status === 'done', 'Task status successfully moved directly to "done"')
    assert(Boolean(doneJson.task.doneAt), 'doneAt timestamp set upon moving to "done"')

    // Check summary reflects done status
    const postDoneSummaryRes = await fetch(`${baseUrl}/summary`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const postDoneSummary = (await postDoneSummaryRes.json()) as any
    assert(postDoneSummary.done7Days >= 1, `done7Days metric updated after marking task done (got ${postDoneSummary.done7Days})`)

    // ---------------------------------------------------------------
    // 9. Soft Deletion (DELETE /tasks/:id)
    // ---------------------------------------------------------------
    console.log('\n--- Step 9: Soft Deletion ---')
    const deleteRes = await fetch(`${baseUrl}/tasks/${createdTaskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    assert(deleteRes.status === 200, 'DELETE /tasks/:id returns HTTP 200')

    const dbTask = await Task.findById(createdTaskId)
    assert(Boolean(dbTask?.deletedAt), 'Task deletedAt timestamp is set in MongoDB (soft-deleted)')

    // Verify deleted task is excluded from active listing
    const afterDeleteListRes = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const afterDeleteList = (await afterDeleteListRes.json()) as any
    assert(!afterDeleteList.tasks.some((t: any) => t.id === createdTaskId), 'Soft-deleted task is excluded from active task listing')

    // Verify GET /tasks/:id returns 404 for soft-deleted task
    const afterDeleteDetailRes = await fetch(`${baseUrl}/tasks/${createdTaskId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    assert(afterDeleteDetailRes.status === 404, 'GET /tasks/:id returns 404 for soft-deleted task')

    // ---------------------------------------------------------------
    // 10. Security Checks
    // ---------------------------------------------------------------
    console.log('\n--- Step 10: Security & Scope Verifications ---')
    // No token
    const unauthRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload),
    })
    assert(unauthRes.status === 401, 'Unauthenticated POST /tasks returns HTTP 401')

    const unauthSummaryRes = await fetch(`${baseUrl}/summary`)
    assert(unauthSummaryRes.status === 401, 'Unauthenticated GET /summary returns HTTP 401')

    console.log('\n🎉 ALL BACKEND PHASE 3 INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n')
  } catch (error) {
    console.error('\n❌ TEST RUN ENCOUNTERED AN ERROR:', error)
    process.exitCode = 1
  } finally {
    if (server) {
      server.close()
    }
    await disconnectDatabase()
  }
}

runTests()

