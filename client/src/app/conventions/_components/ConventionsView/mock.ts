export interface Convention {
  id: string;
  title: string;
  file: string;
  code: string;
  confidence: number;
}

export const MOCK_CONVENTIONS: Convention[] = [
  {
    id: "1",
    title: "Always use async/await instead of .then() chains",
    file: "src/api/users.ts:23-31",
    code: "const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });",
    confidence: 91,
  },
  {
    id: "2",
    title: "All public route handlers return typed Result<T, ApiError>",
    file: "src/api/public/index.ts:14-20",
    code: "function handler(): Result<Item[], ApiError> {\n  return ok(items);\n}",
    confidence: 78,
  },
  {
    id: "3",
    title: "Redis access goes through src/lib/redis.ts singleton",
    file: "src/lib/redis.ts:1-9",
    code: "export const redis = new Redis(config.redisUrl);",
    confidence: 85,
  },
];

export const MOCK_REPO_NAME = "payments-api";
export const MOCK_SAMPLE_COUNT = 84;
export const MOCK_LAST_SCAN = "1h";
