#!/usr/bin/env node
const { nextBuild } = require('next/dist/cli/next-build');
nextBuild({}).catch((err) => {
  console.error(err);
  process.exit(1);
});
