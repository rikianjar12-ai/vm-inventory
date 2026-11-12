import { networkInterfaces } from "os";
import type { NextConfig } from "next";

const localHostname = "vm-inventoryserver.lrt";

function lanHosts() {
  const hosts = new Set([
    localHostname,
    "127.0.0.1",
    "localhost",
    "192.168.38.22",
    "192.168.38.10",
    "192.168.38.11",
    process.env.APP_PUBLIC_HOST ?? "",
  ]);
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        hosts.add(addr.address);
      }
    }
  }
  return [...hosts].filter(Boolean);
}

const allowedHosts = lanHosts();

const isDevServer = process.argv.includes("dev");

const nextConfig: NextConfig = {
  // Keep `next dev` cache away from `next build`, so production builds
  // cannot delete the stylesheet the login page needs.
  distDir: isDevServer ? ".next-dev" : ".next",
  turbopack: {
    root: process.cwd(),
  },
  // Izinkan akses dari laptop lain di LAN (IP Wi-Fi/Ethernet), bukan hanya localhost.
  allowedDevOrigins: allowedHosts,
  experimental: {
    serverActions: {
      allowedOrigins: allowedHosts,
    },
  },
};

export default nextConfig;
