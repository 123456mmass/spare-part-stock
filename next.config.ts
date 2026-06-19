import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const evalSrc = isDev ? " 'unsafe-eval'" : "";

const defaultCSP = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${evalSrc};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self' https://api.line.me;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  object-src 'none';
`;

const liffCSP = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://static.line-scdn.net https://*.line-scdn-net${evalSrc};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://profile.line-scdn.net https://*.line-scdn.net;
  font-src 'self' data:;
  connect-src 'self' https://api.line.me https://*.line.me https://*.line-scdn.net;
  frame-src https://liff.line.me https://liff-apps.line.me https://access.line.me;
  frame-ancestors https://liff.line.me https://liff-apps.line.me;
  form-action 'self' https://access.line.me;
  base-uri 'self';
  object-src 'none';
`;

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  async headers() {
    return [
      {
        source: "/liff",
        headers: [
          {
            key: "Content-Security-Policy",
            value: liffCSP.replace(/\n/g, ""),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/liff/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: liffCSP.replace(/\n/g, ""),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/((?!liff(?:/|$)).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: defaultCSP.replace(/\n/g, ""),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
