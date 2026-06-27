#!/usr/bin/env node

import { startStdioServer } from "./server.js";

startStdioServer({
  cwd: process.cwd(),
});
