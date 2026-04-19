# SnapRelay — AWS Setup Plan

Everything you need to provision **before** writing Lambda code. Do these in order. Lambda functions and API Gateway come later (in the coding phase) because they need the handler code to exist.

**Region:** lock everything to `us-east-1`. Don't mix regions — CORS, cross-service triggers, and presigned URLs all assume same-region.

---

## 0. Prerequisites (one-time account setup)

### 0.1 AWS account
- Use your school account or a personal one with a credit card attached (Free Tier covers ~all of this for a demo project).
- **Never use the root user for day-to-day work.**

### 0.2 Create an IAM admin user for yourself
1. **IAM → Users → Create user** → name: `carson-admin`.
2. Permissions: attach managed policy `AdministratorAccess`.
3. Enable **Console access** with a password + **Access keys** for CLI.
4. Turn on **MFA** on the root user and on this admin user.

### 0.3 Install & configure AWS CLI
```bash
brew install awscli                  # or download from aws.amazon.com/cli
aws configure                        # paste access key + secret, region us-east-1, output json
aws sts get-caller-identity          # sanity check — prints your account ID + user ARN
```

Write down your **12-digit Account ID** (from `get-caller-identity`). You'll use it in bucket names and ARNs.

### 0.4 Pick names
Throughout this doc I'll use these; substitute `{ACCT}` with your 12-digit account ID:

| Resource | Name |
|---|---|
| S3 bucket | `snaprelay-files-{ACCT}` |
| DynamoDB tables | `snaprelay-files`, `snaprelay-groups`, `snaprelay-memberships`, `snaprelay-invites`, `snaprelay-shares` |
| SQS queues | `snaprelay-processing`, `snaprelay-processing-dlq` |
| Cognito user pool | `snaprelay-users` |
| Cognito app client | `snaprelay-web` |
| Lambda IAM role | `snaprelay-lambda-exec` |

---

## 1. IAM: Lambda execution role

All 11 Lambdas will share one execution role for simplicity. (In production you'd split per function — fine for a class demo.)

### 1.1 Create the role
**IAM → Roles → Create role**
- Trusted entity: **AWS service** → **Lambda**
- Skip permissions for now (we'll add a custom policy next)
- Name: `snaprelay-lambda-exec`

### 1.2 Attach the basic logging policy
On the new role → **Add permissions → Attach policies** → attach **`AWSLambdaBasicExecutionRole`** (managed). This grants CloudWatch Logs write access.

### 1.3 Attach a custom inline policy for SnapRelay resources
On the role → **Add permissions → Create inline policy** → JSON tab → paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Objects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::snaprelay-files-{ACCT}/*"
    },
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
        "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:BatchGetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:{ACCT}:table/snaprelay-files",
        "arn:aws:dynamodb:us-east-1:{ACCT}:table/snaprelay-files/index/*",
        "arn:aws:dynamodb:us-east-1:{ACCT}:table/snaprelay-groups",
        "arn:aws:dynamodb:us-east-1:{ACCT}:table/snaprelay-memberships",
        "arn:aws:dynamodb:us-east-1:{ACCT}:table/snaprelay-memberships/index/*",
        "arn:aws:dynamodb:us-east-1:{ACCT}:table/snaprelay-invites",
        "arn:aws:dynamodb:us-east-1:{ACCT}:table/snaprelay-shares"
      ]
    },
    {
      "Sid": "SQSConsume",
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:us-east-1:{ACCT}:snaprelay-processing"
    }
  ]
}
```

Replace `{ACCT}` before pasting. Name the policy `snaprelay-lambda-resources`.

**Copy the role ARN** (looks like `arn:aws:iam::{ACCT}:role/snaprelay-lambda-exec`) — you'll need it when creating each Lambda.

---

## 2. S3 bucket

### 2.1 Create the bucket
**S3 → Create bucket**
- Name: `snaprelay-files-{ACCT}` (must be globally unique)
- Region: `us-east-1`
- **Block all public access: ON** (leave every checkbox ticked)
- **Bucket Versioning: Enable**
- Encryption: SSE-S3 (default) is fine
- Create

### 2.2 CORS
Bucket → **Permissions → CORS** → paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://*.vercel.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

When you deploy to Vercel, come back and replace `https://*.vercel.app` with your actual domain (e.g. `https://snaprelay.vercel.app`) for slightly tighter security.

### 2.3 Folder convention (no action — just know this)
The Lambdas will write to two prefixes in the same bucket:
- `files/` — original uploads
- `thumbnails/` — Sharp-generated thumbnails (only for JPG/PNG/WebP; RAW files skip this)

S3 doesn't need the prefixes pre-created — they appear automatically when objects are written.

### 2.4 Don't set up S3 → SQS notification yet
We'll do that in **Step 5** after SQS exists.

---

## 3. DynamoDB tables (5)

All tables: **On-demand** capacity (no capacity planning, charges per request — free tier covers plenty for a demo).

### 3.1 `snaprelay-files` — file metadata
**DynamoDB → Tables → Create table**
- Table name: `snaprelay-files`
- Partition key: `userId` (String)
- Sort key: `fileId` (String)
- Capacity: **On-demand**
- Create

**Add GSI** (on the table's **Indexes** tab → Create index):
- Name: `groupId-uploadedAt-index`
- Partition key: `groupId` (String)
- Sort key: `uploadedAt` (String)
- Projection: **All**

### 3.2 `snaprelay-groups` — group records
- PK: `groupId` (String)
- No sort key, no GSI
- On-demand

### 3.3 `snaprelay-memberships` — user ↔ group
- PK: `userId` (String)
- SK: `groupId` (String)
- On-demand

**Add GSI** for "list members of a group":
- Name: `groupId-index`
- Partition key: `groupId` (String)
- Sort key: `userId` (String)
- Projection: **Keys only** (we only need userIds)

### 3.4 `snaprelay-invites` — pending group invites
- PK: `inviteCode` (String)
- No sort key, no GSI
- On-demand

**Enable TTL** on this table:
- Table → **Additional settings → Time to live (TTL) → Enable**
- TTL attribute name: `expiresAt`
- Lambdas will store `expiresAt` as a Unix epoch seconds number. DynamoDB auto-deletes expired rows within 48h.

### 3.5 `snaprelay-shares` — public share links
- PK: `shareId` (String)
- No sort key, no GSI
- On-demand
- **Enable TTL on `expiresAt`** (same as above)

---

## 4. SQS queues

### 4.1 Dead-letter queue first
**SQS → Create queue**
- Type: **Standard**
- Name: `snaprelay-processing-dlq`
- Leave defaults
- Create
- **Copy its ARN** from the Details tab.

### 4.2 Main queue
**SQS → Create queue**
- Type: **Standard**
- Name: `snaprelay-processing`
- Visibility timeout: **60 seconds** (Sharp thumbnail generation can be slow on large images)
- Message retention: **4 days** (default)
- **Dead-letter queue** section:
  - Enable
  - DLQ: paste the `snaprelay-processing-dlq` ARN from Step 4.1
  - Max receives: `3`
- Create
- **Copy the main queue's ARN and URL** — you'll paste the ARN into S3 in the next step.

### 4.3 Access policy — let S3 send to the queue
Queue → **Access policy → Edit** → replace with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ToSendMessages",
      "Effect": "Allow",
      "Principal": { "Service": "s3.amazonaws.com" },
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:us-east-1:{ACCT}:snaprelay-processing",
      "Condition": {
        "ArnLike": {
          "aws:SourceArn": "arn:aws:s3:::snaprelay-files-{ACCT}"
        },
        "StringEquals": {
          "aws:SourceAccount": "{ACCT}"
        }
      }
    }
  ]
}
```

Without this policy, S3 can't publish events to the queue and the notification setup in Step 5 will fail.

---

## 5. Wire S3 → SQS event notification

Now both ends exist, so tell S3 to publish ObjectCreated events to the main queue.

**S3 → `snaprelay-files-{ACCT}` → Properties → Event notifications → Create event notification**
- Name: `new-file-uploaded`
- Prefix: `files/` (only fire for originals, not thumbnails)
- Event types: check **All object create events** (`s3:ObjectCreated:*`)
- Destination: **SQS queue**
- SQS queue: select `snaprelay-processing`
- Save

AWS will validate the SQS policy — if the policy from Step 4.3 isn't right, it'll reject with a clear error. Fix the policy and retry.

---

## 6. Cognito User Pool

### 6.1 Create the pool
**Cognito → User pools → Create user pool**

**Sign-in experience:**
- Provider types: **Cognito user pool**
- Sign-in options: check only **Email** (uncheck username)

**Security requirements:**
- Password policy: **Custom**
  - Minimum length: `8`
  - Uncheck all complexity requirements (optional — whatever you want)
- MFA: **No MFA** (simplest for a demo; production should be "Optional")
- User account recovery: **Email only**

**Sign-up experience:**
- Self-service sign-up: **Enable**
- Required attributes: `email`
- Custom attributes: none
- Email verification: **Send code** (default)

**Message delivery:**
- Email provider: **Send email with Cognito** (free tier covers 50 emails/day — plenty for a demo)
- FROM address: leave default

**Integrate your app:**
- User pool name: `snaprelay-users`
- Hosted UI: **skip** (we use Amplify in the frontend, not the hosted UI)
- Initial app client:
  - App type: **Public client**
  - App client name: `snaprelay-web`
  - Client secret: **Don't generate**
  - Authentication flows: check **ALLOW_USER_PASSWORD_AUTH** and **ALLOW_REFRESH_TOKEN_AUTH**, uncheck the SRP flow
- Create

### 6.2 Copy these values — you'll need them in `.env.local`
- **User Pool ID** (e.g. `us-east-1_aBcDeFgHi`)
- **App Client ID** (looks like a 26-char alphanumeric string)
- **Cognito issuer URL** (for the API Gateway authorizer later): `https://cognito-idp.us-east-1.amazonaws.com/{USER_POOL_ID}`

### 6.3 Token lifetimes (optional but recommended)
User pool → **App integration → App clients → `snaprelay-web` → Edit token expiration**
- Access token: `1 hour` (default)
- ID token: `1 hour`
- Refresh token: `30 days`

---

## 7. Sharp Lambda layer — defer

You'll need a Sharp binary packaged for Amazon Linux 2023 / Node.js 20 for thumbnail generation. Two paths, decide later when we write `processUpload`:

- **Easy:** use a public community layer (search "sharp lambda layer nodejs20 arn" — there are maintained ones on GitHub)
- **Clean:** build your own zip with Docker and publish it:
  ```bash
  docker run --rm -v "$PWD":/var/task public.ecr.aws/sam/build-nodejs20.x:latest \
    bash -c "npm install --arch=x64 --platform=linux --libc=glibc sharp && zip -r sharp-layer.zip node_modules"
  aws lambda publish-layer-version --layer-name sharp-nodejs20 \
    --zip-file fileb://sharp-layer.zip --compatible-runtimes nodejs20.x
  ```

**No action needed now.** Noted so you're not surprised.

---

## 8. Where to put the values

There's one file for the whole project:

```
/Users/carsonhoward6/SnapRelay/.env          ← real values, gitignored, edit this
/Users/carsonhoward6/SnapRelay/.env.example  ← committed template, for reference
```

The frontend consumes it via a symlink (`snaprelay-frontend/.env.local → ../.env`), and the Lambda deploy scripts (written in Phase 2) will `source` it to populate each function's environment. **Do not put anything in `snaprelay-frontend/.env.local` directly** — edit the root `.env`.

As you finish each AWS step, fill in the corresponding line:

| Step | Variable | Where it comes from |
|---|---|---|
| 0.3 | `AWS_ACCOUNT_ID` | `aws sts get-caller-identity` |
| 0.3 | `AWS_REGION` | Already `us-east-1` |
| 1 | `LAMBDA_EXEC_ROLE_ARN` | IAM → Role → Summary → ARN |
| 2 | `S3_BUCKET` | `snaprelay-files-{ACCT}` |
| 4.2 | `SQS_QUEUE_URL` | SQS queue → Details → URL |
| 4.2 | `SQS_QUEUE_ARN` | SQS queue → Details → ARN |
| 6.2 | `NEXT_PUBLIC_USER_POOL_ID` | Cognito user pool overview |
| 6.2 | `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | Cognito app client |

`NEXT_PUBLIC_API_URL` stays blank until API Gateway is deployed in Phase 2. `NEXT_PUBLIC_USE_MOCK=true` keeps the frontend on the in-memory mock; flip to `false` only after the backend is live.

**What doesn't go in `.env`:**
- **Your AWS developer access keys** — live in `~/.aws/credentials` (via `aws configure`), never in the project
- **Per-Lambda env vars** — set on each Lambda in the Console (deploy scripts will do this for you in Phase 2)

---

## 9. Verification checklist

Before writing any Lambda code, confirm each piece with the CLI. If any command errors, fix that step before continuing.

```bash
# S3
aws s3 ls s3://snaprelay-files-{ACCT}
aws s3api get-bucket-cors --bucket snaprelay-files-{ACCT}
aws s3api get-bucket-versioning --bucket snaprelay-files-{ACCT}
aws s3api get-bucket-notification-configuration --bucket snaprelay-files-{ACCT}

# DynamoDB — all five should list
aws dynamodb list-tables | grep snaprelay
aws dynamodb describe-table --table-name snaprelay-files \
  --query 'Table.GlobalSecondaryIndexes[].IndexName'

# SQS — both should appear
aws sqs list-queues | grep snaprelay

# Cognito
aws cognito-idp list-user-pools --max-results 20 | grep snaprelay
aws cognito-idp list-user-pool-clients --user-pool-id us-east-1_XXXXXXXXX

# IAM
aws iam get-role --role-name snaprelay-lambda-exec
aws iam list-attached-role-policies --role-name snaprelay-lambda-exec
aws iam list-role-policies --role-name snaprelay-lambda-exec
```

**End-to-end trigger test** (proves the S3 → SQS wiring works before any Lambda exists):

```bash
# 1. Upload a dummy file
echo "hello" > /tmp/test.txt
aws s3 cp /tmp/test.txt s3://snaprelay-files-{ACCT}/files/test.txt

# 2. Poll the queue — you should see the ObjectCreated event
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/{ACCT}/snaprelay-processing \
  --max-number-of-messages 1 \
  --wait-time-seconds 10

# 3. Delete the dummy
aws s3 rm s3://snaprelay-files-{ACCT}/files/test.txt
```

If step 2 returns a message containing `"eventName": "ObjectCreated:Put"`, your event pipeline works and you're ready to write Lambdas.

---

## 10. What's deferred to the coding phase

These happen **after** we write Lambda code, because they depend on the handler bundles existing:

1. **Create 11 Lambda functions** — each from its zip, attached to the `snaprelay-lambda-exec` role, with env vars from Step 8.
2. **Attach Sharp layer** to `snaprelay-processUpload` only.
3. **Create SQS → Lambda event source mapping** pointing at `snaprelay-processUpload`, batch size 1.
4. **Create API Gateway REST API** (`snaprelay-api`) with Cognito authorizer, 10 routes, deploy to `prod` stage.
5. **Enable CORS on every route** for the frontend origins.

We'll do all of this as part of the Lambda implementation work — no need to set it up now.

---

## 11. Cost & cleanup notes

- Everything here is either Free Tier or pennies per month at demo scale:
  - S3: $0.023/GB/month
  - DynamoDB on-demand: $1.25 per million writes, $0.25 per million reads — you'll be well under
  - SQS: 1M requests/month free forever
  - Cognito: 50,000 MAU free
  - Lambda: 1M requests/month free forever
- **Budget alarm:** set a **$5 CloudWatch billing alarm** via **Billing → Budgets** so nothing surprises you.
- **Cleanup after the course:** delete in this order: API Gateway → Lambdas → SQS queues → DynamoDB tables → S3 bucket (empty first) → Cognito pool → IAM role. Or just Cloud Custodian it.

---

## 12. Estimated time

- IAM role: 10 min
- S3 bucket + CORS: 10 min
- DynamoDB tables (5): 25 min
- SQS queues + policy: 15 min
- S3 → SQS wiring + verification: 10 min
- Cognito pool + client: 20 min

**Total: ~90 minutes of clicking**, if nothing goes wrong. Budget 2 hours your first time through.

Once this is done, we switch to writing the Lambda code and you'll never touch the AWS Console for provisioning again — just deploy Lambda zips with `aws lambda update-function-code`.
