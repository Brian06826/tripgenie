import { registerPlugin } from '@capacitor/core'

export interface AppleSignInResult {
  identityToken: string
  authorizationCode: string
  user: string
  email?: string
  fullName?: string
}

interface AppleSignInPlugin {
  signIn(): Promise<AppleSignInResult>
}

const AppleSignIn = registerPlugin<AppleSignInPlugin>('AppleSignIn')

export default AppleSignIn
