import { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class HaloPsaApi implements ICredentialType {
  // Internal type name — MUST stay 'haloPsaApi' so existing credentials and the
  // BetterHaloPsa node (credentials: [{ name: 'haloPsaApi' }]) keep resolving.
  name = 'haloPsaApi';
  // Distinct display name so this does NOT collide with n8n's built-in
  // HaloPSA credential (type 'haloPSAApi', also labelled "HaloPSA API").
  displayName = 'Better HaloPSA API';
  documentationUrl = 'https://halopsa.com/guides/api-documentation/';

  properties: INodeProperties[] = [
    {
      displayName: 'Subdomain',
      name: 'subdomain',
      type: 'string',
      default: '',
      placeholder: 'yourcompany',
      description:
        'Lowercase letters, numbers, and hyphens only — e.g. "yourcompany" for yourcompany.halopsa.com',
      required: true,
    },
    {
      displayName: 'Client ID',
      name: 'clientId',
      type: 'string',
      default: '',
      description: 'OAuth2 Client ID — found in HaloPSA under Configuration → Integrations → HaloPSA API',
      required: true,
    },
    {
      displayName: 'Client Secret',
      name: 'clientSecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'OAuth2 Client Secret for the above Client ID',
      required: true,
    },
    {
      displayName: 'OAuth Scope',
      name: 'scope',
      type: 'string',
      default: 'all',
      description:
        'OAuth2 scope requested from HaloPSA. Default is "all" — set to a narrower value if your Halo API app enforces least-privilege permissions.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {},
  };

  test: ICredentialTestRequest = {
    request: {
      method: 'POST',
      url: '={{"https://" + $credentials.subdomain + ".halopsa.com/auth/token"}}',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: "=grant_type=client_credentials&client_id={{$credentials.clientId}}&client_secret={{$credentials.clientSecret}}&scope={{$credentials.scope || 'all'}}&tenant=halopsa",
    },
  };
}
