#!/usr/bin/env bash
set -euo pipefail
# Registers a camera SFTP user. Maps their home to camera-inbox/{userId}/{groupId}/.
# Usage:
#   sftp-add-user.sh <username> <userId> <groupId-or-__mine__> <path-to-ssh-pubkey>

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
if [ -f "$ENV_FILE" ]; then set -a; source "$ENV_FILE"; set +a; fi

: "${AWS_REGION:?}"; : "${AWS_ACCOUNT_ID:?}"; : "${S3_BUCKET:?}"
: "${SFTP_SERVER_ID:?"SFTP_SERVER_ID env required (see sftp-setup.sh output)"}"
: "${SFTP_ROLE_ARN:?"SFTP_ROLE_ARN env required (see sftp-setup.sh output)"}"

USERNAME="${1:?username}"
USER_ID="${2:?userId (cognito sub)}"
GROUP_ID="${3:?groupId or __mine__}"
PUBKEY_FILE="${4:?path to .pub file}"

HOME_DIR_ENTRY="/camera-inbox/${USER_ID}/${GROUP_ID}"
PUBKEY_CONTENT="$(cat "$PUBKEY_FILE")"

TMP="$(mktemp -d)"
cat >"$TMP/mapping.json" <<EOF
[
  { "Entry": "/", "Target": "/${S3_BUCKET}${HOME_DIR_ENTRY}" }
]
EOF

EXISTS="$(aws transfer describe-user --server-id "$SFTP_SERVER_ID" --user-name "$USERNAME" \
  --region "$AWS_REGION" --query 'User.UserName' --output text 2>/dev/null || echo None)"

if [ -z "$EXISTS" ] || [ "$EXISTS" = "None" ]; then
  aws transfer create-user \
    --server-id "$SFTP_SERVER_ID" \
    --user-name "$USERNAME" \
    --role "$SFTP_ROLE_ARN" \
    --home-directory-type LOGICAL \
    --home-directory-mappings "file://$TMP/mapping.json" \
    --region "$AWS_REGION" >/dev/null
  echo "[create] user $USERNAME"
else
  aws transfer update-user \
    --server-id "$SFTP_SERVER_ID" \
    --user-name "$USERNAME" \
    --role "$SFTP_ROLE_ARN" \
    --home-directory-type LOGICAL \
    --home-directory-mappings "file://$TMP/mapping.json" \
    --region "$AWS_REGION" >/dev/null
  echo "[update] user $USERNAME"
fi

aws transfer import-ssh-public-key \
  --server-id "$SFTP_SERVER_ID" \
  --user-name "$USERNAME" \
  --ssh-public-key-body "$PUBKEY_CONTENT" \
  --region "$AWS_REGION" >/dev/null

echo "[ok] key imported"
echo ""
echo "Camera FTP settings:"
echo "  host: ${SFTP_SERVER_ID}.server.transfer.${AWS_REGION}.amazonaws.com"
echo "  user: ${USERNAME}"
echo "  auth: SSH key ($PUBKEY_FILE private half)"
echo "  uploads land at: s3://${S3_BUCKET}${HOME_DIR_ENTRY}/"
