/**
 * Which provider and model the tutor runs on, decided per call.
 *
 * The contract is three tiers, in order: the environment (DERIVE_BACKEND and
 * DERIVE_MODEL), then the per-install `settings` table the settings page
 * writes, then detection of whichever login the machine has. Nothing here is
 * decided once for the life of the process. `resolveTutor()` is computed on
 * every call, so a choice made on the settings page is what the very next
 * turn of every lesson runs on, with no restart; the boot-time memo that used
 * to live in `server/src/backend.ts` is gone.
 *
 * Detection is the one tier with a cost — `claude auth status` is a child
 * process — so it is bounded rather than memoised: the last observation is
 * kept, and a turn re-runs the detectors only when it is older than
 * `DETECT_MS`. The observation is never the decision itself; it is only what
 * the detection tier reads. Two callers want different things from it. A turn
 * calls `resolveTutor()`, which may refresh the observation. A read-only route
 * — the settings view, the health check the doctor probes with a short timeout,
 * a page's first paint — calls `currentTutor()`, which reports the last
 * observation whatever its age and never spawns anything.
 *
 * The environment is read only through the constants `config.ts` exports;
 * this module never reads it directly.
 */
import { claudeLoggedIn, codexLoggedIn } from './backend.js';
import { BACKEND_SETTING, MODEL, type Backend } from './config.js';
import { getSetting } from './db.js';
import { providerOf, type ProviderId } from './providers.js';

/** Where the provider came from: the environment, the settings table, or the logins the machine has. */
export type TutorSource = 'environment' | 'settings' | 'detected';

/** Where the model came from; null when the provider's own default applies and the catalogue names none. */
export type ModelSource = 'environment' | 'settings' | 'default' | null;

/** What a turn runs on, and why. */
export type TutorChoice = {
  provider: ProviderId;
  /** The model asked for, or null to take the provider's own default. */
  model: string | null;
  source: TutorSource;
  modelSource: ModelSource;
};

/** The settings key holding the active provider id. */
export const ACTIVE_PROVIDER = 'active_provider';

/** The settings key holding a provider's stored model id. */
export const modelKey = (id: string) => `model:${id}`;

/** The settings key holding a provider's stored base URL. */
export const baseUrlKey = (id: string) => `base_url:${id}`;

/** How old an observation may be before a turn re-runs the login detectors. Bounds the spawn, never replaces the decision. */
export const DETECT_MS = 30_000;

/** Which logins the machine has, as the detectors last saw them. */
export type Logins = { 'claude-code': boolean; codex: boolean };

/** Which local servers answered on their port, or null where nothing did. */
export type Local = { ollama: number | null; lmstudio: number | null; llamacpp: number | null };

/** One detection pass: when it ran, what it found. `local` is absent until a pass has probed the ports. */
export type Detection = { at: number; logins: Logins; local?: Local };

/** The last observation and when it was made. Deliberate module state: this is the bound the turn resolver reads, and the only thing a read-only view reports. */
let observed: Detection | null = null;

/** Record a detection pass. A pass that carries no `local` keeps the previous one: a turn's login refresh must not erase what the port probe found. */
export function rememberDetection(d: { logins: Logins; local?: Local }, now = Date.now()): Detection {
  const local = d.local ?? observed?.local;
  observed = { at: now, logins: d.logins, ...(local ? { local } : {}) };
  return observed;
}

/** The observation while it is fresh, else null. A clock stepped backwards reads as stale rather than as fresh forever. */
export function currentDetection(now = Date.now()): Detection | null {
  return observed && now >= observed.at && now - observed.at < DETECT_MS ? observed : null;
}

/** The observation whatever its age: what read-only views report. Null until a pass has run. */
export function lastDetection(): Detection | null {
  return observed;
}

/** Forget the observation, so the next turn or pass observes again. */
export function resetDetection(): void {
  observed = null;
}

/** The provider the logins imply, in the order the old memo used: Claude when it is logged in, Codex when only Codex is, Claude when nothing is known. */
export function detectedProvider(logins: Logins | null | undefined): 'claude-code' | 'codex' {
  if (logins?.['claude-code']) return 'claude-code';
  if (logins?.codex) return 'codex';
  return 'claude-code';
}

/** Run both detectors now and keep what they said. Only a turn's resolve and the boot line reach here. */
function observeLogins(): Logins {
  const logins: Logins = { 'claude-code': claudeLoggedIn(), codex: codexLoggedIn() };
  rememberDetection({ logins });
  return logins;
}

/** The first two tiers, shared by both resolvers so they cannot drift; `logins` is asked only when neither decides. */
function chooseProvider(logins: () => Logins | null | undefined): { provider: ProviderId; source: TutorSource } {
  if (BACKEND_SETTING) return { provider: BACKEND_SETTING === 'codex' ? 'codex' : 'claude-code', source: 'environment' };
  const stored = getSetting(ACTIVE_PROVIDER);
  if (stored && providerOf(stored)?.teaches) return { provider: stored as ProviderId, source: 'settings' };
  return { provider: detectedProvider(logins()), source: 'detected' };
}

/** The model for a provider: the environment, then the stored id, then the catalogue default. */
function chooseModel(provider: ProviderId): { model: string | null; modelSource: ModelSource } {
  if (MODEL) return { model: MODEL, modelSource: 'environment' };
  const stored = getSetting(modelKey(provider));
  if (stored) return { model: stored, modelSource: 'settings' };
  const fallback = providerOf(provider)?.defaultModel ?? null;
  return { model: fallback, modelSource: fallback ? 'default' : null };
}

/** What the next turn runs on. Computed on every call; re-runs the login detectors only when nothing else decides and the observation is older than DETECT_MS. */
export function resolveTutor(): TutorChoice {
  const { provider, source } = chooseProvider(() => currentDetection()?.logins ?? observeLogins());
  return { provider, source, ...chooseModel(provider) };
}

/** The dialect the two login drivers and systemPrompt() speak. Only teaching rows reach a turn in this release. */
export const backendOf = (provider: string): Backend => (provider === 'codex' ? 'codex' : 'claude');

/** The environment variable that locks a field, or null when the field is the learner's to set. */
export function lockedBy(field: 'provider' | 'model'): string | null {
  if (field === 'provider') return BACKEND_SETTING ? 'DERIVE_BACKEND' : null;
  return MODEL ? 'DERIVE_MODEL' : null;
}
