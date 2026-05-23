import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Include monorepo root so standalone output traces packages/shared correctly
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  // Transpile workspace TypeScript packages (needed for @bolao/shared src/index.ts)
  transpilePackages: ['@bolao/shared'],
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};

export default nextConfig;
