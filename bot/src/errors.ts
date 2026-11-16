/**
 * Shared error types for the webhook delivery contract.
 *
 * AmbiguousOperationError: an irreversible external effect (a paid provider
 * call, a reply) may or may not have happened. The operation must STOP:
 * no automatic replay of the uncertain effect. The webhook records the
 * delivery 'ambiguous' and acks it.
 *
 * ClaimLostError: this worker's claim was revoked (watchdog abort / fencing
 * token mismatch). Another delivery governs the update; fail quietly so the
 * webhook answers 500 (retriable) without further effects.
 */
export class AmbiguousOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousOperationError';
  }
}

export class ClaimLostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimLostError';
  }
}

/** Provider returned a definitive response (incl. HTTP errors): no spend ambiguity. */
export class ScanDefinitiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanDefinitiveError';
  }
}

/** Provider call outcome unknown (timeout/abort/no response): spend is uncertain. */
export class ScanAmbiguousError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanAmbiguousError';
  }
}

/** Per-delivery context the webhook attaches to the raw update object. */
export interface NtfDeliveryContext {
  claimToken: string;
  signal: AbortSignal;
}

export function getNtf(update: unknown): NtfDeliveryContext | undefined {
  return (update as { __ntf?: NtfDeliveryContext } | null | undefined)?.__ntf;
}

/** Cancellation checkpoint between external steps (for calls that cannot carry the signal). */
export function throwIfAborted(ntf: NtfDeliveryContext | undefined): void {
  if (ntf?.signal.aborted) {
    throw new ClaimLostError('delivery aborted by watchdog');
  }
}
