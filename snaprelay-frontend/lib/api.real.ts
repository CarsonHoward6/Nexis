// Wired in Phase 2. Shape mirrors mockApi — see lib/api.mock.ts.
// Each method issues a fetch() against API Gateway with a Bearer token from Amplify.

export const realApi = new Proxy(
  {},
  {
    get() {
      return () => {
        throw new Error(
          "Real AWS backend is not wired yet. Set NEXT_PUBLIC_USE_MOCK=true or implement lib/api.real.ts.",
        );
      };
    },
  },
) as typeof import("./api.mock").mockApi;
