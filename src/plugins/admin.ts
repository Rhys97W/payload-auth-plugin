import type { Config, Plugin } from 'payload'
import { EndpointFactory } from '../core/endpoints'
import { ProvidersConfig } from '../types'
import { PayloadSession } from '../core/session/payload'
import { InvalidServerURL, MissingUsersCollection } from '../core/errors/consoleErrors'
import { buildAccountsCollection } from '../core/collections/admin/accounts'
import { mapProviders } from '../providers/utils'

interface PluginOptions {
  /* Enable or disable plugin
   * @default true
   */
  enabled?: boolean
  /*
   * OAuth Providers
   */
  providers: ProvidersConfig[]

  /*
   * Accounts collections config
   */
  accounts?: {
    slug?: string | undefined
    hidden?: boolean | undefined
  }
}

export const adminAuthPlugin =
  (pluginOptions: PluginOptions): Plugin =>
    (incomingConfig: Config): Config => {
      const config = { ...incomingConfig }

      if (pluginOptions.enabled === false) {
        return config
      }

      if (!config.serverURL) {
        throw new InvalidServerURL()
      }

      if (!config.admin?.user) {
        throw new MissingUsersCollection()
      }

      config.admin = {
        ...(config.admin ?? {}),
      }

      const { accounts, providers } = pluginOptions

      const session = new PayloadSession({
        accountsCollectionSlug: accounts?.slug ?? 'accounts'
      })
      const mappedProviders = mapProviders(providers)
      const endpoints = new EndpointFactory(mappedProviders)

      // Create accounts collection if doesn't exists
      config.collections = [
        ...(config.collections ?? []),
        buildAccountsCollection(
          {
            slug: accounts?.slug ?? 'accounts',
            hidden: accounts?.hidden ?? false,
          },
          config.admin.user!,
        ),
      ]

      config.endpoints = [
        ...(config.endpoints ?? []),
        ...endpoints.payloadOAuthEndpoints({
          sessionCallback: (oauthAccountInfo, scope, issuerName, basePayload) =>
            session.createSession(oauthAccountInfo, scope, issuerName, basePayload),
        }),
      ]
      if (mappedProviders['passkey']) {
        config.endpoints.push(...endpoints.payloadPasskeyEndpoints({
          rpID: 'localhost',
          sessionCallback: (accountInfo, issuerName, basePayload) =>
            session.createSession(accountInfo, "", issuerName, basePayload),
        }))
      }
      return config
    }
