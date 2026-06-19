// Load .env for the test process (Node 22+/24 has process.loadEnvFile).
try {
  process.loadEnvFile(".env");
} catch {
  // .env optional if vars already in environment
}
