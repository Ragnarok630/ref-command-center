/* =========================================================
   K630 DRAGON COMMAND CENTER
   Supabase Edge Function: AFK Request

   File:
   supabase/functions/afk-request/index.ts

   Version:
   630.3.0

   Actions:
   - create:
     Public AFK request indienen.

   - public-approved:
     Alleen goedgekeurde AFK-statussen openbaar laden.
     Wordt gebruikt door de centrale Player Note Engine.

   - list:
     Alle AFK requests voor Owner/Admin laden.

   - update:
     Status en adminnotitie aanpassen.

   - delete:
     AFK request verwijderen.

   Required Supabase secret:
   - K630_GITHUB_TOKEN

   Optional Supabase secrets:
   - K630_GITHUB_OWNER
   - K630_GITHUB_REPOSITORY
   - K630_GITHUB_BRANCH
========================================================= */

const FUNCTION_VERSION =
  "630.3.0";

const DEFAULT_GITHUB_OWNER =
  "Ragnarok630";

const DEFAULT_GITHUB_REPOSITORY =
  "k630-public-data";

const DEFAULT_GITHUB_BRANCH =
  "main";

const REQUEST_DIRECTORY =
  "assets/data/afk/requests";

const MAX_NOTE_LENGTH =
  500;

const MAX_PLAYER_NAME_LENGTH =
  80;

const MAX_SEASON_LABEL_LENGTH =
  150;

const MAX_REVIEWER_LENGTH =
  200;

const MAX_PARALLEL_REQUESTS =
  8;

const ALLOWED_REASONS =
  Object.freeze([
    "vacation",
    "work",
    "private"
  ]);

const ALLOWED_WEEKS =
  Object.freeze([
    0,
    1,
    2,
    3,
    4,
    5,
    6
  ]);

const ALLOWED_STATUSES =
  Object.freeze([
    "pending",
    "approved",
    "rejected"
  ]);

const ALLOWED_ADMIN_ROLES =
  Object.freeze([
    "owner",
    "admin"
  ]);

const CORS_HEADERS =
  Object.freeze({
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

    "Content-Type":
      "application/json; charset=utf-8",

    "Cache-Control":
      "no-store"
  });

type AfkStatus =
  | "pending"
  | "approved"
  | "rejected";

type AfkAction =
  | "create"
  | "public-approved"
  | "list"
  | "update"
  | "delete";

interface PublicAfkRequestInput {
  action?: unknown;
  playerId?: unknown;
  playerName?: unknown;
  reason?: unknown;
  weeks?: unknown;
  note?: unknown;
  seasonNumber?: unknown;
  seasonLabel?: unknown;
  website?: unknown;
}

interface AdminAfkRequestInput {
  action?: unknown;
  requestId?: unknown;
  repositoryPath?: unknown;
  filename?: unknown;
  sha?: unknown;
  status?: unknown;
  adminNote?: unknown;
  reviewedAt?: unknown;
}

interface NormalizedPublicAfkRequest {
  playerId: string;
  playerName: string;
  reason: string;
  weeks: number[];
  note: string;
  seasonNumber: number | null;
  seasonLabel: string;
}

interface StoredAfkRequest
  extends NormalizedPublicAfkRequest {
  schemaVersion: number;
  requestId: string;
  status: AfkStatus;
  adminNote: string;
  reviewedAt: string;
  reviewedBy: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  source: "public-afk-service";
  functionVersion: string;
}

interface GitHubConfiguration {
  token: string;
  owner: string;
  repository: string;
  branch: string;
}

interface GitHubDirectoryItem {
  type?: unknown;
  name?: unknown;
  path?: unknown;
  sha?: unknown;
  url?: unknown;
  download_url?: unknown;
}

interface GitHubFileResult {
  path: string;
  name: string;
  sha: string;
  data: Record<string, unknown>;
}

interface AuthenticatedAdministrator {
  id: string;
  email: string;
  role: string;
  displayName: string;
}

interface SupabaseAuthUser {
  id?: unknown;
  email?: unknown;
  app_metadata?: Record<
    string,
    unknown
  >;
  user_metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   GENERAL HELPERS
========================================================= */

function normalizeText(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

function normalizeLower(
  value: unknown
): string {
  return normalizeText(
    value
  ).toLowerCase();
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function createJsonResponse(
  status: number,
  body: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers:
        CORS_HEADERS
    }
  );
}

function createNamedError(
  name: string,
  message: string
): Error {
  const error =
    new Error(message);

  error.name =
    name;

  return error;
}

function createRequestError(
  message: string
): Error {
  return createNamedError(
    "K630AfkRequestError",
    message
  );
}

function createAuthorizationError(
  message: string
): Error {
  return createNamedError(
    "K630AfkAuthorizationError",
    message
  );
}

function createNotFoundError(
  message: string
): Error {
  return createNamedError(
    "K630AfkNotFoundError",
    message
  );
}

function getErrorStatus(
  error: unknown
): number {
  if (
    !(error instanceof Error)
  ) {
    return 500;
  }

  if (
    error.name ===
    "K630AfkRequestError"
  ) {
    return 400;
  }

  if (
    error.name ===
    "K630AfkAuthorizationError"
  ) {
    return 403;
  }

  if (
    error.name ===
    "K630AfkNotFoundError"
  ) {
    return 404;
  }

  return 500;
}

function getPublicErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error &&
    [
      "K630AfkRequestError",
      "K630AfkAuthorizationError",
      "K630AfkNotFoundError"
    ].includes(error.name)
  ) {
    return error.message;
  }

  return (
    "The AFK request could not be processed."
  );
}

/* =========================================================
   ENVIRONMENT
========================================================= */

function getRequiredSecret(
  name: string
): string {
  const value =
    normalizeText(
      Deno.env.get(name)
    );

  if (!value) {
    throw new Error(
      `Required Supabase secret ${name} is missing.`
    );
  }

  return value;
}

function getOptionalSecret(
  name: string,
  fallback: string
): string {
  return (
    normalizeText(
      Deno.env.get(name)
    ) ||
    fallback
  );
}

function getGitHubConfiguration():
  GitHubConfiguration {
  return {
    token:
      getRequiredSecret(
        "K630_GITHUB_TOKEN"
      ),

    owner:
      getOptionalSecret(
        "K630_GITHUB_OWNER",
        DEFAULT_GITHUB_OWNER
      ),

    repository:
      getOptionalSecret(
        "K630_GITHUB_REPOSITORY",
        DEFAULT_GITHUB_REPOSITORY
      ),

    branch:
      getOptionalSecret(
        "K630_GITHUB_BRANCH",
        DEFAULT_GITHUB_BRANCH
      )
  };
}

/* =========================================================
   GITHUB HELPERS
========================================================= */

function buildGitHubContentsEndpoint(
  configuration:
    GitHubConfiguration,
  path:
    string
): string {
  const encodedPath =
    path
      .split("/")
      .map(
        encodeURIComponent
      )
      .join("/");

  return (
    "https://api.github.com/repos/" +
    `${encodeURIComponent(
      configuration.owner
    )}/` +
    `${encodeURIComponent(
      configuration.repository
    )}/` +
    `contents/${encodedPath}`
  );
}

function createGitHubHeaders(
  configuration:
    GitHubConfiguration
): Record<string, string> {
  return {
    Accept:
      "application/vnd.github+json",

    Authorization:
      `Bearer ${configuration.token}`,

    "X-GitHub-Api-Version":
      "2022-11-28",

    "Content-Type":
      "application/json"
  };
}

async function readResponsePayload(
  response: Response
): Promise<unknown> {
  const raw =
    await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function getGitHubErrorMessage(
  payload: unknown,
  status: number
): string {
  if (
    isRecord(payload)
  ) {
    const message =
      normalizeText(
        payload.message
      );

    if (message) {
      return message;
    }
  }

  return (
    `GitHub returned status ${status}.`
  );
}

/* =========================================================
   UTF-8 / BASE64
========================================================= */

function encodeUtf8ToBase64(
  value: string
): string {
  const bytes =
    new TextEncoder()
      .encode(value);

  let binary =
    "";

  const chunkSize =
    8192;

  for (
    let index = 0;
    index < bytes.length;
    index += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        index,
        Math.min(
          index + chunkSize,
          bytes.length
        )
      );

    binary +=
      String.fromCharCode(
        ...chunk
      );
  }

  return btoa(binary);
}

function decodeBase64ToUtf8(
  value: string
): string {
  const compact =
    normalizeText(value)
      .replace(
        /\s+/g,
        ""
      );

  if (!compact) {
    return "";
  }

  const binary =
    atob(compact);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return new TextDecoder()
    .decode(bytes);
}

/* =========================================================
   PUBLIC VALIDATION
========================================================= */

function normalizePlayerId(
  value: unknown
): string {
  const playerId =
    normalizeText(value)
      .replace(
        /\s+/g,
        ""
      );

  if (
    !/^\d{5,12}$/.test(
      playerId
    )
  ) {
    throw createRequestError(
      "A valid Player ID is required."
    );
  }

  return playerId;
}

function normalizePlayerName(
  value: unknown
): string {
  const playerName =
    normalizeText(value);

  if (!playerName) {
    throw createRequestError(
      "A Player Name is required."
    );
  }

  if (
    playerName.length >
    MAX_PLAYER_NAME_LENGTH
  ) {
    throw createRequestError(
      `Player Name may contain a maximum of ${MAX_PLAYER_NAME_LENGTH} characters.`
    );
  }

  return playerName;
}

function normalizeReason(
  value: unknown
): string {
  const reason =
    normalizeLower(value);

  if (
    !ALLOWED_REASONS.includes(
      reason
    )
  ) {
    throw createRequestError(
      "A valid AFK reason is required."
    );
  }

  return reason;
}

function normalizeWeeks(
  value: unknown
): number[] {
  if (
    !Array.isArray(value)
  ) {
    throw createRequestError(
      "At least one AFK week is required."
    );
  }

  const weeks =
    Array.from(
      new Set(
        value.map(item => {
          const cleaned =
            normalizeText(item)
              .toUpperCase()
              .replace(
                /^W/,
                ""
              );

          return Number(cleaned);
        })
      )
    )
      .filter(item => {
        return (
          Number.isInteger(item) &&
          ALLOWED_WEEKS.includes(
            item
          )
        );
      })
      .sort(
        (left, right) =>
          left - right
      );

  if (
    weeks.length === 0
  ) {
    throw createRequestError(
      "At least one valid AFK week is required."
    );
  }

  return weeks;
}

function normalizePublicNote(
  value: unknown
): string {
  const note =
    normalizeText(value);

  if (
    note.length >
    MAX_NOTE_LENGTH
  ) {
    throw createRequestError(
      `The note may contain a maximum of ${MAX_NOTE_LENGTH} characters.`
    );
  }

  return note;
}

function normalizeSeasonNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    normalizeText(value) === ""
  ) {
    return null;
  }

  const seasonNumber =
    Number(value);

  if (
    !Number.isInteger(
      seasonNumber
    ) ||
    seasonNumber < 1 ||
    seasonNumber > 999
  ) {
    throw createRequestError(
      "The season number is invalid."
    );
  }

  return seasonNumber;
}

function normalizeSeasonLabel(
  value: unknown
): string {
  const seasonLabel =
    normalizeText(value);

  if (
    seasonLabel.length >
    MAX_SEASON_LABEL_LENGTH
  ) {
    throw createRequestError(
      "The season label is too long."
    );
  }

  return seasonLabel;
}

function validateHoneypot(
  value: unknown
): void {
  if (
    normalizeText(value)
  ) {
    throw createRequestError(
      "The AFK request could not be accepted."
    );
  }
}

function normalizePublicRequest(
  input:
    PublicAfkRequestInput
): NormalizedPublicAfkRequest {
  validateHoneypot(
    input.website
  );

  return {
    playerId:
      normalizePlayerId(
        input.playerId
      ),

    playerName:
      normalizePlayerName(
        input.playerName
      ),

    reason:
      normalizeReason(
        input.reason
      ),

    weeks:
      normalizeWeeks(
        input.weeks
      ),

    note:
      normalizePublicNote(
        input.note
      ),

    seasonNumber:
      normalizeSeasonNumber(
        input.seasonNumber
      ),

    seasonLabel:
      normalizeSeasonLabel(
        input.seasonLabel
      )
  };
}

/* =========================================================
   ADMIN VALIDATION
========================================================= */

function normalizeAction(
  value: unknown
): AfkAction {
  const action =
    normalizeLower(value);

  if (!action) {
    return "create";
  }

  if (
    action === "create" ||
    action === "public-approved" ||
    action === "list" ||
    action === "update" ||
    action === "delete"
  ) {
    return action;
  }

  throw createRequestError(
    "The requested AFK action is invalid."
  );
}

function normalizeRequestId(
  value: unknown
): string {
  const requestId =
    normalizeText(value);

  if (
    !/^afk-[a-zA-Z0-9_-]{10,180}$/.test(
      requestId
    )
  ) {
    throw createRequestError(
      "The AFK request ID is invalid."
    );
  }

  return requestId;
}

function normalizeStatus(
  value: unknown
): AfkStatus {
  const status =
    normalizeLower(value);

  if (
    !ALLOWED_STATUSES.includes(
      status
    )
  ) {
    throw createRequestError(
      "The AFK request status is invalid."
    );
  }

  return status as AfkStatus;
}

function normalizeAdminNote(
  value: unknown
): string {
  const adminNote =
    normalizeText(value);

  if (
    adminNote.length >
    MAX_NOTE_LENGTH
  ) {
    throw createRequestError(
      `The administrator note may contain a maximum of ${MAX_NOTE_LENGTH} characters.`
    );
  }

  return adminNote;
}

function normalizeReviewedAt(
  value: unknown
): string {
  const input =
    normalizeText(value);

  if (!input) {
    return new Date()
      .toISOString();
  }

  const date =
    new Date(input);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createRequestError(
      "The review date is invalid."
    );
  }

  return date.toISOString();
}

function normalizeRepositoryPath(
  requestId:
    string,
  repositoryPath:
    unknown,
  filename:
    unknown
): string {
  const expectedFilename =
    `${requestId}.json`;

  const expectedPath =
    `${REQUEST_DIRECTORY}/${expectedFilename}`;

  const suppliedFilename =
    normalizeText(filename);

  if (
    suppliedFilename &&
    suppliedFilename !==
      expectedFilename
  ) {
    throw createRequestError(
      "The AFK request filename is invalid."
    );
  }

  const suppliedPath =
    normalizeText(
      repositoryPath
    )
      .replace(
        /\\/g,
        "/"
      )
      .replace(
        /^\/+/,
        ""
      );

  if (
    suppliedPath &&
    suppliedPath !==
      expectedPath
  ) {
    throw createRequestError(
      "The AFK request path is invalid."
    );
  }

  return expectedPath;
}

/* =========================================================
   REQUEST ID
========================================================= */

function createRequestId(
  playerId: string
): string {
  const timestamp =
    new Date()
      .toISOString()
      .replace(
        /[-:.TZ]/g,
        ""
      );

  const randomPart =
    crypto
      .randomUUID()
      .replaceAll(
        "-",
        ""
      )
      .slice(
        0,
        12
      );

  return (
    `afk-${timestamp}-` +
    `${playerId}-` +
    randomPart
  );
}

/* =========================================================
   SUPABASE AUTH
========================================================= */

function getBearerToken(
  request: Request
): string {
  const authorization =
    normalizeText(
      request.headers.get(
        "authorization"
      )
    );

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  if (
    !match ||
    !normalizeText(
      match[1]
    )
  ) {
    throw createAuthorizationError(
      "You must be signed in to manage AFK requests."
    );
  }

  return normalizeText(
    match[1]
  );
}

async function authenticateAdministrator(
  request: Request
): Promise<AuthenticatedAdministrator> {
  const accessToken =
    getBearerToken(request);

  const supabaseUrl =
    getRequiredSecret(
      "SUPABASE_URL"
    );

  const supabaseAnonKey =
    getRequiredSecret(
      "SUPABASE_ANON_KEY"
    );

  const userResponse =
    await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          apikey:
            supabaseAnonKey,

          Accept:
            "application/json"
        }
      }
    );

  if (
    !userResponse.ok
  ) {
    throw createAuthorizationError(
      "Your login session is invalid or expired."
    );
  }

  const userPayload =
    await userResponse.json();

  if (
    !isRecord(
      userPayload
    )
  ) {
    throw createAuthorizationError(
      "Your Supabase account could not be verified."
    );
  }

  const user =
    userPayload as
      SupabaseAuthUser;

  const userId =
    normalizeText(
      user.id
    );

  if (!userId) {
    throw createAuthorizationError(
      "Your Supabase account could not be verified."
    );
  }

  const profileUrl =
    (
      `${supabaseUrl}/rest/v1/profiles` +
      `?id=eq.${encodeURIComponent(
        userId
      )}` +
      "&select=id,email,role,active" +
      "&limit=1"
    );

  const profileResponse =
    await fetch(
      profileUrl,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          apikey:
            supabaseAnonKey,

          Accept:
            "application/json",

          Prefer:
            "return=representation"
        }
      }
    );

  if (
    !profileResponse.ok
  ) {
    throw createAuthorizationError(
      "Your Command Center profile could not be loaded."
    );
  }

  const profilePayload =
    await profileResponse.json();

  const profile =
    Array.isArray(
      profilePayload
    )
      ? profilePayload[0]
      : null;

  if (
    !isRecord(profile)
  ) {
    throw createAuthorizationError(
      "No Command Center profile is linked to your account."
    );
  }

  if (
    profile.active !==
    true
  ) {
    throw createAuthorizationError(
      "Your Command Center account is inactive."
    );
  }

  const role =
    normalizeLower(
      profile.role
    );

  if (
    !ALLOWED_ADMIN_ROLES.includes(
      role
    )
  ) {
    throw createAuthorizationError(
      "Only Owner and Admin accounts may manage AFK requests."
    );
  }

  const displayName =
    (
      normalizeText(
        profile.email
      ) ||
      normalizeText(
        user.email
      ) ||
      role
    ).slice(
      0,
      MAX_REVIEWER_LENGTH
    );

  return {
    id:
      userId,

    email:
      normalizeText(
        profile.email ??
        user.email
      ),

    role,

    displayName
  };
}

/* =========================================================
   CONCURRENCY
========================================================= */

async function mapWithConcurrency<
  T,
  R
>(
  items:
    T[],
  limit:
    number,
  worker:
    (item: T) => Promise<R>
): Promise<R[]> {
  const results =
    new Array<R>(
      items.length
    );

  let nextIndex =
    0;

  async function runWorker():
    Promise<void> {
    while (
      nextIndex <
      items.length
    ) {
      const currentIndex =
        nextIndex;

      nextIndex +=
        1;

      results[currentIndex] =
        await worker(
          items[currentIndex]
        );
    }
  }

  const workerCount =
    Math.min(
      Math.max(
        1,
        limit
      ),
      Math.max(
        1,
        items.length
      )
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount
      },
      () =>
        runWorker()
    )
  );

  return results;
}

/* =========================================================
   GITHUB OPERATIONS
========================================================= */

async function listGitHubDirectory():
  Promise<GitHubDirectoryItem[]> {
  const configuration =
    getGitHubConfiguration();

  const endpoint =
    buildGitHubContentsEndpoint(
      configuration,
      REQUEST_DIRECTORY
    );

  const response =
    await fetch(
      `${endpoint}?ref=${encodeURIComponent(
        configuration.branch
      )}`,
      {
        method:
          "GET",

        headers:
          createGitHubHeaders(
            configuration
          )
      }
    );

  if (
    response.status ===
    404
  ) {
    return [];
  }

  const payload =
    await readResponsePayload(
      response
    );

  if (
    !response.ok
  ) {
    throw new Error(
      "GitHub could not list the AFK requests: " +
      getGitHubErrorMessage(
        payload,
        response.status
      )
    );
  }

  if (
    !Array.isArray(
      payload
    )
  ) {
    throw new Error(
      "GitHub returned an invalid AFK directory response."
    );
  }

  return payload.filter(
    item =>
      isRecord(item)
  ) as GitHubDirectoryItem[];
}

async function createGitHubFile(
  filePath:
    string,
  data:
    Record<string, unknown>,
  commitMessage:
    string
): Promise<string> {
  const configuration =
    getGitHubConfiguration();

  const endpoint =
    buildGitHubContentsEndpoint(
      configuration,
      filePath
    );

  const content =
    JSON.stringify(
      data,
      null,
      2
    ) +
    "\n";

  const response =
    await fetch(
      endpoint,
      {
        method:
          "PUT",

        headers:
          createGitHubHeaders(
            configuration
          ),

        body:
          JSON.stringify({
            message:
              commitMessage,

            content:
              encodeUtf8ToBase64(
                content
              ),

            branch:
              configuration.branch
          })
      }
    );

  const payload =
    await readResponsePayload(
      response
    );

  if (
    !response.ok
  ) {
    throw new Error(
      "GitHub could not create the AFK request: " +
      getGitHubErrorMessage(
        payload,
        response.status
      )
    );
  }

  if (
    isRecord(payload) &&
    isRecord(
      payload.content
    )
  ) {
    return normalizeText(
      payload.content.sha
    );
  }

  return "";
}

async function readGitHubFile(
  filePath:
    string
): Promise<GitHubFileResult> {
  const configuration =
    getGitHubConfiguration();

  const endpoint =
    buildGitHubContentsEndpoint(
      configuration,
      filePath
    );

  const response =
    await fetch(
      `${endpoint}?ref=${encodeURIComponent(
        configuration.branch
      )}`,
      {
        method:
          "GET",

        headers:
          createGitHubHeaders(
            configuration
          )
      }
    );

  if (
    response.status ===
    404
  ) {
    throw createNotFoundError(
      "The AFK request no longer exists."
    );
  }

  const payload =
    await readResponsePayload(
      response
    );

  if (
    !response.ok ||
    !isRecord(payload)
  ) {
    throw new Error(
      "GitHub could not read the AFK request: " +
      getGitHubErrorMessage(
        payload,
        response.status
      )
    );
  }

  const sha =
    normalizeText(
      payload.sha
    );

  const name =
    normalizeText(
      payload.name
    );

  const path =
    normalizeText(
      payload.path
    );

  const encodedContent =
    normalizeText(
      payload.content
    );

  if (
    !sha ||
    !encodedContent
  ) {
    throw new Error(
      "GitHub returned incomplete AFK request data."
    );
  }

  const decoded =
    decodeBase64ToUtf8(
      encodedContent
    );

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        decoded
      );
  } catch (_error) {
    throw new Error(
      "The stored AFK request contains invalid JSON."
    );
  }

  if (
    !isRecord(parsed)
  ) {
    throw new Error(
      "The stored AFK request is not a JSON object."
    );
  }

  return {
    path:
      path ||
      filePath,

    name,

    sha,

    data:
      parsed
  };
}

async function updateGitHubFile(
  filePath:
    string,
  sha:
    string,
  data:
    Record<string, unknown>,
  commitMessage:
    string
): Promise<string> {
  const configuration =
    getGitHubConfiguration();

  const endpoint =
    buildGitHubContentsEndpoint(
      configuration,
      filePath
    );

  const content =
    JSON.stringify(
      data,
      null,
      2
    ) +
    "\n";

  const response =
    await fetch(
      endpoint,
      {
        method:
          "PUT",

        headers:
          createGitHubHeaders(
            configuration
          ),

        body:
          JSON.stringify({
            message:
              commitMessage,

            content:
              encodeUtf8ToBase64(
                content
              ),

            sha,

            branch:
              configuration.branch
          })
      }
    );

  const payload =
    await readResponsePayload(
      response
    );

  if (
    !response.ok
  ) {
    throw new Error(
      "GitHub could not update the AFK request: " +
      getGitHubErrorMessage(
        payload,
        response.status
      )
    );
  }

  if (
    isRecord(payload) &&
    isRecord(
      payload.content
    )
  ) {
    return normalizeText(
      payload.content.sha
    );
  }

  return "";
}

async function deleteGitHubFile(
  filePath:
    string,
  sha:
    string,
  commitMessage:
    string
): Promise<void> {
  const configuration =
    getGitHubConfiguration();

  const endpoint =
    buildGitHubContentsEndpoint(
      configuration,
      filePath
    );

  const response =
    await fetch(
      endpoint,
      {
        method:
          "DELETE",

        headers:
          createGitHubHeaders(
            configuration
          ),

        body:
          JSON.stringify({
            message:
              commitMessage,

            sha,

            branch:
              configuration.branch
          })
      }
    );

  const payload =
    await readResponsePayload(
      response
    );

  if (
    !response.ok
  ) {
    throw new Error(
      "GitHub could not delete the AFK request: " +
      getGitHubErrorMessage(
        payload,
        response.status
      )
    );
  }
}

/* =========================================================
   SHARED REQUEST LOADING
========================================================= */

async function loadStoredRequests():
  Promise<Record<string, unknown>[]> {
  const directory =
    await listGitHubDirectory();

  const files =
    directory.filter(
      item => {
        return (
          normalizeText(
            item.type
          ) ===
            "file" &&
          /\.json$/i.test(
            normalizeText(
              item.name
            )
          )
        );
      }
    );

  const loaded =
    await mapWithConcurrency(
      files,
      MAX_PARALLEL_REQUESTS,
      async file => {
        const filePath =
          normalizeText(
            file.path
          );

        if (!filePath) {
          return null;
        }

        try {
          const storedFile =
            await readGitHubFile(
              filePath
            );

          return {
            ...storedFile.data,

            repositoryPath:
              storedFile.path,

            filename:
              storedFile.name ||
              normalizeText(
                file.name
              ),

            sha:
              storedFile.sha
          };
        } catch (error) {
          console.error(
            "[K630 AFK Request] File could not be loaded:",
            filePath,
            error
          );

          return null;
        }
      }
    );

  return loaded
    .filter(
      (
        item
      ): item is Record<
        string,
        unknown
      > =>
        isRecord(item)
    )
    .sort(
      (
        left,
        right
      ) => {
        const leftDate =
          new Date(
            normalizeText(
              left.createdAt ??
              left.submittedAt
            )
          ).getTime();

        const rightDate =
          new Date(
            normalizeText(
              right.createdAt ??
              right.submittedAt
            )
          ).getTime();

        return (
          (
            Number.isNaN(
              rightDate
            )
              ? 0
              : rightDate
          ) -
          (
            Number.isNaN(
              leftDate
            )
              ? 0
              : leftDate
          )
        );
      }
    );
}

/* =========================================================
   CREATE
========================================================= */

async function handleCreateAction(
  input:
    PublicAfkRequestInput
): Promise<Response> {
  const normalized =
    normalizePublicRequest(
      input
    );

  const now =
    new Date()
      .toISOString();

  const requestId =
    createRequestId(
      normalized.playerId
    );

  const storedRequest:
    StoredAfkRequest = {
    schemaVersion:
      2,

    requestId,

    status:
      "pending",

    playerId:
      normalized.playerId,

    playerName:
      normalized.playerName,

    reason:
      normalized.reason,

    weeks:
      normalized.weeks,

    note:
      normalized.note,

    seasonNumber:
      normalized.seasonNumber,

    seasonLabel:
      normalized.seasonLabel,

    adminNote:
      "",

    reviewedAt:
      "",

    reviewedBy:
      "",

    submittedAt:
      now,

    createdAt:
      now,

    updatedAt:
      now,

    source:
      "public-afk-service",

    functionVersion:
      FUNCTION_VERSION
  };

  const filePath =
    `${REQUEST_DIRECTORY}/${requestId}.json`;

  await createGitHubFile(
    filePath,
    storedRequest as unknown as
      Record<string, unknown>,
    `Add AFK request ${requestId}`
  );

  return createJsonResponse(
    201,
    {
      success:
        true,

      action:
        "create",

      requestId,

      status:
        "pending",

      repositoryPath:
        filePath,

      message:
        "Your AFK request was sent to the Kingdom 630 administration.",

      version:
        FUNCTION_VERSION
    }
  );
}

/* =========================================================
   PUBLIC APPROVED AFK STATUSES
========================================================= */

function createPublicApprovedRecord(
  request:
    Record<string, unknown>
): Record<string, unknown> {
  const weeks =
    Array.isArray(
      request.weeks
    )
      ? request.weeks
          .map(
            value =>
              Number(
                normalizeText(value)
                  .toUpperCase()
                  .replace(
                    /^W/,
                    ""
                  )
              )
          )
          .filter(
            value =>
              Number.isInteger(
                value
              ) &&
              ALLOWED_WEEKS.includes(
                value
              )
          )
          .sort(
            (
              left,
              right
            ) =>
              left - right
          )
      : [];

  return {
    requestId:
      normalizeText(
        request.requestId ??
        request.request_id ??
        request.id
      ),

    playerId:
      normalizeText(
        request.playerId ??
        request.player_id
      ),

    playerName:
      normalizeText(
        request.playerName ??
        request.player_name
      ),

    status:
      "approved",

    reason:
      normalizeText(
        request.reason
      ),

    weeks,

    note:
      normalizeText(
        request.note ??
        request.playerNote
      ),

    adminNote:
      normalizeText(
        request.adminNote ??
        request.admin_note
      ),

    seasonNumber:
      Number.isInteger(
        Number(
          request.seasonNumber
        )
      )
        ? Number(
            request.seasonNumber
          )
        : null,

    seasonLabel:
      normalizeText(
        request.seasonLabel
      ),

    reviewedAt:
      normalizeText(
        request.reviewedAt ??
        request.reviewed_at
      ),

    updatedAt:
      normalizeText(
        request.updatedAt ??
        request.updated_at
      ),

    createdAt:
      normalizeText(
        request.createdAt ??
        request.submittedAt ??
        request.created_at
      )
  };
}

async function handlePublicApprovedAction():
  Promise<Response> {
  const storedRequests =
    await loadStoredRequests();

  const approvedRequests =
    storedRequests
      .filter(
        request => {
          return (
            normalizeLower(
              request.status
            ) ===
              "approved" &&
            Boolean(
              normalizeText(
                request.playerId ??
                request.player_id
              )
            )
          );
        }
      )
      .map(
        createPublicApprovedRecord
      );

  return createJsonResponse(
    200,
    {
      success:
        true,

      action:
        "public-approved",

      requests:
        approvedRequests,

      count:
        approvedRequests.length,

      version:
        FUNCTION_VERSION
    }
  );
}

/* =========================================================
   ADMIN LIST
========================================================= */

async function handleListAction(
  request:
    Request
): Promise<Response> {
  await authenticateAdministrator(
    request
  );

  const requests =
    await loadStoredRequests();

  return createJsonResponse(
    200,
    {
      success:
        true,

      action:
        "list",

      requests,

      count:
        requests.length,

      version:
        FUNCTION_VERSION
    }
  );
}

/* =========================================================
   UPDATE
========================================================= */

async function handleUpdateAction(
  request:
    Request,
  input:
    AdminAfkRequestInput
): Promise<Response> {
  const administrator =
    await authenticateAdministrator(
      request
    );

  const requestId =
    normalizeRequestId(
      input.requestId
    );

  const filePath =
    normalizeRepositoryPath(
      requestId,
      input.repositoryPath,
      input.filename
    );

  const status =
    normalizeStatus(
      input.status
    );

  const adminNote =
    normalizeAdminNote(
      input.adminNote
    );

  const reviewedAt =
    normalizeReviewedAt(
      input.reviewedAt
    );

  const existingFile =
    await readGitHubFile(
      filePath
    );

  const storedRequestId =
    normalizeText(
      existingFile.data
        .requestId ??
      existingFile.data
        .request_id ??
      existingFile.data
        .id
    );

  if (
    storedRequestId &&
    storedRequestId !==
      requestId
  ) {
    throw createRequestError(
      "The stored AFK request does not match the requested ID."
    );
  }

  const updatedRequest:
    Record<string, unknown> = {
    ...existingFile.data,

    schemaVersion:
      2,

    requestId,

    status,

    adminNote,

    reviewedAt,

    reviewedBy:
      administrator.displayName,

    reviewedByRole:
      administrator.role,

    reviewedByUserId:
      administrator.id,

    updatedAt:
      new Date()
        .toISOString(),

    functionVersion:
      FUNCTION_VERSION
  };

  const commitAction =
    status === "approved"
      ? "Approve"
      : status === "rejected"
        ? "Reject"
        : "Reopen";

  const newSha =
    await updateGitHubFile(
      filePath,
      existingFile.sha,
      updatedRequest,
      `${commitAction} AFK request ${requestId}`
    );

  return createJsonResponse(
    200,
    {
      success:
        true,

      action:
        "update",

      requestId,

      status,

      adminNote,

      reviewedAt,

      reviewedBy:
        administrator.displayName,

      repositoryPath:
        filePath,

      filename:
        `${requestId}.json`,

      sha:
        newSha,

      message:
        `AFK request updated to ${status}.`,

      version:
        FUNCTION_VERSION
    }
  );
}

/* =========================================================
   DELETE
========================================================= */

async function handleDeleteAction(
  request:
    Request,
  input:
    AdminAfkRequestInput
): Promise<Response> {
  const administrator =
    await authenticateAdministrator(
      request
    );

  const requestId =
    normalizeRequestId(
      input.requestId
    );

  const filePath =
    normalizeRepositoryPath(
      requestId,
      input.repositoryPath,
      input.filename
    );

  const existingFile =
    await readGitHubFile(
      filePath
    );

  const storedRequestId =
    normalizeText(
      existingFile.data
        .requestId ??
      existingFile.data
        .request_id ??
      existingFile.data
        .id
    );

  if (
    storedRequestId &&
    storedRequestId !==
      requestId
  ) {
    throw createRequestError(
      "The stored AFK request does not match the requested ID."
    );
  }

  await deleteGitHubFile(
    filePath,
    existingFile.sha,
    `Delete AFK request ${requestId} by ${administrator.displayName}`
  );

  return createJsonResponse(
    200,
    {
      success:
        true,

      action:
        "delete",

      requestId,

      repositoryPath:
        filePath,

      deletedBy:
        administrator.displayName,

      message:
        "AFK request deleted.",

      version:
        FUNCTION_VERSION
    }
  );
}

/* =========================================================
   REQUEST HANDLER
========================================================= */

Deno.serve(
  async (
    request:
      Request
  ): Promise<Response> => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status:
            204,

          headers:
            CORS_HEADERS
        }
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return createJsonResponse(
        405,
        {
          success:
            false,

          error:
            "Method not allowed.",

          version:
            FUNCTION_VERSION
        }
      );
    }

    const contentType =
      normalizeLower(
        request.headers.get(
          "content-type"
        )
      );

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      return createJsonResponse(
        415,
        {
          success:
            false,

          error:
            "The request must contain JSON data.",

          version:
            FUNCTION_VERSION
        }
      );
    }

    try {
      const parsedInput =
        await request.json();

      if (
        !isRecord(
          parsedInput
        )
      ) {
        throw createRequestError(
          "Invalid request data."
        );
      }

      const action =
        normalizeAction(
          parsedInput.action
        );

      switch (action) {
        case "public-approved":
          return await handlePublicApprovedAction();

        case "list":
          return await handleListAction(
            request
          );

        case "update":
          return await handleUpdateAction(
            request,
            parsedInput as
              AdminAfkRequestInput
          );

        case "delete":
          return await handleDeleteAction(
            request,
            parsedInput as
              AdminAfkRequestInput
          );

        case "create":
        default:
          return await handleCreateAction(
            parsedInput as
              PublicAfkRequestInput
          );
      }
    } catch (error) {
      console.error(
        "[K630 AFK Request]",
        error
      );

      return createJsonResponse(
        getErrorStatus(
          error
        ),
        {
          success:
            false,

          error:
            getPublicErrorMessage(
              error
            ),

          version:
            FUNCTION_VERSION
        }
      );
    }
  }
);