import assert from "node:assert";
import {
  extractEmailsFromPolicy,
  parseIntentWithAI,
  serveRequestAccessHtml,
  handleWebRequestAccess
} from "../src/index.js";

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

  // Test 4: serveRequestAccessHtml
  const htmlRes = serveRequestAccessHtml();
  assert.strictEqual(htmlRes.status, 200);
  assert.strictEqual(htmlRes.headers.get("Content-Type"), "text/html; charset=utf-8");
  const htmlContent = await htmlRes.text();
  assert(htmlContent.includes("Request Access"), "HTML should contain 'Request Access'");
  assert(htmlContent.includes('type="email"'), "HTML should contain email input");
  console.log("✓ serveRequestAccessHtml served responsive HTML request access form");

  // Test 5: handleWebRequestAccess validation
  const invalidReq = new Request("https://access.example.com/api/request-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid-email" })
  });
  const invalidRes = await handleWebRequestAccess(invalidReq, {});
  assert.strictEqual(invalidRes.status, 400);
  const invalidJson = await invalidRes.json();
  assert.strictEqual(invalidJson.success, false);
  console.log("✓ handleWebRequestAccess rejected malformed email address with 400");

  // Test 6: handleWebRequestAccess valid request
  const validReq = new Request("https://access.example.com/api/request-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "newcook@yellowrosebbq.com", name: "Chef Dan" })
  });
  const validRes = await handleWebRequestAccess(validReq, { TELEGRAM_BOT_TOKEN: "", TELEGRAM_ADMIN_IDS: "" });
  assert.strictEqual(validRes.status, 200);
  const validJson = await validRes.json();
  assert.strictEqual(validJson.success, true);
  assert.strictEqual(validJson.email, "newcook@yellowrosebbq.com");
  console.log("✓ handleWebRequestAccess processed valid access request successfully");

  console.log("\nAll 6 unit tests passed successfully! 🎉");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
