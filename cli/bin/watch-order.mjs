#!/usr/bin/env node
import { run } from "../src/index.mjs";

process.exitCode = await run(process.argv.slice(2), { stdout: process.stdout, stderr: process.stderr });
