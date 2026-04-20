#!/usr/bin/env bash
set -euo pipefail
# Stops the SFTP server (stops billing).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$(cd "$ROOT/.." && pwd)/.env"
if [ -f "$ENV_FILE" ]; then set -a; source "$ENV_FILE"; set +a; fi
: "${SFTP_SERVER_ID:?"set SFTP_SERVER_ID in .env"}"
: "${AWS_REGION:=us-east-1}"
aws transfer stop-server --server-id "$SFTP_SERVER_ID" --region "$AWS_REGION"
echo "Requested stop. Poll describe-server to see OFFLINE."
