/* =========================================================
   K630 DRAGON COMMAND CENTER
   SUPABASE EDGE FUNCTION: ADMIN USERS

   File:
   supabase/functions/admin-users/index.ts

   Version:
   630.1.1

   Actions:
   - list
   - create
   - delete

   Security:
   - Caller must be signed in
   - Caller must have active Owner profile
   - Service Role key remains server-side
   - Owner account cannot be deleted
   - Caller cannot delete own account
========================================================= */

import {
  createClient
} from "npm:@supabase/supabase-js@2";

const FUNCTION_NAME =
  "K630 Admin Users";

const FUNCTION_VERSION =
  "630.1.1";

const PROFILE_TABLE =
  "profiles";

const ALLOWED_CREATED_ROLES =
  Object.freeze([
    "admin",
    "officer"
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

type AdminUserAction =
  | "list"
  | "create"
  | "delete";

interface AdminUserInput {
  action?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  userId?: unknown;
}

interface CallerProfile {
  id: string;
  email: string;
  role: string;
  active: boolean;
}

interface PublicAdminUser {
  id: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastSignInAt: string | null;
  isOwner: boolean;
}

/* =====================================================
   HELPERS
===================================================== */

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

function normalizeEmail(
  value: unknown
): string {
  return normalizeLower(
    value
  );
}

function normalizeRole(
  value: unknown
): string {
  return normalizeLower(
    value
  );
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

function getRequiredSecret(
  name: string
): string {
  const value =
    normalizeText(
      Deno.env.get(name)
    );

  if (!value) {
    throw new Error(
      `Missing required secret: ${name}`
    );
  }

  return value;
}

function createResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(
    JSON.stringify(
      body
    ),
    {
      status,

      headers:
        CORS_HEADERS
    }
  );
}

function createSuccessResponse(
  body: Record<string, unknown> = {}
): Response {
  return createResponse(
    {
      success:
        true,

      function:
        FUNCTION_NAME,

      version:
        FUNCTION_VERSION,

      ...body
    }
  );
}

function createErrorResponse(
  error: unknown
): Response {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown server error.";

  const status =
    isRecord(error) &&
    typeof error.status ===
      "number"
      ? error.status
      : 500;

  console.error(
    `[${FUNCTION_NAME}]`,
    error
  );

  return createResponse(
    {
      success:
        false,

      function:
        FUNCTION_NAME,

      version:
        FUNCTION_VERSION,

      error:
        message
    },
    status
  );
}

function createHttpError(
  message: string,
  status: number
): Error & {
  status: number;
} {
  const error =
    new Error(
      message
    ) as Error & {
      status: number;
    };

  error.status =
    status;

  return error;
}

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
    throw createHttpError(
      "You must be signed in.",
      401
    );
  }

  return normalizeText(
    match[1]
  );
}

function validateEmail(
  value: unknown
): string {
  const email =
    normalizeEmail(
      value
    );

  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email);

  if (!valid) {
    throw createHttpError(
      "Enter a valid email address.",
      400
    );
  }

  return email;
}

function validatePassword(
  value: unknown
): string {
  const password =
    String(
      value ?? ""
    );

  if (
    password.length <
    10
  ) {
    throw createHttpError(
      "The temporary password must contain at least 10 characters.",
      400
    );
  }

  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    throw createHttpError(
      "The temporary password must contain uppercase, lowercase and a number.",
      400
    );
  }

  return password;
}

function validateCreatedRole(
  value: unknown
): string {
  const role =
    normalizeRole(
      value
    );

  if (
    !ALLOWED_CREATED_ROLES
      .includes(role)
  ) {
    throw createHttpError(
      "Only Admin or Officer accounts can be created.",
      400
    );
  }

  return role;
}

function normalizeAction(
  value: unknown
): AdminUserAction {
  const action =
    normalizeLower(
      value
    );

  if (
    action !== "list" &&
    action !== "create" &&
    action !== "delete"
  ) {
    throw createHttpError(
      "Unsupported admin user action.",
      400
    );
  }

  return action;
}

/* =====================================================
   SUPABASE CLIENTS
===================================================== */

function createUserClient(
  accessToken: string
) {
  const supabaseUrl =
    getRequiredSecret(
      "SUPABASE_URL"
    );

  const anonKey =
    getRequiredSecret(
      "SUPABASE_ANON_KEY"
    );

  return createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      },

      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false
      }
    }
  );
}

function createAdminClient() {
  const supabaseUrl =
    getRequiredSecret(
      "SUPABASE_URL"
    );

  const serviceRoleKey =
    getRequiredSecret(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false
      }
    }
  );
}

/* =====================================================
   OWNER AUTHORIZATION
===================================================== */

async function authenticateOwner(
  request: Request
): Promise<CallerProfile> {
  const accessToken =
    getBearerToken(
      request
    );

  const userClient =
    createUserClient(
      accessToken
    );

  const {
    data: claimsData,
    error: claimsError
  } =
    await userClient
      .auth
      .getClaims(
        accessToken
      );

  const userId =
    normalizeText(
      claimsData?.claims?.sub
    );

  const userEmail =
    normalizeEmail(
      claimsData?.claims?.email
    );

  if (
    claimsError ||
    !userId
  ) {
    throw createHttpError(
      claimsError?.message ||
      "Your login session is invalid or expired.",
      401
    );
  }

  const adminClient =
    createAdminClient();

  const {
    data: profile,
    error: profileError
  } =
    await adminClient
      .from(
        PROFILE_TABLE
      )
      .select(
        "id,email,role,active"
      )
      .eq(
        "id",
        userId
      )
      .maybeSingle();

  if (profileError) {
    throw createHttpError(
      `Profile lookup failed: ${profileError.message}`,
      500
    );
  }

  if (!profile) {
    throw createHttpError(
      `No Command Center profile was found for UID ${userId}.`,
      403
    );
  }

  if (
    profile.active !==
    true
  ) {
    throw createHttpError(
      "Your Command Center account is inactive.",
      403
    );
  }

  if (
    normalizeRole(
      profile.role
    ) !== "owner"
  ) {
    throw createHttpError(
      "Only the Owner may manage Command Center users.",
      403
    );
  }

  return {
    id:
      normalizeText(
        profile.id
      ),

    email:
      normalizeEmail(
        profile.email ||
        userEmail
      ),

    role:
      "owner",

    active:
      true
  };
}

/* =====================================================
   LIST USERS
===================================================== */

async function listUsers():
  Promise<PublicAdminUser[]> {
  const adminClient =
    createAdminClient();

  const [
    authResult,
    profileResult
  ] =
    await Promise.all([
      adminClient
        .auth
        .admin
        .listUsers({
          page:
            1,

          perPage:
            1000
        }),

      adminClient
        .from(
          PROFILE_TABLE
        )
        .select(
          [
            "id",
            "email",
            "role",
            "active",
            "created_at",
            "updated_at"
          ].join(",")
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        )
    ]);

  if (authResult.error) {
    throw createHttpError(
      authResult.error.message ||
      "Supabase users could not be loaded.",
      500
    );
  }

  if (profileResult.error) {
    throw createHttpError(
      profileResult.error.message ||
      "Command Center profiles could not be loaded.",
      500
    );
  }

  const authUsers =
    authResult.data.users ||
    [];

  const profiles =
    Array.isArray(
      profileResult.data
    )
      ? profileResult.data
      : [];

  const authById =
    new Map(
      authUsers.map(
        user => [
          user.id,
          user
        ]
      )
    );

  return profiles
    .map(profile => {
      const authUser =
        authById.get(
          normalizeText(
            profile.id
          )
        );

      const role =
        normalizeRole(
          profile.role
        );

      return {
        id:
          normalizeText(
            profile.id
          ),

        email:
          normalizeEmail(
            profile.email ||
            authUser?.email
          ),

        role,

        active:
          profile.active ===
          true,

        createdAt:
          normalizeText(
            profile.created_at
          ) || null,

        updatedAt:
          normalizeText(
            profile.updated_at
          ) || null,

        lastSignInAt:
          normalizeText(
            authUser
              ?.last_sign_in_at
          ) || null,

        isOwner:
          role === "owner"
      };
    })
    .filter(
      user =>
        Boolean(
          user.id &&
          user.email
        )
    );
}

/* =====================================================
   CREATE USER
===================================================== */

async function createUser(
  input: AdminUserInput
): Promise<PublicAdminUser> {
  const email =
    validateEmail(
      input.email
    );

  const password =
    validatePassword(
      input.password
    );

  const role =
    validateCreatedRole(
      input.role
    );

  const adminClient =
    createAdminClient();

  const {
    data: existingProfiles,
    error: existingProfileError
  } =
    await adminClient
      .from(
        PROFILE_TABLE
      )
      .select(
        "id,email"
      )
      .eq(
        "email",
        email
      )
      .limit(1);

  if (existingProfileError) {
    throw createHttpError(
      "Existing profiles could not be checked.",
      500
    );
  }

  if (
    Array.isArray(
      existingProfiles
    ) &&
    existingProfiles.length
  ) {
    throw createHttpError(
      "A Command Center account with this email already exists.",
      409
    );
  }

  const {
    data: createData,
    error: createError
  } =
    await adminClient
      .auth
      .admin
      .createUser({
        email,

        password,

        email_confirm:
          true,

        app_metadata: {
          role
        },

        user_metadata: {
          command_center_role:
            role,

          must_change_password:
            true
        }
      });

  if (
    createError ||
    !createData?.user?.id
  ) {
    throw createHttpError(
      createError?.message ||
      "The Supabase user could not be created.",
      400
    );
  }

  const userId =
    createData.user.id;

  const now =
    new Date()
      .toISOString();

  const {
    data: createdProfile,
    error: profileError
  } =
    await adminClient
      .from(
        PROFILE_TABLE
      )
      .upsert(
        {
          id:
            userId,

          email,

          role,

          active:
            true,

          created_at:
            now,

          updated_at:
            now
        },
        {
          onConflict:
            "id"
        }
      )
      .select(
        [
          "id",
          "email",
          "role",
          "active",
          "created_at",
          "updated_at"
        ].join(",")
      )
      .single();

  if (
    profileError ||
    !createdProfile
  ) {
    try {
      await adminClient
        .auth
        .admin
        .deleteUser(
          userId
        );
    } catch (rollbackError) {
      console.error(
        `[${FUNCTION_NAME}] User rollback failed.`,
        rollbackError
      );
    }

    throw createHttpError(
      profileError?.message ||
      "The Command Center profile could not be created.",
      500
    );
  }

  return {
    id:
      normalizeText(
        createdProfile.id
      ),

    email:
      normalizeEmail(
        createdProfile.email
      ),

    role:
      normalizeRole(
        createdProfile.role
      ),

    active:
      createdProfile.active ===
      true,

    createdAt:
      normalizeText(
        createdProfile.created_at
      ) || null,

    updatedAt:
      normalizeText(
        createdProfile.updated_at
      ) || null,

    lastSignInAt:
      null,

    isOwner:
      false
  };
}

/* =====================================================
   DELETE USER
===================================================== */

async function deleteUser(
  input: AdminUserInput,
  caller: CallerProfile
): Promise<string> {
  const userId =
    normalizeText(
      input.userId
    );

  if (!userId) {
    throw createHttpError(
      "A user ID is required.",
      400
    );
  }

  if (
    userId ===
    caller.id
  ) {
    throw createHttpError(
      "You cannot delete your own Owner account.",
      400
    );
  }

  const adminClient =
    createAdminClient();

  const {
    data: profile,
    error: profileError
  } =
    await adminClient
      .from(
        PROFILE_TABLE
      )
      .select(
        "id,email,role"
      )
      .eq(
        "id",
        userId
      )
      .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    throw createHttpError(
      "The selected account could not be found.",
      404
    );
  }

  if (
    normalizeRole(
      profile.role
    ) === "owner"
  ) {
    throw createHttpError(
      "The Owner account cannot be deleted.",
      403
    );
  }

  const {
    error: deleteAuthError
  } =
    await adminClient
      .auth
      .admin
      .deleteUser(
        userId
      );

  if (deleteAuthError) {
    throw createHttpError(
      deleteAuthError.message ||
      "The Supabase user could not be deleted.",
      500
    );
  }

  const {
    error: deleteProfileError
  } =
    await adminClient
      .from(
        PROFILE_TABLE
      )
      .delete()
      .eq(
        "id",
        userId
      );

  if (deleteProfileError) {
    console.warn(
      `[${FUNCTION_NAME}] Auth user deleted, but profile cleanup failed.`,
      deleteProfileError
    );
  }

  return normalizeEmail(
    profile.email
  );
}

/* =====================================================
   REQUEST HANDLER
===================================================== */

Deno.serve(
  async (
    request: Request
  ): Promise<Response> => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            CORS_HEADERS
        }
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return createResponse(
        {
          success:
            false,

          error:
            "Method not allowed."
        },
        405
      );
    }

    try {
      const caller =
        await authenticateOwner(
          request
        );

      const rawInput =
        await request.json();

      const input =
        isRecord(rawInput)
          ? rawInput as
              AdminUserInput
          : {};

      const action =
        normalizeAction(
          input.action
        );

      if (
        action === "list"
      ) {
        const users =
          await listUsers();

        return createSuccessResponse({
          users,

          caller: {
            id:
              caller.id,

            email:
              caller.email,

            role:
              caller.role
          }
        });
      }

      if (
        action === "create"
      ) {
        const user =
          await createUser(
            input
          );

        return createSuccessResponse({
          user,

          message:
            "Command Center user created successfully."
        });
      }

      const deletedEmail =
        await deleteUser(
          input,
          caller
        );

      return createSuccessResponse({
        deletedEmail,

        message:
          "Command Center user deleted successfully."
      });
    } catch (error) {
      return createErrorResponse(
        error
      );
    }
  }
);