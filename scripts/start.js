#!/usr/bin/env node
const { nextStart } = require('next/dist/cli/next-start');
nextStart({ port: 3000, hostname: '0.0.0.0' }).catch((err) => {
  console.error(err);
  process.exit(1);
});
