import { Amplify } from "aws-amplify";

const USER_POOL_ID = process.env.NEXT_PUBLIC_USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID;
const REGION = process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1";

let configured = false;

export function configureAmplify() {
  if (configured) return;
  if (!USER_POOL_ID || !USER_POOL_CLIENT_ID) {
    throw new Error(
      "Missing NEXT_PUBLIC_USER_POOL_ID or NEXT_PUBLIC_USER_POOL_CLIENT_ID",
    );
  }
  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId: USER_POOL_ID,
          userPoolClientId: USER_POOL_CLIENT_ID,
          signUpVerificationMethod: "code",
          loginWith: { email: true },
        },
      },
    },
    { ssr: true },
  );
  configured = true;
}

export const AWS_REGION = REGION;
