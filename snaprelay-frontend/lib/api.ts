import { mockApi } from "./api.mock";
import { realApi } from "./api.real";

const useMock = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export const api = useMock ? mockApi : realApi;
export type Api = typeof mockApi;
