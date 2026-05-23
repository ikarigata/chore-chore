import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'
import type { CognitoSub, FamilyID } from '../../types/domain.js'
import type { ICognitoService } from '../ICognitoService.js'

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID
if (!USER_POOL_ID) {
  throw new Error('COGNITO_USER_POOL_ID environment variable is required')
}

export class CognitoService implements ICognitoService {
  constructor(private readonly client: CognitoIdentityProviderClient) {}

  async setFamilyId(cognitoSub: CognitoSub, familyId: FamilyID): Promise<void> {
    await this.client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: cognitoSub,
        UserAttributes: [{ Name: 'custom:family_id', Value: familyId }],
      }),
    )
  }
}
