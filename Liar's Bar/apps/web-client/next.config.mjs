import os from 'node:os';

function getLanAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal || entry.address.startsWith('169.254.')) {
        continue;
      }
      addresses.push(entry.address);
    }
  }
  return addresses;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  transpilePackages: ['@liars-bar/ui', '@liars-bar/shared'],
  devIndicators: {
    position: 'bottom-right'
  },
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    ...getLanAddresses()
  ]
};

export default nextConfig;
