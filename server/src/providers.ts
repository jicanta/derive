/**
 * The provider catalogue, declared once.
 *
 * Every way of running the tutor that Derive knows about is one row here: the
 * two subscription logins the app can already teach on, the pay-per-use keys,
 * the gateways and the local servers whose drivers arrive with later releases.
 * The resolver, the settings routes, the doctor and the settings page all read
 * this one list, so a provider fact — its label, which environment variable
 * carries its key, where its model list lives, which port it listens on by
 * default — is written in one place and cannot drift between them. The browser
 * renders what the API returns; it hard-codes none of this.
 *
 * `teaches` is the gate that keeps a row with no driver from ever becoming the
 * active tutor: the API refuses to activate it and the resolver ignores a
 * stored id that does not teach. The curated default model ids move with the
 * vendors, which is why `DEFAULTS_AS_OF` records the day they were last
 * checked; a learner may always type another id.
 *
 * Pure data with no I/O and no import-time side effect, so anything may import
 * it, including a test with no database behind it.
 */

/** The catalogue ids, in the order the settings page keeps its rows. */
export type ProviderId = 'claude-code' | 'codex' | 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'openai-compatible' | 'ollama' | 'lmstudio' | 'llamacpp';

/** How a provider is reached: a CLI login, an API key, a key plus a base URL the learner supplies, or nothing at all for a local server. */
export type ProviderAuth = 'login' | 'key' | 'key+url' | 'none';

/** The three groups the settings page shows: subscription logins, API keys and gateways, servers on this machine. */
export type ProviderGroup = 'logins' | 'keys' | 'local';

/** One provider, declared once for every surface that names it. */
export type ProviderSpec = {
  /** The id stored in settings and carried on turn_start payloads. */
  id: ProviderId;
  /** What the learner reads on the row and in the header pill. */
  label: string;
  group: ProviderGroup;
  auth: ProviderAuth;
  /** The environment variables that carry this provider's key, first one wins. Empty for logins and local servers. */
  envKeys: readonly string[];
  /** The curated default model id as of DEFAULTS_AS_OF, or null when the provider's own default applies. */
  defaultModel: string | null;
  /** The fixed API base for a remote provider, the default base for a local one, null when the learner supplies it or there is none. */
  endpoint: string | null;
  /** The path under the endpoint that lists models, or null when the provider has no such call. */
  modelsPath: string | null;
  /** The default port a local server listens on, for detection. */
  port: number | null;
  /** True only where a driver exists today; a row that does not teach cannot be made active. */
  teaches: boolean;
  /** True where a local server may be started with a bearer token the learner can store; false elsewhere. */
  optionalKey: boolean;
  /** The one sentence the row shows under its head line. */
  note: string;
};

/** The day the default model ids below were last checked against the vendors' documentation. */
export const DEFAULTS_AS_OF = '2026-09-30';

const unwired = (label: string) => `Teaching on ${label} arrives with the next release. Keys, model lists and tests already work.`;

/** Every provider, in the row order the settings page keeps. */
export const PROVIDERS: readonly ProviderSpec[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    group: 'logins',
    auth: 'login',
    envKeys: [],
    defaultModel: null,
    endpoint: null,
    modelsPath: null,
    port: null,
    teaches: true,
    optionalKey: false,
    note: "Runs the app's tutor on your Claude Code login. The plugin is the supported subscription route; an Anthropic API key takes over from the next release.",
  },
  {
    id: 'codex',
    label: 'Codex',
    group: 'logins',
    auth: 'login',
    envKeys: [],
    defaultModel: null,
    endpoint: null,
    modelsPath: null,
    port: null,
    teaches: true,
    optionalKey: false,
    note: "Runs on your Codex login. Leave the model empty to use Codex's own default.",
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    group: 'keys',
    auth: 'key',
    envKeys: ['ANTHROPIC_API_KEY'],
    defaultModel: 'claude-opus-5-5',
    endpoint: 'https://api.anthropic.com',
    modelsPath: '/v1/models?limit=1000',
    port: null,
    teaches: false,
    optionalKey: false,
    note: unwired('Anthropic'),
  },
  {
    id: 'openai',
    label: 'OpenAI',
    group: 'keys',
    auth: 'key',
    envKeys: ['OPENAI_API_KEY'],
    defaultModel: 'gpt-6-astra',
    endpoint: 'https://api.openai.com',
    modelsPath: '/v1/models',
    port: null,
    teaches: false,
    optionalKey: false,
    note: unwired('OpenAI'),
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    group: 'keys',
    auth: 'key',
    // Google wins when both are set, so it is listed first.
    envKeys: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    defaultModel: 'gemini-3.8-flash',
    endpoint: 'https://generativelanguage.googleapis.com',
    modelsPath: '/v1beta/models?pageSize=1000',
    port: null,
    teaches: false,
    optionalKey: false,
    note: unwired('Google Gemini'),
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    group: 'keys',
    auth: 'key',
    envKeys: ['OPENROUTER_API_KEY'],
    defaultModel: 'anthropic/claude-opus-5-5',
    endpoint: 'https://openrouter.ai/api',
    modelsPath: '/v1/models',
    port: null,
    teaches: false,
    optionalKey: false,
    note: unwired('OpenRouter'),
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible endpoint',
    group: 'keys',
    auth: 'key+url',
    envKeys: [],
    defaultModel: null,
    endpoint: null,
    modelsPath: '/v1/models',
    port: null,
    teaches: false,
    optionalKey: false,
    note: unwired('OpenAI-compatible endpoint'),
  },
  {
    id: 'ollama',
    label: 'Ollama',
    group: 'local',
    auth: 'none',
    envKeys: [],
    defaultModel: null,
    endpoint: 'http://127.0.0.1:11434',
    modelsPath: '/api/tags',
    port: 11434,
    teaches: false,
    optionalKey: false,
    note: unwired('Ollama'),
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    group: 'local',
    auth: 'none',
    envKeys: [],
    defaultModel: null,
    endpoint: 'http://127.0.0.1:1234',
    modelsPath: '/api/v0/models',
    port: 1234,
    teaches: false,
    optionalKey: true,
    note: unwired('LM Studio'),
  },
  {
    id: 'llamacpp',
    label: 'llama.cpp',
    group: 'local',
    auth: 'none',
    envKeys: [],
    defaultModel: null,
    endpoint: 'http://127.0.0.1:8080',
    modelsPath: '/v1/models',
    port: 8080,
    teaches: false,
    optionalKey: true,
    note: unwired('llama.cpp'),
  },
];

const byId = new Map<string, ProviderSpec>(PROVIDERS.map((p) => [p.id, p]));

/** The catalogue row for an id, or undefined when the id is not one of ours. */
export function providerOf(id: string): ProviderSpec | undefined {
  return byId.get(id);
}

/** The label a learner reads for an id; an unknown id reads as itself. */
export const labelOf = (id: string): string => providerOf(id)?.label ?? id;

/** The catalogue id behind a turns-table driver name: the app's Claude driver is called 'claude', every other name is already the id. */
export const providerOfDriver = (driver: string): string => (driver === 'claude' ? 'claude-code' : driver);
