# SnapRelay AWS Skill
**File Storage & Sharing Service — AWS Final Project**

Use this skill whenever working on SnapRelay. It contains every service config, code pattern, naming convention, and decision already made for the project. Always reference this before writing any Lambda, schema, or frontend code.

---

## Project Identity

- **App Name:** SnapRelay
- **Type:** File Storage & Sharing Service (Assignment Option 1)
- **Stack:** Next.js frontend → API Gateway → Lambda → S3 + DynamoDB + SQS + Cognito
- **AWS Services Used:** S3, Lambda, API Gateway, Cognito, DynamoDB, SQS (6 services = A-tier)
- **Deployment:** Frontend on Vercel, Backend fully serverless on AWS
- **Region:** `us-east-1` (use this everywhere for consistency)

---

## AWS Services & Their Exact Roles

### 1. S3 — File Storage
- **Bucket:** `snaprelay-files-{accountId}`
- **Folder structure:** `uploads/{userId}/{fileId}/{filename}`
- **Two access modes:**
  - Private files: only accessible via pre-signed URLs (15-min expiry for view, 1-hr for download)
  - Public files: S3 object tagged `public=true`, served via CloudFront
- **CORS config required** for browser direct upload
- **S3 Event:** `s3:ObjectCreated:*` → triggers `processUpload` Lambda → sends to SQS

### 2. Lambda — All Business Logic
Five functions, all Node.js 20.x runtime:

| Function Name | Trigger | What It Does |
|---|---|---|
| `snaprelay-presign` | API Gateway POST /upload/presign | Returns pre-signed S3 PUT URL |
| `snaprelay-savePhoto` | API Gateway POST /files | Writes metadata to DynamoDB |
| `snaprelay-listFiles` | API Gateway GET /files | Queries DynamoDB, returns file list |
| `snaprelay-shareLink` | API Gateway POST /files/{id}/share | Generates pre-signed GET URL |
| `snaprelay-processUpload` | SQS | Generates thumbnail, updates DynamoDB status |

**Lambda env vars (set in all functions):**
```
S3_BUCKET=snaprelay-files-{accountId}
DYNAMODB_TABLE=snaprelay-files
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/{accountId}/snaprelay-processing
REGION=us-east-1
```

### 3. API Gateway — REST API
- **Name:** `snaprelay-api`
- **Auth:** Cognito Authorizer on all routes except OPTIONS
- **Base URL:** `https://{id}.execute-api.us-east-1.amazonaws.com/prod`
- **Routes:**
  ```
  POST   /upload/presign     → snaprelay-presign
  POST   /files              → snaprelay-savePhoto
  GET    /files              → snaprelay-listFiles
  GET    /files/{id}         → snaprelay-listFiles (single)
  POST   /files/{id}/share   → snaprelay-shareLink
  DELETE /files/{id}         → snaprelay-deleteFile
  ```
- Enable CORS on every route (Allow-Origin: your Vercel domain)

### 4. Cognito — Authentication
- **User Pool:** `snaprelay-users`
- **App Client:** `snaprelay-web` (no secret, public client)
- **Groups:** `admins`, `wedding-crew`, `sports-team`, `public`
- **JWT claims used:** `sub` (userId), `cognito:groups` (group membership)
- **Token validity:** Access token 1hr, Refresh token 30 days
- API Gateway Cognito Authorizer validates JWT on every request automatically

### 5. DynamoDB — File Metadata
- **Table:** `snaprelay-files`
- **Partition key:** `userId` (String)
- **Sort key:** `fileId` (String)
- **GSI:** `groupId-uploadedAt-index` (for group gallery queries)
- **Item schema:**
  ```json
  {
    "userId": "cognito-sub-uuid",
    "fileId": "uuid-v4",
    "fileName": "DSC_0001.CR3",
    "fileSize": 25400000,
    "fileType": "RAW",
    "mimeType": "image/x-canon-cr3",
    "s3Key": "uploads/userId/fileId/DSC_0001.CR3",
    "groupId": "wedding-crew",
    "isPublic": false,
    "status": "processing | ready | error",
    "thumbnailKey": "thumbs/userId/fileId/thumb.jpg",
    "uploadedAt": "2026-04-16T14:22:00Z",
    "uploadedBy": "Carson"
  }
  ```

### 6. SQS — Async Processing Queue
- **Queue:** `snaprelay-processing`
- **Type:** Standard Queue
- **Flow:** S3 ObjectCreated event → Lambda → SQS → `snaprelay-processUpload` Lambda
- **Why SQS?** Decouples upload from processing. User gets instant confirmation, thumbnail generates in background. This is what impresses the professor.
- **Message body:**
  ```json
  {
    "fileId": "uuid",
    "userId": "cognito-sub",
    "s3Key": "uploads/userId/fileId/filename",
    "groupId": "wedding-crew"
  }
  ```

---

## IAM Roles (copy-paste these)

### Lambda Execution Role (`snaprelay-lambda-role`)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::snaprelay-files-*/*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query", "dynamodb:UpdateItem", "dynamodb:DeleteItem"],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/snaprelay-files*"
    },
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"],
      "Resource": "arn:aws:sqs:us-east-1:*:snaprelay-processing"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*"
    }
  ]
}
```

---

## Lambda Code Patterns

### presign.js — Generate S3 Upload URL
```javascript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({ region: process.env.REGION });

export const handler = async (event) => {
  const userId = event.requestContext.authorizer.claims.sub;
  const { fileName, fileType, groupId, isPublic } = JSON.parse(event.body);

  const fileId = uuidv4();
  const s3Key = `uploads/${userId}/${fileId}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    ContentType: fileType,
    Metadata: { userId, fileId, groupId, isPublic: String(isPublic) },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ uploadUrl, fileId, s3Key }),
  };
};
```

### savePhoto.js — Write Metadata to DynamoDB
```javascript
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const dynamo = new DynamoDBClient({ region: process.env.REGION });

export const handler = async (event) => {
  const userId = event.requestContext.authorizer.claims.sub;
  const userName = event.requestContext.authorizer.claims.name || "Unknown";
  const body = JSON.parse(event.body);

  const item = {
    userId,
    fileId: body.fileId,
    fileName: body.fileName,
    fileSize: body.fileSize,
    fileType: body.fileType,
    s3Key: body.s3Key,
    groupId: body.groupId,
    isPublic: body.isPublic,
    status: "processing",
    uploadedAt: new Date().toISOString(),
    uploadedBy: userName,
  };

  await dynamo.send(new PutItemCommand({
    TableName: process.env.DYNAMODB_TABLE,
    Item: marshall(item),
  }));

  return {
    statusCode: 201,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ success: true, fileId: body.fileId }),
  };
};
```

### listFiles.js — Query DynamoDB
```javascript
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamo = new DynamoDBClient({ region: process.env.REGION });

export const handler = async (event) => {
  const userId = event.requestContext.authorizer.claims.sub;
  const groupId = event.queryStringParameters?.group;

  let params;

  if (groupId) {
    // Query GSI for group gallery
    params = {
      TableName: process.env.DYNAMODB_TABLE,
      IndexName: "groupId-uploadedAt-index",
      KeyConditionExpression: "groupId = :g",
      ExpressionAttributeValues: { ":g": { S: groupId } },
      ScanIndexForward: false, // newest first
    };
  } else {
    // Query by userId
    params = {
      TableName: process.env.DYNAMODB_TABLE,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": { S: userId } },
      ScanIndexForward: false,
    };
  }

  const result = await dynamo.send(new QueryCommand(params));
  const files = result.Items.map(unmarshall);

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ files }),
  };
};
```

### shareLink.js — Pre-signed Download URL
```javascript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const s3 = new S3Client({ region: process.env.REGION });
const dynamo = new DynamoDBClient({ region: process.env.REGION });

export const handler = async (event) => {
  const userId = event.requestContext.authorizer.claims.sub;
  const fileId = event.pathParameters.id;
  const expiresIn = parseInt(event.queryStringParameters?.expires || "3600");

  // Get file metadata
  const result = await dynamo.send(new GetItemCommand({
    TableName: process.env.DYNAMODB_TABLE,
    Key: { userId: { S: userId }, fileId: { S: fileId } },
  }));

  if (!result.Item) {
    return { statusCode: 404, body: JSON.stringify({ error: "File not found" }) };
  }

  const file = unmarshall(result.Item);

  // Generate signed URL
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: file.s3Key,
    ResponseContentDisposition: `attachment; filename="${file.fileName}"`,
  });

  const downloadUrl = await getSignedUrl(s3, command, { expiresIn });

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ downloadUrl, expiresIn, fileName: file.fileName }),
  };
};
```

### processUpload.js — SQS Consumer (Thumbnail Generator)
```javascript
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const s3 = new S3Client({ region: process.env.REGION });
const dynamo = new DynamoDBClient({ region: process.env.REGION });

export const handler = async (event) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const { fileId, userId, s3Key } = message;

    try {
      // Update status to "ready" (real app would generate thumbnail here)
      // For the assignment, updating DynamoDB status is sufficient to show SQS working
      await dynamo.send(new UpdateItemCommand({
        TableName: process.env.DYNAMODB_TABLE,
        Key: { userId: { S: userId }, fileId: { S: fileId } },
        UpdateExpression: "SET #s = :s, processedAt = :t",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":s": { S: "ready" },
          ":t": { S: new Date().toISOString() },
        },
      }));

      console.log(`Processed file ${fileId} for user ${userId}`);
    } catch (err) {
      console.error(`Failed to process ${fileId}:`, err);
      throw err; // SQS will retry
    }
  }
};
```

---

## Frontend Patterns (Next.js)

### Upload Flow (3 steps, no file through server)
```typescript
// lib/upload.ts
export async function uploadFile(file: File, groupId: string, isPublic: boolean, token: string) {
  // Step 1: Get pre-signed URL
  const presignRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/presign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, fileType: file.type, groupId, isPublic }),
  });
  const { uploadUrl, fileId, s3Key } = await presignRes.json();

  // Step 2: Upload directly to S3
  await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

  // Step 3: Save metadata
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, s3Key, fileName: file.name, fileSize: file.size, fileType: file.name.endsWith(".CR3") || file.name.endsWith(".NEF") ? "RAW" : "JPG", groupId, isPublic }),
  });

  return fileId;
}
```

### Cognito Auth Setup (amplify)
```typescript
// lib/auth.ts
import { Amplify } from "aws-amplify";
import { signIn, signOut, getCurrentUser, fetchAuthSession } from "aws-amplify/auth";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
    },
  },
});

export async function getToken(): Promise<string> {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString() ?? "";
}
```

### Environment Variables (.env.local)
```
NEXT_PUBLIC_API_URL=https://{id}.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_S3_BUCKET=snaprelay-files-{accountId}
```

---

## S3 CORS Config (apply in AWS console)
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.vercel.app"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## Demo Script (for final presentation)

1. Open app → login screen (Cognito)
2. Sign in with test account
3. Drag a JPG + a RAW file onto upload zone → pick group "wedding-crew" → click Upload
4. Show the 3-step process: presign → S3 PUT → metadata save → "processing" status
5. Refresh gallery → file appears, status changes to "ready" (SQS processed it)
6. Click file → Download button → show file downloads
7. Click Share → copy 24hr link → open in incognito → show it works without login
8. Switch to "sports-team" group → different files
9. **Walk the architecture diagram** while narrating what just happened

**Key talking point for SQS:** "After the file lands in S3, an event fires into SQS. A separate Lambda polls that queue and updates the status — this decouples the upload response from the processing work. The user gets instant feedback while processing happens asynchronously."

---

## Common Errors & Fixes

| Error | Fix |
|---|---|
| CORS error on S3 PUT | Add `localhost:3000` to S3 CORS AllowedOrigins |
| 401 on API Gateway | Check Cognito token isn't expired; use `fetchAuthSession` to refresh |
| Lambda timeout | Increase timeout to 30s in function config (default is 3s) |
| DynamoDB query returns empty | Check GSI is fully active (takes 1-2 min after creation) |
| SQS Lambda not triggering | Check Lambda has `sqs:ReceiveMessage` permission + event source mapping is enabled |
| S3 presign URL expired | Generate URL right before upload, don't cache it |

---

## Architecture Diagram Description (for draw.io / Lucidchart)

```
[Browser/Mobile]
      |  HTTPS
[Vercel — Next.js Frontend]
      |  JWT in Authorization header
[API Gateway — REST API]
      | Cognito Authorizer validates JWT
   ┌──┴──────────────┬──────────────┐
   ↓                 ↓              ↓
[Lambda           [Lambda        [Lambda
 presign]          listFiles]     shareLink]
   |                  |              |
   | PUT URL       [DynamoDB]    [S3 GetObject
   ↓                              signed URL]
[Browser uploads
 directly to S3]
      |
   [S3 Bucket]
      | ObjectCreated event
   [Lambda — S3 trigger]
      |
   [SQS Queue]
      |
   [Lambda — processUpload]
      |
   [DynamoDB — update status to "ready"]
```
