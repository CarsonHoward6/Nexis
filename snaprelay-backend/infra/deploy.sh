#!/usr/bin/env bash
set -euo pipefail

# Deploys all Lambdas. Requires env vars from ../../.env (auto-loaded).
# First-run creates functions; subsequent runs update code.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

: "${AWS_REGION:?}"; : "${AWS_ACCOUNT_ID:?}"; : "${S3_BUCKET:?}"
: "${LAMBDA_EXEC_ROLE_ARN:?}"; : "${SQS_QUEUE_ARN:?}"

cd "$ROOT"
node infra/build.mjs

RUNTIME="nodejs20.x"
HANDLER="index.handler"
ROLE="$LAMBDA_EXEC_ROLE_ARN"
ENV_JSON=$(cat <<EOF
{"Variables":{
  "AWS_NODEJS_CONNECTION_REUSE_ENABLED":"1",
  "S3_BUCKET":"$S3_BUCKET",
  "DYNAMODB_FILES_TABLE":"${DYNAMODB_FILES_TABLE:-snaprelay-files}",
  "DYNAMODB_GROUPS_TABLE":"${DYNAMODB_GROUPS_TABLE:-snaprelay-groups}",
  "DYNAMODB_MEMBERSHIPS_TABLE":"${DYNAMODB_MEMBERSHIPS_TABLE:-snaprelay-memberships}",
  "DYNAMODB_INVITES_TABLE":"${DYNAMODB_INVITES_TABLE:-snaprelay-invites}",
  "DYNAMODB_SHARES_TABLE":"${DYNAMODB_SHARES_TABLE:-snaprelay-shares}",
  "APP_URL":"${APP_URL:-}"
}}
EOF
)

deploy_fn() {
  local name="$1"
  local fn_name="snaprelay-${name}"
  local zip="dist/${name}.zip"

  (cd "dist/${name}" && zip -q -r "../${name}.zip" .)

  if aws lambda get-function --function-name "$fn_name" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "[update] $fn_name"
    aws lambda update-function-code \
      --function-name "$fn_name" \
      --zip-file "fileb://$zip" \
      --region "$AWS_REGION" >/dev/null
    aws lambda wait function-updated --function-name "$fn_name" --region "$AWS_REGION"
    aws lambda update-function-configuration \
      --function-name "$fn_name" \
      --environment "$ENV_JSON" \
      --timeout 15 --memory-size 512 \
      --region "$AWS_REGION" >/dev/null
  else
    echo "[create] $fn_name"
    aws lambda create-function \
      --function-name "$fn_name" \
      --runtime "$RUNTIME" \
      --role "$ROLE" \
      --handler "$HANDLER" \
      --zip-file "fileb://$zip" \
      --environment "$ENV_JSON" \
      --timeout 15 --memory-size 512 \
      --region "$AWS_REGION" >/dev/null
  fi
}

for d in dist/*/; do
  name="$(basename "$d")"
  deploy_fn "$name"
done

echo "\nAll lambdas deployed."
