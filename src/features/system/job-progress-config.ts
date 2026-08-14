/**
 * Job names with a live progress WebSocket wired up server-side
 * (GET /v1/jobs/{name}/ws). The WS route and broadcaster are generic and
 * work for any job name, but only jobs listed here get the progress UI --
 * add a job's name here once its job file publishes progress events.
 */
export const PROGRESS_CAPABLE_JOBS = new Set(['universe_score'])
