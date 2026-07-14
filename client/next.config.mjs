import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001",
  },
  webpack: (config) => {
    // The vendored @devdigest/shared contracts are TS sources whose relative
    // imports carry ESM ".js" extensions. tsc follows those to the ".ts" file;
    // webpack does not, so any *value* import (a Zod schema, not just a type)
    // from the barrel fails to resolve without this alias.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
