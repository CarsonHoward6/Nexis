#!/usr/bin/env bash
set -euo pipefail

# Creates (or updates) the HTTP API Gateway, Cognito JWT authorizer, routes,
# Lambda integrations, stage, and SQS trigger.
# Idempotent — safe to rerun.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
if [ -f "$ENV_FILE" ]; then set -a; source "$ENV_FILE"; set +a; fi

: "${AWS_REGION:?}"; : "${AWS_ACCOUNT_ID:?}"
: "${NEXT_PUBLIC_USER_POOL_ID:?}"; : "${NEXT_PUBLIC_USER_POOL_CLIENT_ID:?}"
: "${SQS_QUEUE_ARN:?}"

API_NAME="snaprelay-api"
STAGE="prod"

# ---- find or create API
API_ID="$(aws apigatewayv2 get-apis --region "$AWS_REGION" \
  --query "Items[?Name=='$API_NAME'].ApiId | [0]" --output text)"
if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  echo "[create] HTTP API $API_NAME"
  API_ID="$(aws apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --cors-configuration AllowOrigins='*',AllowMethods='GET,POST,DELETE,OPTIONS',AllowHeaders='content-type,authorization' \
    --region "$AWS_REGION" --query ApiId --output text)"
else
  echo "[exists] API $API_ID"
  aws apigatewayv2 update-api --api-id "$API_ID" \
    --cors-configuration AllowOrigins='*',AllowMethods='GET,POST,DELETE,OPTIONS',AllowHeaders='content-type,authorization' \
    --region "$AWS_REGION" >/dev/null
fi

API_ENDPOINT="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com"

# ---- JWT authorizer
ISSUER="https://cognito-idp.${AWS_REGION}.amazonaws.com/${NEXT_PUBLIC_USER_POOL_ID}"
AUTH_ID="$(aws apigatewayv2 get-authorizers --api-id "$API_ID" --region "$AWS_REGION" \
  --query "Items[?Name=='cognito'].AuthorizerId | [0]" --output text)"
if [ -z "$AUTH_ID" ] || [ "$AUTH_ID" = "None" ]; then
  echo "[create] Cognito authorizer"
  AUTH_ID="$(aws apigatewayv2 create-authorizer \
    --api-id "$API_ID" \
    --authorizer-type JWT \
    --identity-source '$request.header.Authorization' \
    --jwt-configuration Issuer="$ISSUER",Audience="$NEXT_PUBLIC_USER_POOL_CLIENT_ID" \
    --name cognito \
    --region "$AWS_REGION" --query AuthorizerId --output text)"
else
  echo "[exists] authorizer $AUTH_ID"
fi

# ---- helper: ensure integration + route
ensure_route() {
  local method="$1"; local path="$2"; local fn_name="$3"; local auth="${4:-jwt}"

  local fn_arn="arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:snaprelay-${fn_name}"
  local route_key="${method} ${path}"

  # integration
  local integ_id
  integ_id="$(aws apigatewayv2 get-integrations --api-id "$API_ID" --region "$AWS_REGION" \
    --query "Items[?IntegrationUri=='$fn_arn'].IntegrationId | [0]" --output text)"
  if [ -z "$integ_id" ] || [ "$integ_id" = "None" ]; then
    integ_id="$(aws apigatewayv2 create-integration \
      --api-id "$API_ID" \
      --integration-type AWS_PROXY \
      --integration-uri "$fn_arn" \
      --payload-format-version 2.0 \
      --region "$AWS_REGION" --query IntegrationId --output text)"
  fi

  # route
  local route_id
  route_id="$(aws apigatewayv2 get-routes --api-id "$API_ID" --region "$AWS_REGION" \
    --query "Items[?RouteKey=='$route_key'].RouteId | [0]" --output text)"

  local auth_args=()
  if [ "$auth" = "jwt" ]; then
    auth_args+=(--authorization-type JWT --authorizer-id "$AUTH_ID")
  else
    auth_args+=(--authorization-type NONE)
  fi

  if [ -z "$route_id" ] || [ "$route_id" = "None" ]; then
    aws apigatewayv2 create-route \
      --api-id "$API_ID" \
      --route-key "$route_key" \
      --target "integrations/$integ_id" \
      "${auth_args[@]}" \
      --region "$AWS_REGION" >/dev/null
  else
    aws apigatewayv2 update-route \
      --api-id "$API_ID" \
      --route-id "$route_id" \
      --target "integrations/$integ_id" \
      "${auth_args[@]}" \
      --region "$AWS_REGION" >/dev/null
  fi

  # lambda permission
  local stmt_id="apigw-${fn_name}"
  aws lambda remove-permission --function-name "snaprelay-${fn_name}" --statement-id "$stmt_id" \
    --region "$AWS_REGION" >/dev/null 2>&1 || true
  aws lambda add-permission \
    --function-name "snaprelay-${fn_name}" \
    --statement-id "$stmt_id" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${AWS_REGION}:${AWS_ACCOUNT_ID}:${API_ID}/*/*" \
    --region "$AWS_REGION" >/dev/null

  echo "  route: $route_key → $fn_name [$auth]"
}

echo "[routes]"
ensure_route POST   /upload/presign              presign        jwt
ensure_route POST   /files                       savePhoto      jwt
ensure_route GET    /files                       listFiles      jwt
ensure_route DELETE /files/{id}                  deleteFile     jwt
ensure_route POST   /files/{id}/share            shareLink      jwt
ensure_route POST   /groups                      createGroup    jwt
ensure_route GET    /groups                      listGroups     jwt
ensure_route POST   /groups/{groupId}/invites    createInvite   jwt
ensure_route POST   /invites/{code}/accept       acceptInvite   jwt
ensure_route GET    /shares/{shareId}            getShare       none

# ---- auto-deploy stage
STAGE_EXISTS="$(aws apigatewayv2 get-stages --api-id "$API_ID" --region "$AWS_REGION" \
  --query "Items[?StageName=='$STAGE'].StageName | [0]" --output text)"
if [ -z "$STAGE_EXISTS" ] || [ "$STAGE_EXISTS" = "None" ]; then
  aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name "$STAGE" --auto-deploy \
    --region "$AWS_REGION" >/dev/null
fi

# ---- SQS trigger for processUpload
PROC_ARN="arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:snaprelay-processUpload"
MAPPING="$(aws lambda list-event-source-mappings \
  --function-name snaprelay-processUpload \
  --region "$AWS_REGION" \
  --query "EventSourceMappings[?EventSourceArn=='$SQS_QUEUE_ARN'].UUID | [0]" \
  --output text 2>/dev/null || echo None)"
if [ -z "$MAPPING" ] || [ "$MAPPING" = "None" ]; then
  echo "[create] SQS trigger"
  aws lambda create-event-source-mapping \
    --function-name snaprelay-processUpload \
    --event-source-arn "$SQS_QUEUE_ARN" \
    --batch-size 5 \
    --region "$AWS_REGION" >/dev/null
else
  echo "[exists] SQS trigger $MAPPING"
fi

echo ""
echo "API URL: ${API_ENDPOINT}/${STAGE}"
echo ""
echo "Put this in .env and Vercel:"
echo "  NEXT_PUBLIC_API_URL=${API_ENDPOINT}/${STAGE}"
