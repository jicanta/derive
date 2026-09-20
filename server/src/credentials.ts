/**
 * The install token and the browser credential derived from it.
 *
 * Created once at start and read live on every check, so deleting or
 * rotating the file is a revocation on a server that is already running
 * rather than a promise that waits for a restart.
 */

/**
 * How stale a credential check is allowed to be. Short enough that the
 * revocation the learner was promised happens while they are still looking at
 * the screen, long enough that a credential check is not a filesystem read per
 * request on a synchronous event loop.
 */
export const TOKEN_CACHE_MS = 1_000;
