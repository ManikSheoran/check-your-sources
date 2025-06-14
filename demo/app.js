import check from './check.js';

(async () => {
  const claim = "today Isreal is attacking on Iran";
  console.log(`\nChecking claim: "${claim}"\n`);
  try {
    const { explanation, verdict } = await check(claim);
    console.log("\n--- RESULT ---");
    console.log("Verdict :", verdict);
    console.log("Explanation:\n", explanation);
  } catch (e) {
    console.error("Failed to check claim:", e);
  }
})();
