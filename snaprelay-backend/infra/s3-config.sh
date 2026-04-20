#!/usr/bin/env bash
set -euo pipefail
# Configures CORS on the S3 bucket and wires ObjectCreated events to SQS.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
if [ -f "$ENV_FILE" ]; then set -a; source "$ENV_FILE"; set +a; fi

: "${S3_BUCKET:?}"; : "${SQS_QUEUE_ARN:?}"; : "${AWS_REGION:?}"; : "${AWS_ACCOUNT_ID:?}"

TMP="$(mktemp -d)"
CORS="$TMP/cors.json"
NOTIF="$TMP/notif.json"
POLICY="$TMP/sqs-policy.json"

cat >"$CORS" <<EOF
{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}
EOF

aws s3api put-bucket-cors --bucket "$S3_BUCKET" --cors-configuration "file://$CORS"
echo "[ok] CORS set on $S3_BUCKET"

# allow S3 to publish to the SQS queue
cat >"$POLICY" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "s3-to-sqs",
    "Effect": "Allow",
    "Principal": { "Service": "s3.amazonaws.com" },
    "Action": "sqs:SendMessage",
    "Resource": "$SQS_QUEUE_ARN",
    "Condition": {
      "ArnLike": { "aws:SourceArn": "arn:aws:s3:::$S3_BUCKET" },
      "StringEquals": { "aws:SourceAccount": "$AWS_ACCOUNT_ID" }
    }
  }]
}
EOF

QUEUE_URL="${SQS_QUEUE_URL:-https://sqs.${AWS_REGION}.amazonaws.com/${AWS_ACCOUNT_ID}/snaprelay-processing}"
ATTRS="$TMP/sqs-attrs.json"
python3 -c "import json,sys; p=open('$POLICY').read(); print(json.dumps({'Policy': p}))" > "$ATTRS"
aws sqs set-queue-attributes --queue-url "$QUEUE_URL" --attributes "file://$ATTRS"
echo "[ok] SQS policy set"

cat >"$NOTIF" <<EOF
{
  "QueueConfigurations": [
    {
      "Id": "s3-uploads",
      "QueueArn": "$SQS_QUEUE_ARN",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": { "Key": { "FilterRules": [{ "Name": "prefix", "Value": "uploads/" }] } }
    },
    {
      "Id": "s3-camera",
      "QueueArn": "$SQS_QUEUE_ARN",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": { "Key": { "FilterRules": [{ "Name": "prefix", "Value": "camera-inbox/" }] } }
    }
  ]
}
EOF

aws s3api put-bucket-notification-configuration \
  --bucket "$S3_BUCKET" \
  --notification-configuration "file://$NOTIF"
echo "[ok] S3 event notification wired to SQS"
