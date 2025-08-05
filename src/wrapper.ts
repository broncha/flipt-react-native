// TypeScript wrapper to match flipt-client-js API
import {
  FliptClient as UniffiFliptClient,
  ClientOptions as UniffiClientOptions,
  EvaluationRequest as UniffiEvaluationRequest,
  Authentication,
} from './generated/flipt_react_native';

// Match the flipt-client-js API exactly
export interface ClientOptions {
  /**
   * The environment to use when evaluating flags (Flipt v2)
   * @defaultValue `default`
   */
  environment?: string;
  /**
   * The namespace to use when evaluating flags.
   * @defaultValue `default`
   */
  namespace?: string;
  /**
   * The URL of the upstream Flipt instance.
   * @defaultValue `http://localhost:8080`
   */
  url?: string;
  /**
   * The interval (seconds) in which to fetch new flag state.
   * @defaultValue `120` seconds.
   */
  updateInterval?: number;
  /**
   * The authentication client token.
   */
  authentication?: {
    client_token?: string;
    jwt_token?: string;
  };
  /**
   * The reference to use when fetching flag state.
   */
  reference?: string;
  /**
   * The mode to use for fetching flag state updates.
   * @defaultValue `polling`
   */
  fetchMode?: 'polling' | 'streaming';
}

// Match the flipt-client-js API exactly
export interface EvaluationRequest {
  /**
   * Feature flag key
   */
  flagKey: string;
  /**
   * Entity identifier
   */
  entityId: string;
  /**
   * Context information for flag evaluation
   */
  context: Record<string, string>;
}

// Re-export all response types as-is (they're already correct)
export {
  VariantEvaluationResponse,
  BooleanEvaluationResponse,
  BatchEvaluationResponse,
  ErrorEvaluationResponse,
  EvaluationResponse,
  Flag,
} from './generated/flipt_react_native';

/**
 * Flipt Client that matches the flipt-client-js API
 */
export class FliptClient {
  private inner: UniffiFliptClient;

  constructor(options: ClientOptions = {}) {
    // Convert from our nice API to UniFFI's API
    let authentication;
    if (options.authentication?.client_token) {
      authentication = new Authentication.ClientToken(
        options.authentication.client_token
      );
    } else if (options.authentication?.jwt_token) {
      authentication = new Authentication.JwtToken(
        options.authentication.jwt_token
      );
    }

    const uniffiOptions: UniffiClientOptions = {
      environment: options.environment,
      namespace: options.namespace,
      url: options.url,
      updateInterval: options.updateInterval
        ? BigInt(options.updateInterval)
        : BigInt(120),
      authentication,
      reference: options.reference,
      fetchMode: options.fetchMode || 'polling',
    };

    this.inner = new UniffiFliptClient(uniffiOptions);
  }

  /**
   * Evaluate a variant flag
   */
  evaluateVariant(request: EvaluationRequest) {
    // Convert Record<string, string> to Map<string, string>
    const uniffiRequest: UniffiEvaluationRequest = {
      flagKey: request.flagKey,
      entityId: request.entityId,
      context: new Map(Object.entries(request.context)),
    };

    return this.inner.evaluateVariant(uniffiRequest);
  }

  /**
   * Evaluate a boolean flag
   */
  evaluateBoolean(request: EvaluationRequest) {
    const uniffiRequest: UniffiEvaluationRequest = {
      flagKey: request.flagKey,
      entityId: request.entityId,
      context: new Map(Object.entries(request.context)),
    };

    return this.inner.evaluateBoolean(uniffiRequest);
  }

  /**
   * Evaluate multiple flags in a batch
   */
  evaluateBatch(requests: EvaluationRequest[]) {
    const uniffiRequests = requests.map((request) => ({
      flagKey: request.flagKey,
      entityId: request.entityId,
      context: new Map(Object.entries(request.context)),
    }));

    return this.inner.evaluateBatch(uniffiRequests);
  }

  /**
   * List all flags
   */
  listFlags() {
    return this.inner.listFlags();
  }

  /**
   * Get current snapshot hash for change detection
   */
  getSnapshotHash() {
    return this.inner.getSnapshotHash();
  }

  /**
   * Check if snapshot has changed since previous hash
   * @param previousHash - The hash from previous check (null for first check)
   * @returns boolean - true if snapshot changed, false if unchanged
   */
  refresh(previousHash?: string | null): boolean {
    return this.inner.refresh(previousHash || undefined);
  }

  /**
   * Close the client
   */
  close() {
    this.inner.close();
  }
}
