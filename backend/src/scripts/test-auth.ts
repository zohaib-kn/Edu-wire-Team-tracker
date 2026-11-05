import type { Server } from 'node:http'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { Session } from '../models/Session.js'
import { passwordService } from '../services/password.service.js'
import { tokenService } from '../services/token.service.js'

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
  console.log('🧪 Starting Backend Phase 2 Authentication Test Suite...\n')

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
    // 1. Health check verification
    // ---------------------------------------------------------------
    console.log('--- Test 1: Health Check Endpoint ---')
    const healthRes = await fetch(`${baseUrl}/health`)
    const healthJson = (await healthRes.json()) as Record<string, any>
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200')
    assert(healthJson.status === 'ok' && healthJson.database === 'connected', 'Health endpoint reports database: connected')

    // ---------------------------------------------------------------
    // 2. Database Models & Schema Validation
    // ---------------------------------------------------------------
    console.log('\n--- Test 2: Mongoose Models & Schemas ---')
    const roles = await Role.find()
    assert(roles.length >= 4, `At least 4 default system roles exist in DB (found ${roles.length})`)

    const superAdminRole = roles.find((r) => r.name === 'Super Admin')
    assert(Boolean(superAdminRole), 'Super Admin role exists')
    assert(superAdminRole!.permissions.length >= 10, 'Super Admin has all 10 system permissions')

    const branches = await Branch.find()
    assert(branches.some((b) => b.name === 'Bhopal'), 'Bhopal branch exists')
    assert(branches.some((b) => b.name === 'Indore'), 'Indore branch exists')

    const teams = await Team.find()
    assert(teams.length >= 5, `Initial teams configured (found ${teams.length})`)

    // ---------------------------------------------------------------
    // 3. Password Service
    // ---------------------------------------------------------------
    console.log('\n--- Test 3: Password Service ---')
    const testHash = await passwordService.hashPassword('Secret123')
    assert(testHash.startsWith('$2b$12$'), 'bcrypt hash generated with cost factor 12 ($2b$12$)')
    const match = await passwordService.comparePassword('Secret123', testHash)
    assert(match === true, 'comparePassword validates correct password')
    const mismatch = await passwordService.comparePassword('WrongPassword', testHash)
    assert(mismatch === false, 'comparePassword rejects incorrect password')

    const weakCheck = passwordService.validatePasswordStrength('short1')
    assert(!weakCheck.isValid, 'validatePasswordStrength rejects < 8 chars')
    const strongCheck = passwordService.validatePasswordStrength('StrongPass123')
    assert(strongCheck.isValid, 'validatePasswordStrength accepts letters + numbers 8+ chars')

    // ---------------------------------------------------------------
    // 4. Token Service
    // ---------------------------------------------------------------
    console.log('\n--- Test 4: Token Service ---')
    const testToken = tokenService.generateAccessToken({
      userId: 'test_usr_123',
      email: 'test@example.com',
      role: 'Member',
    })
    assert(typeof testToken === 'string' && testToken.split('.').length === 3, 'JWT token successfully formatted')
    const decoded = tokenService.verifyAccessToken(testToken)
    assert(decoded.userId === 'test_usr_123' && decoded.role === 'Member', 'JWT verifies correctly with claims')

    const rawRefresh = tokenService.generateRefreshToken()
    const hashedRefresh = tokenService.hashRefreshToken(rawRefresh)
    assert(rawRefresh.length >= 40, 'Cryptographically random refresh token generated')
    assert(hashedRefresh.length === 64, 'SHA-256 hash generated (64 hex chars)')

    // ---------------------------------------------------------------
    // 5. Authentication Endpoints: Super Admin Login
    // ---------------------------------------------------------------
    console.log('\n--- Test 5: Super Admin Login & Cookie Handling ---')
    const adminEmail = 'test_suite_admin@eduwire.test'
    const adminPassword = 'AdminPassword@12345'
    await User.deleteOne({ email: adminEmail })
    await User.create({
      name: 'Test Suite Super Admin',
      email: adminEmail,
      passwordHash: await passwordService.hashPassword(adminPassword),
      role: superAdminRole!._id,
      isActive: true,
      mustChangePassword: true,
    })

    // Bad password attempt
    const badLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'WrongPassword999' }),
    })
    const badLoginJson = (await badLoginRes.json()) as any
    assert(badLoginRes.status === 401, 'Bad credentials returns HTTP 401')
    assert(badLoginJson.error?.code === 'INVALID_CREDENTIALS', 'Returns error code INVALID_CREDENTIALS')

    // Correct password login
    const goodLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    })
    const setCookie = goodLoginRes.headers.get('set-cookie') || ''
    const goodLoginJson = (await goodLoginRes.json()) as any

    if (goodLoginRes.status !== 200) {
      console.error('Login failed status:', goodLoginRes.status, 'body:', goodLoginJson)
    }
    assert(goodLoginRes.status === 200, 'Valid login returns HTTP 200')
    assert(Boolean(goodLoginJson.accessToken), 'Login returns accessToken')
    assert(goodLoginJson.user.email === adminEmail, 'Login returns authenticated user profile')
    assert(goodLoginJson.user.mustChangePassword === true, 'Super Admin mustChangePassword is true on bootstrap')
    assert(setCookie.includes('refreshToken='), 'Login sets httpOnly refreshToken cookie')
    assert(setCookie.includes('HttpOnly'), 'Cookie has HttpOnly flag')

    const adminAccessToken = goodLoginJson.accessToken
    const refreshTokenMatch = setCookie.match(/refreshToken=([^;]+)/)
    const adminRefreshTokenCookie = refreshTokenMatch ? refreshTokenMatch[1] : ''

    // ---------------------------------------------------------------
    // 6. GET /auth/me Endpoint
    // ---------------------------------------------------------------
    console.log('\n--- Test 6: GET /auth/me & Protected Access ---')
    // Without token
    const noAuthMeRes = await fetch(`${baseUrl}/auth/me`)
    assert(noAuthMeRes.status === 401, '/auth/me without Bearer token returns 401')

    // With valid token
    const authMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    })
    const authMeJson = (await authMeRes.json()) as any
    assert(authMeRes.status === 200, '/auth/me with Bearer token returns 200')
    assert(authMeJson.email === adminEmail, '/auth/me returns correct user data')
    assert(Array.isArray(authMeJson.permissions), '/auth/me returns resolved permissions')

    // ---------------------------------------------------------------
    // 7. Refresh Token Rotation & Session Management
    // ---------------------------------------------------------------
    console.log('\n--- Test 7: Refresh Token Rotation ---')
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `refreshToken=${adminRefreshTokenCookie}`,
      },
    })
    const refreshSetCookie = refreshRes.headers.get('set-cookie') || ''
    const refreshJson = (await refreshRes.json()) as any

    assert(refreshRes.status === 200, '/auth/refresh with valid cookie returns 200')
    assert(Boolean(refreshJson.accessToken), 'Returns fresh accessToken')
    assert(refreshSetCookie.includes('refreshToken='), 'Rotates and sets new refreshToken cookie')

    const newRefreshTokenMatch = refreshSetCookie.match(/refreshToken=([^;]+)/)
    const newRefreshTokenCookie = newRefreshTokenMatch ? newRefreshTokenMatch[1] : ''
    assert(newRefreshTokenCookie !== adminRefreshTokenCookie, 'New refresh token differs from previous token (rotation verified)')

    // Test token reuse (trying to use old rotated token)
    const reuseRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `refreshToken=${adminRefreshTokenCookie}`,
      },
    })
    assert(reuseRes.status === 401, 'Reusing old rotated refresh token returns 401 (re-use attack blocked)')

    // ---------------------------------------------------------------
    // 8. Account Lockout Protection (Isolated Test User)
    // ---------------------------------------------------------------
    console.log('\n--- Test 8: Account Lockout after 5 Failed Attempts ---')
    const testUserEmail = 'lockout_test_user@eduwire.test'
    await User.deleteOne({ email: testUserEmail })

    const memberRole = roles.find((r) => r.name === 'Member')!
    await User.create({
      name: 'Lockout Test',
      email: testUserEmail,
      passwordHash: await passwordService.hashPassword('CorrectPass123'),
      role: memberRole._id,
      isActive: true,
    })

    // Fail 4 times
    for (let i = 1; i <= 4; i++) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testUserEmail, password: 'Wrong' }),
      })
      assert(res.status === 401, `Failed attempt ${i}/5 returns 401`)
    }

    // 5th failed attempt triggers lock
    const fifthRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, password: 'Wrong' }),
    })
    const fifthJson = (await fifthRes.json()) as any
    assert(fifthRes.status === 403, '5th consecutive failure triggers 403 Account Locked')
    assert(fifthJson.error?.code === 'ACCOUNT_LOCKED', 'Returns code ACCOUNT_LOCKED')

    // Trying even with correct password while locked should fail
    const lockedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, password: 'CorrectPass123' }),
    })
    assert(lockedRes.status === 403, 'Login attempt while account is locked returns 403 even with correct password')

    // Clean up test user
    await User.deleteOne({ email: testUserEmail })

    // ---------------------------------------------------------------
    // 9. Deactivated Account Login Rejection
    // ---------------------------------------------------------------
    console.log('\n--- Test 9: Deactivated User Login Rejection ---')
    const inactiveUserEmail = 'inactive_test_user@eduwire.test'
    await User.deleteOne({ email: inactiveUserEmail })

    await User.create({
      name: 'Inactive Test',
      email: inactiveUserEmail,
      passwordHash: await passwordService.hashPassword('Pass12345'),
      role: memberRole._id,
      isActive: false, // Inactive
    })

    const inactiveRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inactiveUserEmail, password: 'Pass12345' }),
    })
    const inactiveJson = (await inactiveRes.json()) as any
    assert(inactiveRes.status === 403, 'Inactive account login returns 403')
    assert(inactiveJson.error?.code === 'ACCOUNT_INACTIVE', 'Returns code ACCOUNT_INACTIVE')

    await User.deleteOne({ email: inactiveUserEmail })

    // ---------------------------------------------------------------
    // 10. Logout & Session Revocation
    // ---------------------------------------------------------------
    console.log('\n--- Test 10: Logout & Session Revocation ---')
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshJson.accessToken}`,
        Cookie: `refreshToken=${newRefreshTokenCookie}`,
      },
    })
    const logoutCookie = logoutRes.headers.get('set-cookie') || ''
    assert(logoutRes.status === 200, '/auth/logout returns 200')
    assert(logoutCookie.includes('refreshToken=;'), 'Logout clears httpOnly refreshToken cookie')

    // Verify session revoked
    const postLogoutRefresh = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `refreshToken=${newRefreshTokenCookie}`,
      },
    })
    assert(postLogoutRefresh.status === 401, 'Using refresh token after logout returns 401')

    await User.deleteOne({ email: adminEmail })

    console.log('\n======================================================')
    console.log('🎉 ALL BACKEND AUTHENTICATION TESTS PASSED SUCCESSFULLY!')
    console.log('======================================================')
  } finally {
    if (server) {
      server.close()
    }
    await disconnectDatabase()
  }
}

void runTests()
