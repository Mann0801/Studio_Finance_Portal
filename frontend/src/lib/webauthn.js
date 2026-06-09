/* Biometric unlock via WebAuthn (platform authenticator: Face ID / fingerprint).
 *
 * This is a LOCAL convenience gate, not a server credential. After a normal
 * email/password login the Supabase session is persisted in localStorage; we
 * register a platform credential on this device and, on later opens, require a
 * successful biometric assertion before revealing the app. If biometrics fail
 * or aren't available, the user falls back to email/password. Because there's no
 * server-side verification, the WebAuthn challenge is generated client-side —
 * acceptable for a "fast unlock", not for primary authentication.
 */
const ENABLED_KEY = 'bio:enabled'
const CRED_KEY = 'bio:credId'
const NAME_KEY = 'bio:userName'

// ── base64url <-> ArrayBuffer ──
function bufToB64url(buf) {
  const bytes = new Uint8Array(buf)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlToBuf(b64) {
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const str = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes.buffer
}
function randomBytes(n = 32) {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return a
}

export function isWebAuthnSupported() {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials?.create
  )
}

/** Resolves true if this device has a built-in (platform) authenticator. */
export async function isPlatformAuthenticatorAvailable() {
  if (!isWebAuthnSupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export const isBiometricEnabled = () => localStorage.getItem(ENABLED_KEY) === '1'
export const biometricUserName = () => localStorage.getItem(NAME_KEY) || ''

export function disableBiometric() {
  localStorage.removeItem(ENABLED_KEY)
  localStorage.removeItem(CRED_KEY)
  localStorage.removeItem(NAME_KEY)
}

/** Register a platform credential on this device. Returns true on success. */
export async function enableBiometric(userId, userName) {
  if (!isWebAuthnSupported()) throw new Error('Biometrics not supported on this device')
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(),
      rp: { name: 'Studio', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId).slice(0, 64),
        name: userName || 'student',
        displayName: userName || 'Student',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })
  if (!cred) throw new Error('Could not register biometric')
  localStorage.setItem(CRED_KEY, bufToB64url(cred.rawId))
  localStorage.setItem(ENABLED_KEY, '1')
  if (userName) localStorage.setItem(NAME_KEY, userName)
  return true
}

/** Prompt for a biometric assertion. Returns true if the user verifies. */
export async function unlockBiometric() {
  if (!isBiometricEnabled()) return false
  const credId = localStorage.getItem(CRED_KEY)
  if (!credId) return false
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(),
      allowCredentials: [{ type: 'public-key', id: b64urlToBuf(credId) }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
  return !!assertion
}
