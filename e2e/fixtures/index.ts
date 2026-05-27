import { test as base, expect, APIRequestContext, request } from '@playwright/test';
import { adminContext } from '../api/client';

type Fixtures = {
  adminApi: APIRequestContext;
  anonApi: APIRequestContext;
};

export const test = base.extend<Fixtures>({
  adminApi: async ({}, use) => {
    const ctx = await adminContext();
    await use(ctx);
    await ctx.dispose();
  },
  anonApi: async ({}, use) => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL;
    if (!baseURL) throw new Error('NEXT_PUBLIC_API_URL não definido — verifique e2e/.env.e2e.');
    const ctx = await request.newContext({ baseURL });
    await use(ctx);
    await ctx.dispose();
  },
});

export { expect };
