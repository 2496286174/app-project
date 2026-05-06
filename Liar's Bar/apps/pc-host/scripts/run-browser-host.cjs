const path = require('path');
const { createHostRuntime } = require('@liars-bar/host-runtime');

const disableStaticWeb = process.env.HOST_DISABLE_STATIC_WEB === '1';
const runtime = createHostRuntime({
  platform: disableStaticWeb ? 'dev' : 'pc',
  hostName: disableStaticWeb ? "Liar's Bar Dev Host" : "Liar's Bar PC Host",
  port: Number(process.env.HOST_PORT || 3000),
  webRoot: path.join(__dirname, '..', 'build'),
  disableStaticWeb,
  devInstructions: process.env.HOST_DEV_MESSAGE,
  devJoinUrl: process.env.HOST_DEV_JOIN_URL
});

runtime.ready
  .then((hostInfo) => {
    console.log(`Browser test host ready at ${hostInfo.localUrl}`);
    console.log(`LAN join URL: ${hostInfo.joinUrl}`);
  })
  .catch((error) => {
    console.error('Failed to start browser test host:', error);
    process.exit(1);
  });

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await runtime.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
