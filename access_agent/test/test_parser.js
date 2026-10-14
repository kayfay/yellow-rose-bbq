import assert from "node:assert";
import { extractEmailsFromPolicy, parseIntentWithAI } from "../src/index.js";

async function runTests() {
  console.log("Running unit tests for access_agent...\n");

  // Test 1: extractEmailsFromPolicy
  const mockPolicy = {
    name: "Staff Allow Policy",
    decision: "allow",
    include: [
      { email: { email: "Chef.Dave@gmail.com" } },
      { email: { email: "owner@allen.tools" } },
      { ip: { ip: "1.1.1.1/32" } }
    ]
  };

  const emails = extractEmailsFromPolicy(mockPolicy);
  assert.deepStrictEqual(emails, ["chef.dave@gmail.com", "owner@allen.tools"]);
  console.log("✓ extractEmailsFromPolicy correctly extracted lowercase email addresses");

  // Test 2: Fallback parsing without AI mock
  const dummyAi = {
    run: async () => {
      throw new Error("Simulated offline AI model");
    }
  };

  const parsedAdd = await parseIntentWithAI(dummyAi, "Can you add pitmaster77@yahoo.com to the site?");
  assert.strictEqual(parsedAdd.action, "add_user");
  assert.strictEqual(parsedAdd.email, "pitmaster77@yahoo.com");
  console.log("✓ Fallback parser correctly handled add request with email");

  const parsedRemove = await parseIntentWithAI(dummyAi, "please remove oldcook@gmail.com");
  assert.strictEqual(parsedRemove.action, "remove_user");
  assert.strictEqual(parsedRemove.email, "oldcook@gmail.com");
  console.log("✓ Fallback parser correctly handled remove request with email");

  const parsedList = await parseIntentWithAI(dummyAi, "who has access right now?");
  assert.strictEqual(parsedList.action, "list_users");
  console.log("✓ Fallback parser correctly handled list request");

  // Test 3: AI response mock parsing
  const mockAi = {
    run: async () => ({
      response: '```json\n{"action": "add_user", "email": "newwaiter@gmail.com"}\n```'
    })
  };
  const parsedAi = await parseIntentWithAI(mockAi, "grant access to newwaiter@gmail.com please");
  assert.strictEqual(parsedAi.action, "add_user");
  assert.strictEqual(parsedAi.email, "newwaiter@gmail.com");
  console.log("✓ AI response parser correctly stripped markdown fences and extracted JSON");

  console.log("\nAll unit tests passed successfully! 🎉");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
