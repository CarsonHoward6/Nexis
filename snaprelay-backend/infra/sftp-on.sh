#!/usr/bin/env bash
set -euo pipefail
# Starts the SFTP server (begins billing at ~$0.30/hr).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$(cd "$ROOT/.." && pwd)/.env"
if [ -f "$ENV_FILE" ]; then set -a; source "$ENV_FILE"; set +a; fi
: "${SFTP_SERVER_ID:?"set SFTP_SERVER_ID in .env"}"
: "${AWS_REGION:=us-east-1}"
aws transfer start-server --server-id "$SFTP_SERVER_ID" --region "$AWS_REGION"
echo "Waiting for ONLINE..."
for i in $(seq 1 30); do
  s="$(aws transfer describe-server --server-id "$SFTP_SERVER_ID" --region "$AWS_REGION" --query 'Server.State' --output text)"
  echo "  state=$s"
  [ "$s" = "ONLINE" ] && break
  sleep 20
done
