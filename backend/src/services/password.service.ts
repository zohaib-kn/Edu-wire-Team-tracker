import bcrypt from 'bcrypt'

const BCRYPT_SALT_ROUNDS = 12

export const passwordService = {
  /**
   * Hashes a plaintext password using bcrypt with cost factor 12.
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
  },

  /**
   * Compares a plaintext password against a stored bcrypt hash.
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  },

  /**
   * Validates password strength rules:
   * - At least 8 characters
   * - Contains at least one letter
   * - Contains at least one number
   */
  validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
    if (!password || password.length < 8) {
      return {
        isValid: false,
        message: 'Password must be at least 8 characters long',
      }
    }

    if (!/[A-Za-z]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one letter',
      }
    }

    if (!/\d/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one number',
      }
    }

    return { isValid: true }
  },
}

