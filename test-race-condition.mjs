// test-race-condition.mjs
const BASE_URL = "http://localhost:3000";

async function runRaceConditionTest() {
  console.log("⚡ Starting High-Concurrency Stress Test (10 Simultaneous Requests)...");

  // 1. Database එකෙන් 'AC 106' කාමරයේ ID එක ලබාගැනීම
  const roomsRes = await fetch(`${BASE_URL}/api/test-connection`);
  
  // AC 106 සඳහා කෙලින්ම request එකක් යවමු
  // Supabase වෙතින් AC 106 හි UUID එක ලබාගැනීම සඳහා test payload එකක්
  // කරුණාකර ඔබගේ Supabase rooms table එකෙන් AC 106 හි ID (UUID) එක මෙතැනට ලබාදෙන්න:
  const ROOM_CODE = "AC 106";

  // කණ්ඩායම් 10ක නම් ලැයිස්තුවක්
  const teams = Array.from({ length: 10 }, (_, i) => ({
    team_name: `Aquatic Tigers Club #${i + 1}`,
    manager_name: `Manager ${i + 1}`,
    manager_email: `manager${i + 1}@tigers.com`,
    manager_phone: `+6681000000${i}`,
    idempotency_key: `stress-test-uuid-${i}-${Date.now()}`
  }));

  console.log(`🎯 Targeting Room: ${ROOM_CODE}`);
  console.log(`🚀 Firing 10 parallel booking requests at the EXACT SAME millisecond...`);

  // එකම මොහොතේ 10 දෙනාම request එක යවන මොහොත (Promise.all)
  const results = await Promise.all(
    teams.map(async (team) => {
      const startTime = performance.now();
      try {
        const res = await fetch(`${BASE_URL}/api/book-room`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: "ab31776a-6b15-4985-818e-ccb3e1097023", // පහත පියවරේදී මෙය යොදමු
            room_code: ROOM_CODE,
            ...team
          })
        });
        const duration = (performance.now() - startTime).toFixed(1);
        const json = await res.json();
        return { status: res.status, success: json.success, message: json.message, duration: `${duration}ms` };
      } catch (err) {
        return { error: err.message };
      }
    })
  );

  console.log("\n📊 --- RESULTS BREAKDOWN ---");
  console.table(results);

  const successfulBookings = results.filter(r => r.status === 200 && r.success);
  const rejectedBookings = results.filter(r => r.status === 409 || !r.success);

  console.log(`\n🏆 Winner (Allocated): ${successfulBookings.length} team(s)`);
  console.log(`🛡️ Rejected (Protected): ${rejectedBookings.length} team(s)`);

  if (successfulBookings.length === 1 && rejectedBookings.length === 9) {
    console.log("✅ ZERO DOUBLE-BOOKING GUARANTEE PASSED 100%!");
  } else {
    console.log("❌ CONCURRENCY FAILED: Double-booking detected!");
  }
}

runRaceConditionTest();