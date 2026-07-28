/* =========================================================
   K630-REF GITHUB WRITE EDGE FUNCTION
   File: supabase/functions/github-write/index.ts
   Version: 630.3.0

   Required Supabase secret:
   GITHUB_TOKEN

   Allowed roles:
   - owner
   - admin
========================================================= */

import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get(
    "SUPABASE_URL"
  ) ?? "";

const SUPABASE_ANON_KEY =
  Deno.env.get(
    "SUPABASE_ANON_KEY"
  ) ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  ) ?? "";

const GITHUB_TOKEN =
  Deno.env.get(
    "GITHUB_TOKEN"
  ) ?? "";

const ALLOWED_ORIGINS = [
  "https://ragnarok630.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:5501",
  "http://localhost:5501"
];

const ALLOWED_REPOSITORIES =
  new Set([
    "Ragnarok630/ref-command-center",
    "Ragnarok630/k630-public-data"
  ]);

const WRITE_ROLES =
  new Set([
    "owner",
    "admin"
  ]);

type RepositoryInput = {
  owner?: string;
  repository?: string;
  repo?: string;
  branch?: string;
};

type RequestBody = {
  action?: string;
  repository?: RepositoryInput;
  path?: string;
  data?: unknown;
  message?: string;
};

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
  return normalizeText(value)
    .toLowerCase();
}

function normalizePath(
  value: unknown
): string {
  return normalizeText(value)
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function getCorsHeaders(
  request: Request
): Record<string, string> {
  const origin =
    request.headers.get(
      "origin"
    ) ?? "";

  const allowedOrigin =
    ALLOWED_ORIGINS.includes(
      origin
    )
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin":
      allowedOrigin,

    "Access-Control-Allow-Headers":
      (
        "authorization, " +
        "x-client-info, " +
        "apikey, " +
        "content-type"
      ),

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

    "Vary":
      "Origin"
  };
}

function jsonResponse(
  request: Request,
  status: number,
  body: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...getCorsHeaders(
          request
        ),

        "Content-Type":
          "application/json; charset=utf-8"
      }
    }
  );
}

function validateEnvironment(): void {
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase Edge Function environment is incomplete."
    );
  }

  if (!GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN is not configured."
    );
  }
}

function getBearerToken(
  request: Request
): string {
  const authorization =
    request.headers.get(
      "authorization"
    ) ?? "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return normalizeText(
    match?.[1]
  );
}

async function authenticateUser(
  request: Request
) {
  const accessToken =
    getBearerToken(
      request
    );

  if (!accessToken) {
    throw new Error(
      "Authentication token is missing."
    );
  }

  const authClient =
    createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
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

  const {
    data: userData,
    error: userError
  } =
    await authClient
      .auth
      .getUser(
        accessToken
      );

  if (
    userError ||
    !userData?.user?.id
  ) {
    throw new Error(
      "The authenticated session is invalid or expired."
    );
  }

  const adminClient =
    createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false
        }
      }
    );

  const {
    data: profile,
    error: profileError
  } =
    await adminClient
      .from("profiles")
      .select(
        "id,email,role,active"
      )
      .eq(
        "id",
        userData.user.id
      )
      .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    throw new Error(
      "The Command Center profile could not be loaded."
    );
  }

  const role =
    normalizeLower(
      profile.role
    );

  if (
    profile.active !==
      true ||
    !WRITE_ROLES.has(role)
  ) {
    throw new Error(
      "Only an active Owner or Admin may write official data."
    );
  }

  return {
    id:
      normalizeText(
        profile.id
      ),

    email:
      normalizeText(
        profile.email ||
        userData.user.email
      ),

    role
  };
}

function normalizeRepository(
  input: RepositoryInput | undefined
) {
  const owner =
    normalizeText(
      input?.owner
    );

  const repository =
    normalizeText(
      input?.repository ||
      input?.repo
    );

  const branch =
    normalizeText(
      input?.branch
    ) || "main";

  if (
    !owner ||
    !repository
  ) {
    throw new Error(
      "Repository owner and repository name are required."
    );
  }

  const repositoryKey =
    `${owner}/${repository}`;

  if (
    !ALLOWED_REPOSITORIES.has(
      repositoryKey
    )
  ) {
    throw new Error(
      "This repository is not allowed."
    );
  }

  if (
    !/^[A-Za-z0-9._/-]+$/.test(
      branch
    )
  ) {
    throw new Error(
      "The branch name is invalid."
    );
  }

  return {
    owner,
    repository,
    branch
  };
}

function validateFilePath(
  value: unknown
): string {
  const path =
    normalizePath(value);

  if (!path) {
    throw new Error(
      "A file path is required."
    );
  }

  if (
    path.includes("..") ||
    path.startsWith(".git/") ||
    path.includes("/.git/")
  ) {
    throw new Error(
      "The file path is not allowed."
    );
  }

  if (
    !path.startsWith(
      "assets/data/"
    )
  ) {
    throw new Error(
      "Only files inside assets/data may be managed."
    );
  }

  return path;
}

function encodeBase64Utf8(
  value: string
): string {
  const bytes =
    new TextEncoder()
      .encode(value);

  let binary =
    "";

  for (
    let index = 0;
    index < bytes.length;
    index += 1
  ) {
    binary +=
      String.fromCharCode(
        bytes[index]
      );
  }

  return btoa(binary);
}

function decodeBase64Utf8(
  value: string
): string {
  const cleanValue =
    value.replace(
      /\s+/g,
      ""
    );

  const binary =
    atob(cleanValue);

  const bytes =
    Uint8Array.from(
      binary,
      character =>
        character.charCodeAt(0)
    );

  return new TextDecoder()
    .decode(bytes);
}

async function githubRequest(
  path: string,
  options: RequestInit = {}
) {
  const response =
    await fetch(
      `https://api.github.com${path}`,
      {
        ...options,

        headers: {
          Accept:
            "application/vnd.github+json",

          Authorization:
            `Bearer ${GITHUB_TOKEN}`,

          "X-GitHub-Api-Version":
            "2022-11-28",

          "User-Agent":
            "K630-REF-Command-Center",

          ...(
            options.headers ||
            {}
          )
        }
      }
    );

  let result:
    unknown =
      null;

  const responseText =
    await response.text();

  if (responseText) {
    try {
      result =
        JSON.parse(
          responseText
        );
    } catch {
      result =
        responseText;
    }
  }

  if (!response.ok) {
    const resultObject =
      (
        result &&
        typeof result ===
          "object"
      )
        ? result as Record<
            string,
            unknown
          >
        : null;

    throw new Error(
      normalizeText(
        resultObject?.message
      ) ||
      `GitHub returned HTTP ${response.status}.`
    );
  }

  return result;
}

async function getFile(
  repository: ReturnType<
    typeof normalizeRepository
  >,
  path: string
) {
  const encodedPath =
    path
      .split("/")
      .map(segment =>
        encodeURIComponent(
          segment
        )
      )
      .join("/");

  try {
    const result =
      await githubRequest(
        (
          `/repos/${encodeURIComponent(repository.owner)}` +
          `/${encodeURIComponent(repository.repository)}` +
          `/contents/${encodedPath}` +
          `?ref=${encodeURIComponent(repository.branch)}`
        )
      );

    return result as Record<
      string,
      unknown
    >;
  } catch (error) {
    if (
      normalizeText(
        error instanceof Error
          ? error.message
          : error
      ).includes("Not Found")
    ) {
      return null;
    }

    throw error;
  }
}

async function checkWriteAccess(
  repository: ReturnType<
    typeof normalizeRepository
  >
) {
  const result =
    await githubRequest(
      (
        `/repos/${encodeURIComponent(repository.owner)}` +
        `/${encodeURIComponent(repository.repository)}`
      )
    ) as Record<
      string,
      unknown
    >;

  const permissions =
    (
      result.permissions &&
      typeof result.permissions ===
        "object"
    )
      ? result.permissions as Record<
          string,
          unknown
        >
      : {};

  const canPush =
    permissions.push ===
      true ||
    permissions.admin ===
      true ||
    permissions.maintain ===
      true;

  if (!canPush) {
    throw new Error(
      "The configured GitHub token has no write permission."
    );
  }

  return {
    success:
      true,

    permission:
      "write",

    repository: {
      owner:
        repository.owner,

      repository:
        repository.repository,

      branch:
        repository.branch
    },

    message:
      "GitHub write access is available."
  };
}

async function readJson(
  repository: ReturnType<
    typeof normalizeRepository
  >,
  path: string
) {
  const file =
    await getFile(
      repository,
      path
    );

  if (!file) {
    throw new Error(
      "The requested JSON file does not exist."
    );
  }

  const encodedContent =
    normalizeText(
      file.content
    );

  if (!encodedContent) {
    throw new Error(
      "GitHub returned no file content."
    );
  }

  const decoded =
    decodeBase64Utf8(
      encodedContent
    );

  let data:
    unknown;

  try {
    data =
      JSON.parse(decoded);
  } catch {
    throw new Error(
      "The stored file is not valid JSON."
    );
  }

  return {
    success:
      true,

    path,

    sha:
      normalizeText(
        file.sha
      ),

    data
  };
}

async function writeJson(
  repository: ReturnType<
    typeof normalizeRepository
  >,
  path: string,
  data: unknown,
  message: string,
  user: {
    email: string;
    role: string;
  }
) {
  const existingFile =
    await getFile(
      repository,
      path
    );

  const json =
    JSON.stringify(
      data,
      null,
      2
    ) + "\n";

  const payload:
    Record<string, unknown> = {
      message:
        normalizeText(message) ||
        `Update ${path}`,

      content:
        encodeBase64Utf8(json),

      branch:
        repository.branch,

      committer: {
        name:
          "K630 Command Center",

        email:
          "admin@kingdom630.com"
      }
    };

  const existingSha =
    normalizeText(
      existingFile?.sha
    );

  if (existingSha) {
    payload.sha =
      existingSha;
  }

  const encodedPath =
    path
      .split("/")
      .map(segment =>
        encodeURIComponent(
          segment
        )
      )
      .join("/");

  const result =
    await githubRequest(
      (
        `/repos/${encodeURIComponent(repository.owner)}` +
        `/${encodeURIComponent(repository.repository)}` +
        `/contents/${encodedPath}`
      ),
      {
        method:
          "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    ) as Record<
      string,
      unknown
    >;

  const content =
    (
      result.content &&
      typeof result.content ===
        "object"
    )
      ? result.content as Record<
          string,
          unknown
        >
      : {};

  const commit =
    (
      result.commit &&
      typeof result.commit ===
        "object"
    )
      ? result.commit as Record<
          string,
          unknown
        >
      : {};

  return {
    success:
      true,

    path:
      normalizeText(
        content.path
      ) ||
      path,

    sha:
      normalizeText(
        content.sha
      ),

    commitSha:
      normalizeText(
        commit.sha
      ),

    created:
      !existingSha,

    updated:
      Boolean(existingSha),

    message:
      existingSha
        ? "JSON file updated successfully."
        : "JSON file created successfully.",

    changedBy: {
      email:
        user.email,

      role:
        user.role
    }
  };
}

async function deleteFile(
  repository: ReturnType<
    typeof normalizeRepository
  >,
  path: string,
  message: string
) {
  const existingFile =
    await getFile(
      repository,
      path
    );

  const sha =
    normalizeText(
      existingFile?.sha
    );

  if (!sha) {
    throw new Error(
      "The requested file does not exist."
    );
  }

  const encodedPath =
    path
      .split("/")
      .map(segment =>
        encodeURIComponent(
          segment
        )
      )
      .join("/");

  const result =
    await githubRequest(
      (
        `/repos/${encodeURIComponent(repository.owner)}` +
        `/${encodeURIComponent(repository.repository)}` +
        `/contents/${encodedPath}`
      ),
      {
        method:
          "DELETE",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            message:
              normalizeText(message) ||
              `Delete ${path}`,

            sha,

            branch:
              repository.branch
          })
      }
    ) as Record<
      string,
      unknown
    >;

  const commit =
    (
      result.commit &&
      typeof result.commit ===
        "object"
    )
      ? result.commit as Record<
          string,
          unknown
        >
      : {};

  return {
    success:
      true,

    path,

    commitSha:
      normalizeText(
        commit.sha
      ),

    message:
      "File deleted successfully."
  };
}

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
            getCorsHeaders(
              request
            )
        }
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        request,
        405,
        {
          success:
            false,

          message:
            "Only POST requests are allowed."
        }
      );
    }

    try {
      validateEnvironment();

      const user =
        await authenticateUser(
          request
        );

      const body =
        await request.json() as
          RequestBody;

      const action =
        normalizeLower(
          body.action
        );

      const repository =
        normalizeRepository(
          body.repository
        );

      let result:
        Record<string, unknown>;

      switch (action) {
        case "check-write-access":
          result =
            await checkWriteAccess(
              repository
            );
          break;

        case "read-json": {
          const path =
            validateFilePath(
              body.path
            );

          if (
            !path
              .toLowerCase()
              .endsWith(".json")
          ) {
            throw new Error(
              "Only JSON files can be read."
            );
          }

          result =
            await readJson(
              repository,
              path
            );
          break;
        }

        case "write-json": {
          const path =
            validateFilePath(
              body.path
            );

          if (
            !path
              .toLowerCase()
              .endsWith(".json")
          ) {
            throw new Error(
              "Only JSON files can be written."
            );
          }

          if (
            body.data ===
            undefined
          ) {
            throw new Error(
              "No JSON data was provided."
            );
          }

          result =
            await writeJson(
              repository,
              path,
              body.data,
              normalizeText(
                body.message
              ),
              user
            );
          break;
        }

        case "delete-file": {
          const path =
            validateFilePath(
              body.path
            );

          result =
            await deleteFile(
              repository,
              path,
              normalizeText(
                body.message
              )
            );
          break;
        }

        default:
          throw new Error(
            "Unknown GitHub writer action."
          );
      }

      return jsonResponse(
        request,
        200,
        result
      );
    } catch (error) {
      console.error(
        "[K630 GitHub Writer]",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unknown server error.";

      const unauthorized =
        message.includes(
          "session"
        ) ||
        message.includes(
          "Authentication"
        );

      const forbidden =
        message.includes(
          "Owner"
        ) ||
        message.includes(
          "Admin"
        ) ||
        message.includes(
          "permission"
        );

      return jsonResponse(
        request,
        unauthorized
          ? 401
          : (
              forbidden
                ? 403
                : 400
            ),
        {
          success:
            false,

          message
        }
      );
    }
  }
);