/**
 * cleanup-test-data.ts
 *
 * Removes all test/dummy data created by test scripts from the live database.
 * Safe to run multiple times (idempotent). Does NOT touch production data:
 *   - System roles (Super Admin, Branch Admin, Team Lead, Member)
 *   - Seed branches (Bhopal, Indore)
 *   - Seed teams (Admissions Desk, Visa Processing, Counseling, Indore Operations, Indore Admissions)
 *   - The Super Admin user (zohaib.works022@gmail.com)
 *   - Legitimate team members (fardeen123@gmail.com, prerna123@gmail.com, muneerkhan@gmail.com, sam@gmail.com)
 *
 * Run with:
 *   npx tsx src/scripts/cleanup-test-data.ts
 */

import '../models/index.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { Task } from '../models/Task.js'
import { Activity } from '../models/Activity.js'
import { Notification } from '../models/Notification.js'
import { TaskMessage } from '../models/TaskMessage.js'
import { TaskDiscussionRead } from '../models/TaskDiscussionRead.js'
import { Session } from '../models/Session.js'

// ─── Patterns that identify TEST data ────────────────────────────────────────

/** Test user email domains created by test scripts */
const TEST_EMAIL_PATTERNS = [
  /@p5p1test\.com$/i,
  /@p5p2test\.com$/i,
  /@p5p3test\.com$/i,
  /@p3test\.com$/i,
  /@discussiontest\.com$/i,
  /@rmtest\.com$/i,
  /@eduwire\.test$/i,
]

/** Test team name prefixes */
const TEST_TEAM_PREFIXES = [
  /^P5P1/i,
  /^P5P2/i,
  /^P5P3/i,
  /^P3Test/i,
  /^DiscTest/i,
  /^RM Test/i,
]

/** Test branch name patterns (e.g. "Test Branch 1793874201480") */
const TEST_BRANCH_PATTERN = /^Test Branch\s*\d*/i

/** Test task title patterns */
const TEST_TASK_PATTERNS = [
  /^\[P5P1\]/i,
  /^\[P5P2\]/i,
  /^\[P5P3\]/i,
  /^\[PSP1\]/i,
  /^\[PSP2\]/i,
  /^\[PSP3\]/i,
  /^P3Test/i,
  /^DiscTest/i,
  /^Automated Test Task/i,
  /^Updated Test Task/i,
  /^Task Auto/i,
  /^Task Custom/i,
  /^Legacy Task/i,
  /^testing/i,
  /^testinffff/i,
  /^eetest/i,
  /^testdfddd/i,
  /^test muneer/i,
  /^ddddd/i,
  /^test 6/i,
]

/** Exact test task titles (simple string tasks created manually/via UI for testing) */
const TEST_TASK_EXACT_TITLES = [
  'testing',
  'test-3',
  'test',
  'testgh',
  'Eduwire tracker work',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRegexOr(patterns: RegExp[]): RegExp {
  return new RegExp(patterns.map((p) => p.source).join('|'), 'i')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('\n🧹 Starting test data cleanup...\n')

  await connectDatabase()
  console.log('  ✓ Connected to MongoDB\n')

  // ── 1. Find test branches ──────────────────────────────────────────────────
  console.log('--- Step 1: Test Branches ---')
  const testBranches = await Branch.find({ name: TEST_BRANCH_PATTERN })
  const testBranchIds = testBranches.map((b) => b._id)
  console.log(`  Found ${testBranches.length} test branch(es): ${testBranches.map((b) => b.name).join(', ') || 'none'}`)

  // ── 2. Find test teams ─────────────────────────────────────────────────────
  console.log('\n--- Step 2: Test Teams ---')
  const teamRegex = buildRegexOr(TEST_TEAM_PREFIXES)
  const testTeams = await Team.find({
    $or: [
      { name: teamRegex },
      ...(testBranchIds.length ? [{ branch: { $in: testBranchIds } }] : []),
    ],
  })
  const testTeamIds = testTeams.map((t) => t._id)
  console.log(`  Found ${testTeams.length} test team(s): ${testTeams.map((t) => t.name).join(', ') || 'none'}`)

  // ── 3. Find test users ─────────────────────────────────────────────────────
  console.log('\n--- Step 3: Test Users ---')
  const emailRegex = buildRegexOr(TEST_EMAIL_PATTERNS)
  const testUsers = await User.find({ email: emailRegex })
  const testUserIds = testUsers.map((u) => u._id)
  console.log(`  Found ${testUsers.length} test user(s): ${testUsers.map((u) => u.email).join(', ') || 'none'}`)

  // ── 4. Find test tasks ─────────────────────────────────────────────────────
  console.log('\n--- Step 4: Test Tasks ---')
  const taskTitleRegex = buildRegexOr(TEST_TASK_PATTERNS)

  const testTasks = await Task.find({
    $or: [
      { title: taskTitleRegex },
      { title: { $in: TEST_TASK_EXACT_TITLES } },
      ...(testTeamIds.length ? [{ team: { $in: testTeamIds } }] : []),
      ...(testBranchIds.length ? [{ branch: { $in: testBranchIds } }] : []),
      ...(testUserIds.length ? [{ owner: { $in: testUserIds } }] : []),
    ],
  })
  const testTaskIds = testTasks.map((t) => t._id)
  console.log(`  Found ${testTasks.length} test task(s)`)
  if (testTasks.length) {
    testTasks.forEach((t) => console.log(`    - "${t.title}" [${t.status}]`))
  }

  // ── 5. Delete Activity logs tied to test tasks / test users ───────────────
  console.log('\n--- Step 5: Activity Logs ---')
  const activityFilter: any = { $or: [] }
  if (testTaskIds.length) activityFilter.$or.push({ task: { $in: testTaskIds } })
  if (testUserIds.length) activityFilter.$or.push({ user: { $in: testUserIds } })

  let deletedActivities = 0
  if (activityFilter.$or.length) {
    const r = await Activity.deleteMany(activityFilter)
    deletedActivities = r.deletedCount ?? 0
  }
  console.log(`  Deleted ${deletedActivities} activity log(s)`)

  // ── 6. Delete Task Messages tied to test tasks / test users ───────────────
  console.log('\n--- Step 6: Task Messages & Read States ---')
  const msgFilter: any = { $or: [] }
  if (testTaskIds.length) msgFilter.$or.push({ task: { $in: testTaskIds } })
  if (testUserIds.length) msgFilter.$or.push({ sender: { $in: testUserIds } })

  let deletedMessages = 0
  if (msgFilter.$or.length) {
    const rMsg = await TaskMessage.deleteMany(msgFilter)
    deletedMessages = rMsg.deletedCount ?? 0
  }
  console.log(`  Deleted ${deletedMessages} task message(s)`)

  const readFilter: any = { $or: [] }
  if (testTaskIds.length) readFilter.$or.push({ task: { $in: testTaskIds } })
  if (testUserIds.length) readFilter.$or.push({ user: { $in: testUserIds } })

  let deletedReads = 0
  if (readFilter.$or.length) {
    const rRead = await TaskDiscussionRead.deleteMany(readFilter)
    deletedReads = rRead.deletedCount ?? 0
  }
  console.log(`  Deleted ${deletedReads} task discussion read record(s)`)

  // ── 7. Delete Notifications ────────────────────────────────────────────────
  console.log('\n--- Step 7: Notifications ---')
  const notifFilter: any = { $or: [] }
  if (testUserIds.length) notifFilter.$or.push({ user: { $in: testUserIds } })
  if (testTaskIds.length) notifFilter.$or.push({ task: { $in: testTaskIds } })
  notifFilter.$or.push({ recipient: emailRegex })
  notifFilter.$or.push({ recipient: /mock-wa/i })

  const rNotif = await Notification.deleteMany(notifFilter)
  console.log(`  Deleted ${rNotif.deletedCount ?? 0} notification(s)`)

  // ── 8. Delete Test Tasks ───────────────────────────────────────────────────
  console.log('\n--- Step 8: Tasks ---')
  let deletedTasks = 0
  if (testTasks.length) {
    const r = await Task.deleteMany({ _id: { $in: testTaskIds } })
    deletedTasks = r.deletedCount ?? 0
  }
  console.log(`  Deleted ${deletedTasks} task(s)`)

  // ── 9. Delete Test Users & Sessions ─────────────────────────────────────────
  console.log('\n--- Step 9: Users & Sessions ---')
  let deletedUsers = 0
  if (testUserIds.length) {
    await Session.deleteMany({ user: { $in: testUserIds } })
    const r = await User.deleteMany({ _id: { $in: testUserIds } })
    deletedUsers = r.deletedCount ?? 0
  }
  console.log(`  Deleted ${deletedUsers} user(s) and their sessions`)

  // ── 10. Delete Test Teams ──────────────────────────────────────────────────
  console.log('\n--- Step 10: Teams ---')
  let deletedTeams = 0
  if (testTeamIds.length) {
    const r = await Team.deleteMany({ _id: { $in: testTeamIds } })
    deletedTeams = r.deletedCount ?? 0
  }
  console.log(`  Deleted ${deletedTeams} team(s)`)

  // ── 11. Delete Test Branches ───────────────────────────────────────────────
  console.log('\n--- Step 11: Branches ---')
  let deletedBranches = 0
  if (testBranchIds.length) {
    const r = await Branch.deleteMany({ _id: { $in: testBranchIds } })
    deletedBranches = r.deletedCount ?? 0
  }
  console.log(`  Deleted ${deletedBranches} branch(es)`)

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║            Cleanup Summary                   ║')
  console.log('╠══════════════════════════════════════════════╣')
  console.log(`║  Tasks deleted         : ${String(deletedTasks).padEnd(20)}║`)
  console.log(`║  Users deleted         : ${String(deletedUsers).padEnd(20)}║`)
  console.log(`║  Teams deleted         : ${String(deletedTeams).padEnd(20)}║`)
  console.log(`║  Branches deleted      : ${String(deletedBranches).padEnd(20)}║`)
  console.log(`║  Activities deleted    : ${String(deletedActivities).padEnd(20)}║`)
  console.log(`║  Task messages deleted : ${String(deletedMessages).padEnd(20)}║`)
  console.log(`║  Read records deleted  : ${String(deletedReads).padEnd(20)}║`)
  console.log(`║  Notifications deleted : ${String(rNotif.deletedCount ?? 0).padEnd(20)}║`)
  console.log('╚══════════════════════════════════════════════╝')
  console.log('\n✅ Test data cleanup completed successfully.\n')
}

cleanup()
  .catch((err) => {
    console.error('\n❌ Cleanup failed:', err)
    process.exit(1)
  })
  .finally(() => {
    void disconnectDatabase()
  })
