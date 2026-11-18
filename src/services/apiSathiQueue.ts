/**
 * Server-Side Background Retry Queue for Transient API Sathi Failures (429 / 5xx)
 * -------------------------------------------------------------------------------
 * - Strictly server-side ONLY. Never import from browser/React bundles.
 * - Retries ONLY transient `429` or `5xx` / timeout failures using exponential backoff
 *   plus optional `Retry-After` floor. NEVER retries `400`, `401`, `402`, `404`, `410`, or `422`.
 * - Reuses the EXACT original `Idempotency-Key` UUID across every background retry so
 *   API Sathi guarantees single billing on eventual recovery.
 * - Strips/masks raw PII (`pan`, `aadhaar`, `mobile`, `email`) in `toPublicSummary()` and logs.
 */

import {
  computeExponentialBackoffMs,
  isRetryableApiSathiFailure,
  type ApiSathiRetryQueueSummary,
} from '../lib/apiSathiAnalytics';
import {
  ApiSathiException,
  buildFirestoreVerificationRecord,
  createApiSathiClient,
  executeApiSathiProduct,
  getApiSathiKey,
  maskSensitiveData,
  persistApiSathiVerificationToFirestore,
  safeLogApiSathiEvent,
  type ApiSathiCallResult,
  type ApiSathiFirestoreVerificationRecord,
} from './apiSathi';

export type ApiSathiRetryJobStatus = 'PENDING' | 'RETRYING' | 'SUCCEEDED' | 'EXHAUSTED' | 'CANCELLED';

export interface ApiSathiRetryAttemptLog {
  attempt: number;
  at: string;
  httpStatus: number;
  callId: string | null;
  errorCode: string | null;
  delayMs: number;
  outcome: 'SUCCEEDED' | 'RETRY_SCHEDULED' | 'TERMINAL_STOP' | 'EXHAUSTED';
}

export interface ApiSathiRetryJob {
  id: string;
  productSlug: string;
  intent: string;
  userId: string;
  idempotencyKey: string;
  /** Strictly server-side validated request fields; never serialized to admin UI. */
  sanitizedInput: Record<string, unknown>;
  /** PII-masked JSON safe for admin dashboard & support diagnostics. */
  maskedInputJson: string;
  status: ApiSathiRetryJobStatus;
  attemptCount: number;
  maxAttempts: number;
  lastHttpStatus: number;
  lastErrorCode: string;
  lastErrorMessage: string;
  lastCallId: string | null;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  history: ApiSathiRetryAttemptLog[];
}

export interface ApiSathiRetryJobPublic {
  id: string;
  productSlug: string;
  intent: string;
  userId: string;
  idempotencyKey: string;
  maskedInputJson: string;
  status: ApiSathiRetryJobStatus;
  attemptCount: number;
  maxAttempts: number;
  lastHttpStatus: number;
  lastErrorCode: string;
  lastErrorMessage: string;
  lastCallId: string | null;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueRetryJobInput {
  productSlug: string;
  intent: string;
  userId: string;
  idempotencyKey: string;
  sanitizedInput: Record<string, unknown>;
  httpStatus: number;
  errorCode: string;
  errorMessage: string;
  callId?: string | null;
  retryAfterSeconds?: number | null;
  maxAttempts?: number;
  nowMs?: number;
}

export interface ProcessQueueResult {
  processed: number;
  succeeded: number;
  rescheduled: number;
  exhausted: number;
  skippedNotDue: number;
}

export function toPublicRetryJob(job: ApiSathiRetryJob): ApiSathiRetryJobPublic {
  return {
    id: job.id,
    productSlug: job.productSlug,
    intent: job.intent,
    userId: job.userId,
    idempotencyKey: job.idempotencyKey,
    maskedInputJson: job.maskedInputJson,
    status: job.status,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    lastHttpStatus: job.lastHttpStatus,
    lastErrorCode: job.lastErrorCode,
    lastErrorMessage: job.lastErrorMessage,
    lastCallId: job.lastCallId,
    nextRetryAt: job.nextRetryAt,
    lastAttemptAt: job.lastAttemptAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export class ApiSathiRetryQueue {
  private readonly jobs = new Map<string, ApiSathiRetryJob>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private isSweeping = false;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterRatio: number;

  constructor(options: { baseDelayMs?: number; maxDelayMs?: number; jitterRatio?: number } = {}) {
    this.baseDelayMs = options.baseDelayMs ?? 5000;
    this.maxDelayMs = options.maxDelayMs ?? 300_000;
    this.jitterRatio = options.jitterRatio ?? 0.15;
  }

  enqueue(input: EnqueueRetryJobInput): ApiSathiRetryJob | null {
    if (!isRetryableApiSathiFailure(input.httpStatus, input.errorCode)) {
      return null;
    }

    const existingId = this.byIdempotencyKey.get(input.idempotencyKey);
    if (existingId && this.jobs.has(existingId)) {
      return this.jobs.get(existingId) || null;
    }

    const nowMs = input.nowMs ?? Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const delayMs = computeExponentialBackoffMs({
      attempt: 1,
      baseDelayMs: this.baseDelayMs,
      maxDelayMs: this.maxDelayMs,
      retryAfterSeconds: input.retryAfterSeconds,
      jitterRatio: this.jitterRatio,
    });
    const nextRetryAt = new Date(nowMs + delayMs).toISOString();
    const id = `rq_${nowMs.toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
    const maskedInputJson = JSON.stringify(maskSensitiveData(input.sanitizedInput || {}));

    const job: ApiSathiRetryJob = {
      id,
      productSlug: input.productSlug,
      intent: input.intent,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      sanitizedInput: { ...(input.sanitizedInput || {}) },
      maskedInputJson,
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: Math.max(1, Math.min(10, input.maxAttempts ?? 5)),
      lastHttpStatus: input.httpStatus,
      lastErrorCode: input.errorCode,
      lastErrorMessage: input.errorMessage,
      lastCallId: input.callId ?? null,
      nextRetryAt,
      lastAttemptAt: null,
      completedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      history: [],
    };

    this.jobs.set(id, job);
    this.byIdempotencyKey.set(input.idempotencyKey, id);

    // Enforce bounded ring buffer to protect memory in long-running Node processes
    if (this.jobs.size > 250) {
      const oldest = Array.from(this.jobs.values()).find(
        (j) => j.status === 'SUCCEEDED' || j.status === 'EXHAUSTED' || j.status === 'CANCELLED'
      );
      if (oldest) {
        this.jobs.delete(oldest.id);
        this.byIdempotencyKey.delete(oldest.idempotencyKey);
      }
    }

    safeLogApiSathiEvent('warn', 'Enqueued transient API Sathi failure for background retry', {
      jobId: job.id,
      productSlug: job.productSlug,
      idempotencyKey: job.idempotencyKey,
      httpStatus: job.lastHttpStatus,
      errorCode: job.lastErrorCode,
      nextRetryAt: job.nextRetryAt,
      request: input.sanitizedInput,
    });

    return job;
  }

  getSummary(): ApiSathiRetryQueueSummary {
    let pendingCount = 0;
    let retryingCount = 0;
    let succeededCount = 0;
    let exhaustedCount = 0;

    for (const job of this.jobs.values()) {
      if (job.status === 'PENDING') pendingCount += 1;
      else if (job.status === 'RETRYING') retryingCount += 1;
      else if (job.status === 'SUCCEEDED') succeededCount += 1;
      else if (job.status === 'EXHAUSTED') exhaustedCount += 1;
    }

    return {
      pendingCount,
      retryingCount,
      succeededCount,
      exhaustedCount,
      totalCount: this.jobs.size,
    };
  }

  getPublicJobs(limit = 50): ApiSathiRetryJobPublic[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit)
      .map(toPublicRetryJob);
  }

  getJobById(id: string): ApiSathiRetryJob | undefined {
    return this.jobs.get(id);
  }

  async processDueJobs(options: {
    nowMs?: number;
    forceAllPending?: boolean;
    apiKeyOverride?: string;
    fetchFn?: typeof fetch;
    firebaseIdToken?: string | null;
    onJobSettled?: (params: {
      job: ApiSathiRetryJob;
      result?: ApiSathiCallResult;
      auditRecord: ApiSathiFirestoreVerificationRecord;
    }) => void | Promise<void>;
  } = {}): Promise<ProcessQueueResult> {
    if (this.isSweeping) {
      return { processed: 0, succeeded: 0, rescheduled: 0, exhausted: 0, skippedNotDue: 0 };
    }
    this.isSweeping = true;

    const summary: ProcessQueueResult = {
      processed: 0,
      succeeded: 0,
      rescheduled: 0,
      exhausted: 0,
      skippedNotDue: 0,
    };

    try {
      const apiKey = options.apiKeyOverride || getApiSathiKey();
      if (!apiKey) return summary;

      const nowMs = options.nowMs ?? Date.now();
      const dueJobs = Array.from(this.jobs.values()).filter((job) => {
        if (job.status !== 'PENDING') return false;
        if (options.forceAllPending) return true;
        if (!job.nextRetryAt) return true;
        return Date.parse(job.nextRetryAt) <= nowMs;
      });

      summary.skippedNotDue =
        Array.from(this.jobs.values()).filter((j) => j.status === 'PENDING').length - dueJobs.length;

      if (dueJobs.length === 0) return summary;

      // Background queue does ONE clean upstream attempt per sweep using original Idempotency-Key
      // and leaves subsequent exponential intervals to the queue scheduler.
      const client = createApiSathiClient({
        apiKey,
        fetchFn: options.fetchFn,
        retry5xxDelaysMs: [],
        max429Retries: 0,
      });

      for (const job of dueJobs) {
        summary.processed += 1;
        job.status = 'RETRYING';
        job.attemptCount += 1;
        const attemptAt = new Date(nowMs).toISOString();
        job.lastAttemptAt = attemptAt;
        job.updatedAt = attemptAt;

        try {
          const { result } = await executeApiSathiProduct(client, job.productSlug, job.sanitizedInput, {
            idempotencyKey: job.idempotencyKey,
          });

          job.status = 'SUCCEEDED';
          job.lastHttpStatus = 200;
          job.lastErrorCode = result.verified ? '' : result.resultCode || 'NOT_VERIFIED';
          job.lastErrorMessage = result.verified ? '' : result.message;
          job.lastCallId = result.callId;
          job.nextRetryAt = null;
          job.completedAt = attemptAt;
          job.updatedAt = attemptAt;
          job.history.push({
            attempt: job.attemptCount,
            at: attemptAt,
            httpStatus: 200,
            callId: result.callId,
            errorCode: null,
            delayMs: 0,
            outcome: 'SUCCEEDED',
          });
          summary.succeeded += 1;

          const auditRecord = buildFirestoreVerificationRecord({
            userId: job.userId,
            intent: `${job.intent}_retry`,
            productSlug: job.productSlug,
            callId: result.callId,
            idempotencyKey: job.idempotencyKey,
            environment: result.environment,
            isSandboxTest: result.isSandboxTestKey,
            httpStatus: 200,
            verified: result.verified,
            outcome: result.outcome,
            errorCode: result.verified ? null : result.resultCode || 'NOT_VERIFIED',
            errorMessage: result.verified ? null : result.message,
            rawRequestPayload: job.sanitizedInput,
            rawResponsePayload: result.data,
            latencyMs: result.latencyMs,
          });

          if (options.firebaseIdToken) {
            void persistApiSathiVerificationToFirestore(auditRecord, {
              userIdToken: options.firebaseIdToken,
            });
          }
          if (options.onJobSettled) {
            await options.onJobSettled({ job, result, auditRecord });
          }

          safeLogApiSathiEvent('info', 'Background retry succeeded', {
            jobId: job.id,
            productSlug: job.productSlug,
            attempt: job.attemptCount,
            callId: result.callId,
            idempotencyKey: job.idempotencyKey,
          });
        } catch (err: any) {
          const apiErr =
            err instanceof ApiSathiException
              ? err
              : new ApiSathiException({
                  code: 'RETRY_ATTEMPT_ERROR',
                  message: err?.message || 'Retry attempt failed',
                  httpStatus: 500,
                  isRetryable: true,
                });

          const retryable = isRetryableApiSathiFailure(apiErr.httpStatus, apiErr.code);
          job.lastHttpStatus = apiErr.httpStatus;
          job.lastErrorCode = apiErr.code;
          job.lastErrorMessage = apiErr.message;
          if (apiErr.callId) job.lastCallId = apiErr.callId;
          job.updatedAt = attemptAt;

          if (!retryable || job.attemptCount >= job.maxAttempts) {
            job.status = 'EXHAUSTED';
            job.nextRetryAt = null;
            job.completedAt = attemptAt;
            job.history.push({
              attempt: job.attemptCount,
              at: attemptAt,
              httpStatus: apiErr.httpStatus,
              callId: apiErr.callId,
              errorCode: apiErr.code,
              delayMs: 0,
              outcome: retryable ? 'EXHAUSTED' : 'TERMINAL_STOP',
            });
            summary.exhausted += 1;

            const auditRecord = buildFirestoreVerificationRecord({
              userId: job.userId,
              intent: `${job.intent}_retry_exhausted`,
              productSlug: job.productSlug,
              callId: apiErr.callId,
              idempotencyKey: job.idempotencyKey,
              environment: client.isSandboxTestKey ? 'SANDBOX' : 'PRODUCTION',
              isSandboxTest: client.isSandboxTestKey,
              httpStatus: apiErr.httpStatus,
              verified: false,
              outcome: apiErr.isWalletEmptyError
                ? 'WALLET_EMPTY'
                : apiErr.httpStatus === 429
                ? 'RATE_LIMITED'
                : 'UPSTREAM_ERROR',
              errorCode: apiErr.code,
              errorMessage: apiErr.message,
              rawRequestPayload: job.sanitizedInput,
              rawResponsePayload: { error: apiErr.code },
              latencyMs: 0,
            });
            if (options.onJobSettled) {
              await options.onJobSettled({ job, auditRecord });
            }

            safeLogApiSathiEvent('error', 'Background retry stopped/exhausted', {
              jobId: job.id,
              productSlug: job.productSlug,
              attempt: job.attemptCount,
              httpStatus: apiErr.httpStatus,
              errorCode: apiErr.code,
            });
          } else {
            const delayMs = computeExponentialBackoffMs({
              attempt: job.attemptCount + 1,
              baseDelayMs: this.baseDelayMs,
              maxDelayMs: this.maxDelayMs,
              retryAfterSeconds: apiErr.retryAfterSeconds,
              jitterRatio: this.jitterRatio,
            });
            job.status = 'PENDING';
            job.nextRetryAt = new Date(nowMs + delayMs).toISOString();
            job.history.push({
              attempt: job.attemptCount,
              at: attemptAt,
              httpStatus: apiErr.httpStatus,
              callId: apiErr.callId,
              errorCode: apiErr.code,
              delayMs,
              outcome: 'RETRY_SCHEDULED',
            });
            summary.rescheduled += 1;
          }
        }
      }

      return summary;
    } finally {
      this.isSweeping = false;
    }
  }

  startBackgroundWorker(
    options: {
      intervalMs?: number;
      onJobSettled?: (params: {
        job: ApiSathiRetryJob;
        result?: ApiSathiCallResult;
        auditRecord: ApiSathiFirestoreVerificationRecord;
      }) => void | Promise<void>;
    } = {}
  ): () => void {
    if (this.timer) return () => this.stopBackgroundWorker();
    const intervalMs = Math.max(2000, options.intervalMs ?? 15_000);
    this.timer = setInterval(() => {
      void this.processDueJobs({ onJobSettled: options.onJobSettled });
    }, intervalMs);
    if (typeof (this.timer as any)?.unref === 'function') {
      (this.timer as any).unref();
    }
    return () => this.stopBackgroundWorker();
  }

  stopBackgroundWorker(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const defaultApiSathiRetryQueue = new ApiSathiRetryQueue();
