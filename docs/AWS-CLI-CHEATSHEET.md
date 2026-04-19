# SnapRelay — AWS CLI Cheat Sheet

Copy-paste commands for every AWS operation in this project. Replace `{accountId}` with your 12-digit AWS account ID.

---

## Setup

```bash
# Configure AWS CLI
aws configure
# AWS Access Key ID: [from IAM]
# AWS Secret Access Key: [from IAM]
# Default region: us-east-1
# Default output format: json

# Verify identity
aws sts get-caller-identity
```

---

## S3

```bash
# Create bucket
aws s3api create-bucket \
  --bucket snaprelay-files-{accountId} \
  --region us-east-1

# Block all public access
aws s3api put-public-access-block \
  --bucket snaprelay-files-{accountId} \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket snaprelay-files-{accountId} \
  --versioning-configuration Status=Enabled

# Apply CORS config (create cors.json first)
aws s3api put-bucket-cors \
  --bucket snaprelay-files-{accountId} \
  --cors-configuration file://cors.json

# List objects
aws s3 ls s3://snaprelay-files-{accountId}/uploads/

# Generate a pre-signed URL manually (for testing)
aws s3 presign s3://snaprelay-files-{accountId}/test.jpg --expires-in 3600
```

---

## DynamoDB

```bash
# Create table
aws dynamodb create-table \
  --table-name snaprelay-files \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=fileId,AttributeType=S \
    AttributeName=groupId,AttributeType=S \
    AttributeName=uploadedAt,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=fileId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[
    {
      "IndexName": "groupId-uploadedAt-index",
      "KeySchema": [
        {"AttributeName": "groupId", "KeyType": "HASH"},
        {"AttributeName": "uploadedAt", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]'

# Insert test item
aws dynamodb put-item \
  --table-name snaprelay-files \
  --item '{
    "userId": {"S": "test-user-123"},
    "fileId": {"S": "file-abc-456"},
    "fileName": {"S": "DSC_0001.jpg"},
    "fileSize": {"N": "8300000"},
    "fileType": {"S": "JPG"},
    "groupId": {"S": "wedding-crew"},
    "isPublic": {"BOOL": false},
    "status": {"S": "ready"},
    "uploadedAt": {"S": "2026-04-16T14:00:00Z"},
    "uploadedBy": {"S": "Carson"}
  }'

# Query by userId
aws dynamodb query \
  --table-name snaprelay-files \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "test-user-123"}}'

# Query GSI by groupId
aws dynamodb query \
  --table-name snaprelay-files \
  --index-name groupId-uploadedAt-index \
  --key-condition-expression "groupId = :gid" \
  --expression-attribute-values '{":gid": {"S": "wedding-crew"}}' \
  --scan-index-forward false
```

---

## Lambda

```bash
# Create a Lambda function (run from inside the function folder after zipping)
cd presign && zip -r ../presign.zip . && cd ..

aws lambda create-function \
  --function-name snaprelay-presign \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::{accountId}:role/snaprelay-lambda-role \
  --zip-file fileb://presign.zip \
  --environment Variables="{S3_BUCKET=snaprelay-files-{accountId},REGION=us-east-1}" \
  --timeout 30 \
  --memory-size 256

# Update function code after changes
zip -r presign.zip . && aws lambda update-function-code \
  --function-name snaprelay-presign \
  --zip-file fileb://presign.zip

# Invoke a Lambda manually for testing
aws lambda invoke \
  --function-name snaprelay-presign \
  --payload file://test-event.json \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json

# View recent logs
aws logs tail /aws/lambda/snaprelay-presign --follow

# List all functions
aws lambda list-functions --query 'Functions[*].FunctionName'
```

---

## SQS

```bash
# Create queue
aws sqs create-queue \
  --queue-name snaprelay-processing \
  --attributes '{
    "VisibilityTimeout": "30",
    "MessageRetentionPeriod": "345600"
  }'

# Get queue URL
aws sqs get-queue-url --queue-name snaprelay-processing

# Send a test message
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/{accountId}/snaprelay-processing \
  --message-body '{"fileId":"test-123","userId":"user-456","s3Key":"uploads/user-456/test-123/test.jpg","groupId":"wedding-crew"}'

# Add Lambda event source mapping (connects SQS to Lambda)
aws lambda create-event-source-mapping \
  --function-name snaprelay-processUpload \
  --event-source-arn arn:aws:sqs:us-east-1:{accountId}:snaprelay-processing \
  --batch-size 1
```

---

## Cognito

```bash
# Create user pool
aws cognito-idp create-user-pool \
  --pool-name snaprelay-users \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":false,"RequireLowercase":false,"RequireNumbers":false,"RequireSymbols":false}}' \
  --auto-verified-attributes email

# Create app client (save the ClientId from output)
aws cognito-idp create-user-pool-client \
  --user-pool-id {userPoolId} \
  --client-name snaprelay-web \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH

# Create a group
aws cognito-idp create-group \
  --user-pool-id {userPoolId} \
  --group-name wedding-crew

# Create a test user
aws cognito-idp admin-create-user \
  --user-pool-id {userPoolId} \
  --username test@example.com \
  --temporary-password TempPass123

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id {userPoolId} \
  --username test@example.com \
  --password TestPass123 \
  --permanent

# Add user to group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id {userPoolId} \
  --username test@example.com \
  --group-name wedding-crew

# Get a JWT for testing (returns AccessToken you can use in API calls)
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id {clientId} \
  --auth-parameters USERNAME=test@example.com,PASSWORD=TestPass123
```

---

## IAM

```bash
# Create the Lambda execution role
aws iam create-role \
  --role-name snaprelay-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach managed policy for CloudWatch Logs
aws iam attach-role-policy \
  --role-name snaprelay-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach inline policy for S3 + DynamoDB + SQS
# (create the JSON file from SKILL.md first, then:)
aws iam put-role-policy \
  --role-name snaprelay-lambda-role \
  --policy-name snaprelay-permissions \
  --policy-document file://lambda-policy.json
```

---

## API Gateway (via Console is easier, but CLI reference)

```bash
# List APIs
aws apigateway get-rest-apis

# Get API ID
aws apigateway get-rest-apis --query 'items[?name==`snaprelay-api`].id' --output text

# Deploy to prod stage (after making changes)
aws apigateway create-deployment \
  --rest-api-id {apiId} \
  --stage-name prod
```

---

## Useful Debug Commands

```bash
# Check Lambda has right permissions
aws lambda get-function-configuration --function-name snaprelay-presign

# Check DynamoDB table status and GSI status
aws dynamodb describe-table --table-name snaprelay-files \
  --query 'Table.{Status:TableStatus,GSIs:GlobalSecondaryIndexes[*].{Name:IndexName,Status:IndexStatus}}'

# Check SQS queue attributes
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/{accountId}/snaprelay-processing \
  --attribute-names All

# Check how many messages are in SQS
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/{accountId}/snaprelay-processing \
  --attribute-names ApproximateNumberOfMessages

# Tail Lambda logs live
aws logs tail /aws/lambda/snaprelay-processUpload --follow --format short
```

---

## Mock Test Event JSONs

### presign Lambda test event
```json
{
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-123",
        "name": "Carson"
      }
    }
  },
  "body": "{\"fileName\":\"DSC_0001.jpg\",\"fileType\":\"image/jpeg\",\"groupId\":\"wedding-crew\",\"isPublic\":false}"
}
```

### listFiles Lambda test event (by group)
```json
{
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-123"
      }
    }
  },
  "queryStringParameters": {
    "group": "wedding-crew"
  }
}
```

### shareLink Lambda test event
```json
{
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-123"
      }
    }
  },
  "pathParameters": {
    "id": "file-abc-456"
  },
  "queryStringParameters": {
    "expires": "86400"
  }
}
```

### processUpload SQS Lambda test event
```json
{
  "Records": [
    {
      "body": "{\"fileId\":\"file-abc-456\",\"userId\":\"test-user-123\",\"s3Key\":\"uploads/test-user-123/file-abc-456/DSC_0001.jpg\",\"groupId\":\"wedding-crew\"}"
    }
  ]
}
```
