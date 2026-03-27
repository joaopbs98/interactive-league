// League Setup Script
// This script will automatically generate league players and starter squads

const BASE_URL = 'http://localhost:3000'; // Change this to your app URL

async function setupLeague(leagueId) {
  console.log('🚀 Starting league setup for:', leagueId);
  
  try {
    // Step 1: Generate League Players
    console.log('📝 Step 1: Generating league players...');
    const generateResponse = await fetch(`${BASE_URL}/api/league/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_players',
        leagueId: leagueId,
        playerCount: 1000
      })
    });

    if (!generateResponse.ok) {
      const error = await generateResponse.json();
      throw new Error(`Failed to generate players: ${error.error}`);
    }
    console.log('✅ League players generated successfully!');

    // Step 2: Get all teams in the league
    console.log('📋 Step 2: Fetching teams...');
    const teamsResponse = await fetch(`${BASE_URL}/api/league/teams?leagueId=${leagueId}`);
    if (!teamsResponse.ok) {
      throw new Error('Failed to fetch teams');
    }
    
    const teamsData = await teamsResponse.json();
    const teams = teamsData.data || [];
    console.log(`✅ Found ${teams.length} teams in the league`);

    if (teams.length === 0) {
      console.log('⚠️  No teams found in this league');
      return;
    }

    // Step 3: Generate starter squads for each team
    console.log('⚽ Step 3: Generating starter squads...');
    let successCount = 0;
    
    for (const team of teams) {
      try {
        console.log(`   Generating squad for ${team.name}...`);
        const squadResponse = await fetch(`${BASE_URL}/api/league/players`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_starter_squad',
            leagueId: leagueId,
            teamId: team.id
          })
        });

        if (squadResponse.ok) {
          successCount++;
          console.log(`   ✅ Squad generated for ${team.name}`);
        } else {
          const error = await squadResponse.json();
          console.log(`   ❌ Failed to generate squad for ${team.name}: ${error.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Error generating squad for ${team.name}: ${error.message}`);
      }
    }

    console.log(`🎉 Setup complete! Successfully generated squads for ${successCount} out of ${teams.length} teams`);
    console.log('\n📋 Next steps:');
    console.log('1. Go to your league dashboard');
    console.log('2. Check the injuries page - player dropdown should now be populated');
    console.log('3. Check team management - should show different players for each team');
    console.log('4. Players should have ratings 40-60 (not all 60)');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your app is running on http://localhost:3000');
    console.log('2. Make sure you\'re logged in and have access to the league');
    console.log('3. Check the browser console for any errors');
  }
}

// Usage instructions
console.log('📖 League Setup Script');
console.log('=====================');
console.log('');
console.log('To use this script:');
console.log('1. Make sure your app is running (npm run dev)');
console.log('2. Replace YOUR_LEAGUE_ID with your actual league ID');
console.log('3. Run: node setup-league-script.js');
console.log('');
console.log('Example:');
console.log('setupLeague("your-league-id-here");');
console.log('');

// Uncomment and replace with your league ID to run automatically
// setupLeague("YOUR_LEAGUE_ID_HERE");

module.exports = { setupLeague }; 