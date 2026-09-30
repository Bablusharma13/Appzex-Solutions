import { readTestEnv } from './testEnv';

// Runs before test files import the app, so src/config/env.ts sees test values
// (dotenv never overrides variables that are already set).
Object.assign(process.env, readTestEnv());
