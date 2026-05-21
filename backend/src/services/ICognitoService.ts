import type { CognitoSub, FamilyID } from '../types/domain.js'

export interface ICognitoService {
  setFamilyId(cognitoSub: CognitoSub, familyId: FamilyID): Promise<void>
}
