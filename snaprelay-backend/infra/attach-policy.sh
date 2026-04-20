#!/usr/bin/env bash
set -euo pipefail
# Idempotently attaches the inline policy to the lambda exec role.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
if [ -f "$ENV_FILE" ]; then set -a; source "$ENV_FILE"; set +a; fi

ROLE_NAME="${LAMBDA_EXEC_ROLE_ARN##*/}"
: "${ROLE_NAME:?}"

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name snaprelay-inline \
  --policy-document "file://$ROOT/infra/iam-policy.json"

echo "[ok] inline policy attached to $ROLE_NAME"
