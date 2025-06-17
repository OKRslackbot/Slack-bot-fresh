require('dotenv').config();
console.log('🔍 Environment loaded:', {
  botToken: process.env.SLACK_BOT_TOKEN ? 'SET' : 'MISSING',
  appToken: process.env.SLACK_APP_TOKEN ? 'SET' : 'MISSING',
  signingSecret: process.env.SLACK_SIGNING_SECRET ? 'SET' : 'MISSING'
});
const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Simple in-memory storage
let objectives = [];
let keyResults = [];
let objCounter = 1;
let krCounter = 1;

// Helper function to get user from command
function getUser(command) {
  return command.user_name || command.user_id;
}

// === SIMPLIFIED OBJECTIVE COMMANDS ===

// Create Objective: /create-obj "Increase Sales" @john
app.command('/create-obj', async ({ command, ack, say }) => {
  await ack();

  try {
    const text = command.text.trim();
    
    // Parse: "Title" @user or just "Title"
    const match = text.match(/^"([^"]+)"(?:\s+@?(\w+))?/);
    
    if (!match) {
      await say(`❌ **Usage:** \`/create-obj "Title" [@user]\`
**Example:** \`/create-obj "Increase Sales" @john\``);
      return;
    }

    const title = match[1];
    const assignee = match[2] || getUser(command);
    const objId = `OBJ${objCounter++}`;

    const objective = {
      id: objId,
      title: title,
      assignee: assignee,
      progress: 0,
      keyResults: [],
      createdAt: new Date()
    };

    objectives.push(objective);

    await say(`✅ **Objective Created!**
🎯 **${objId}:** ${title}
👤 **Assigned to:** @${assignee}
📊 **Progress:** 0%

💡 Add key results with: \`/kr-create ${objId} "key result text" [@user]\``);

  } catch (error) {
    console.error('Error creating objective:', error);
    await say('❌ Error creating objective. Please try again.');
  }
});

// List Objectives: /obj-list or /obj-list @user
app.command('/obj-list', async ({ command, ack, say }) => {
  await ack();

  try {
    const filterUser = command.text.trim().replace('@', '');
    
    let filteredObjectives = objectives;
    if (filterUser) {
      filteredObjectives = objectives.filter(obj => obj.assignee === filterUser);
    }

    if (filteredObjectives.length === 0) {
      await say(filterUser ? 
        `📭 No objectives found for @${filterUser}` : 
        '📭 No objectives created yet. Use `/create-obj "Title" @user` to create one.');
      return;
    }

    let response = `📋 **OBJECTIVES**${filterUser ? ` - @${filterUser}` : ''}\n\n`;

    filteredObjectives.forEach(obj => {
      const progressEmoji = obj.progress >= 75 ? '🟢' : obj.progress >= 50 ? '🟡' : '🔴';
      const krCount = keyResults.filter(kr => kr.objectiveId === obj.id).length;
      
      response += `${progressEmoji} **${obj.id}:** ${obj.title} (${obj.progress}%)\n`;
      response += `   👤 @${obj.assignee} | 🔑 ${krCount} key results\n\n`;
    });

    response += `💡 Use \`/kr-list OBJ1\` to see key results or \`/update-obj OBJ1 75\` to update progress.`;

    await say(response);

  } catch (error) {
    console.error('Error listing objectives:', error);
    await say('❌ Error listing objectives.');
  }
});

// Update Objective Progress: /update-obj OBJ1 75
app.command('/update-obj', async ({ command, ack, say }) => {
  await ack();

  try {
    const args = command.text.trim().split(' ');
    const objId = args[0];
    const progress = parseInt(args[1]);

    if (!objId || isNaN(progress)) {
      await say(`❌ **Usage:** \`/update-obj OBJ1 75\`
**Example:** \`/update-obj OBJ1 80\` (sets progress to 80%)`);
      return;
    }

    const objective = objectives.find(obj => obj.id === objId);
    if (!objective) {
      await say(`❌ Objective ${objId} not found. Use \`/obj-list\` to see available objectives.`);
      return;
    }

    const oldProgress = objective.progress;
    objective.progress = Math.max(0, Math.min(100, progress));

    const progressEmoji = objective.progress >= 75 ? '🟢' : objective.progress >= 50 ? '🟡' : '🔴';
    const changeEmoji = objective.progress > oldProgress ? '📈' : objective.progress < oldProgress ? '📉' : '➡️';

    await say(`${changeEmoji} **Progress Updated!**
🎯 **${objId}:** ${objective.title}
📊 **Progress:** ${oldProgress}% → ${objective.progress}% ${progressEmoji}
👤 **Owner:** @${objective.assignee}`);

  } catch (error) {
    console.error('Error updating objective:', error);
    await say('❌ Error updating objective.');
  }
});

// === SIMPLIFIED KEY RESULT COMMANDS ===

// Create Key Result: /kr-create OBJ1 "Increase monthly sales" @jane
app.command('/kr-create', async ({ command, ack, say }) => {
  await ack();

  try {
    const text = command.text.trim();
    
    // Parse: OBJ1 "Text" @user or OBJ1 "Text"
    const match = text.match(/^(\w+)\s+"([^"]+)"(?:\s+@?(\w+))?/);
    
    if (!match) {
      await say(`❌ **Usage:** \`/kr-create OBJ1 "Key result text" [@user]\`
**Example:** \`/kr-create OBJ1 "Increase monthly sales" @jane\``);
      return;
    }

    const objId = match[1];
    const krText = match[2];
    const assignee = match[3] || getUser(command);

    const objective = objectives.find(obj => obj.id === objId);
    if (!objective) {
      await say(`❌ Objective ${objId} not found. Use \`/obj-list\` to see available objectives.`);
      return;
    }

    const krId = `KR${krCounter++}`;

    const keyResult = {
      id: krId,
      objectiveId: objId,
      text: krText,
      assignee: assignee,
      progress: 0,
      createdAt: new Date()
    };

    keyResults.push(keyResult);

    await say(`✅ **Key Result Created!**
🔑 **${krId}:** ${krText}
🎯 **For:** ${objId} - ${objective.title}
👤 **Assigned to:** @${assignee}
📊 **Progress:** 0%

💡 Update progress with: \`/update-kr ${krId} 50\``);

  } catch (error) {
    console.error('Error creating key result:', error);
    await say('❌ Error creating key result.');
  }
});

// List Key Results: /kr-list OBJ1 or /kr-list @user
app.command('/kr-list', async ({ command, ack, say }) => {
  await ack();

  try {
    const arg = command.text.trim().replace('@', '');
    
    let filteredKRs = keyResults;
    let title = 'KEY RESULTS';

    if (arg.startsWith('OBJ')) {
      // Filter by objective
      filteredKRs = keyResults.filter(kr => kr.objectiveId === arg);
      const obj = objectives.find(o => o.id === arg);
      title = obj ? `KEY RESULTS - ${arg}: ${obj.title}` : `KEY RESULTS - ${arg}`;
    } else if (arg) {
      // Filter by user
      filteredKRs = keyResults.filter(kr => kr.assignee === arg);
      title = `KEY RESULTS - @${arg}`;
    }

    if (filteredKRs.length === 0) {
      await say(`📭 No key results found. Use \`/kr-create OBJ1 "text" @user\` to create one.`);
      return;
    }

    let response = `🔑 **${title}**\n\n`;

    filteredKRs.forEach(kr => {
      const progressEmoji = kr.progress >= 75 ? '🟢' : kr.progress >= 50 ? '🟡' : '🔴';
      const obj = objectives.find(o => o.id === kr.objectiveId);
      
      response += `${progressEmoji} **${kr.id}:** ${kr.text} (${kr.progress}%)\n`;
      response += `   🎯 ${kr.objectiveId}${obj ? ` - ${obj.title}` : ''} | 👤 @${kr.assignee}\n\n`;
    });

    response += `💡 Update progress with: \`/update-kr KR1 75\``;

    await say(response);

  } catch (error) {
    console.error('Error listing key results:', error);
    await say('❌ Error listing key results.');
  }
});

// Update Key Result Progress: /update-kr KR1 60
app.command('/update-kr', async ({ command, ack, say }) => {
  await ack();

  try {
    const args = command.text.trim().split(' ');
    const krId = args[0];
    const progress = parseInt(args[1]);

    if (!krId || isNaN(progress)) {
      await say(`❌ **Usage:** \`/update-kr KR1 60\`
**Example:** \`/update-kr KR1 75\` (sets progress to 75%)`);
      return;
    }

    const keyResult = keyResults.find(kr => kr.id === krId);
    if (!keyResult) {
      await say(`❌ Key result ${krId} not found. Use \`/kr-list\` to see available key results.`);
      return;
    }

    const oldProgress = keyResult.progress;
    keyResult.progress = Math.max(0, Math.min(100, progress));

    // Update related objective progress
    const relatedKRs = keyResults.filter(kr => kr.objectiveId === keyResult.objectiveId);
    const avgProgress = Math.round(relatedKRs.reduce((sum, kr) => sum + kr.progress, 0) / relatedKRs.length);
    
    const objective = objectives.find(obj => obj.id === keyResult.objectiveId);
    if (objective) {
      objective.progress = avgProgress;
    }

    const progressEmoji = keyResult.progress >= 75 ? '🟢' : keyResult.progress >= 50 ? '🟡' : '🔴';
    const changeEmoji = keyResult.progress > oldProgress ? '📈' : keyResult.progress < oldProgress ? '📉' : '➡️';

    await say(`${changeEmoji} **Key Result Updated!**
🔑 **${krId}:** ${keyResult.text}
📊 **Progress:** ${oldProgress}% → ${keyResult.progress}% ${progressEmoji}
🎯 **Objective ${keyResult.objectiveId} now at:** ${avgProgress}%
👤 **Owner:** @${keyResult.assignee}`);

  } catch (error) {
    console.error('Error updating key result:', error);
    await say('❌ Error updating key result.');
  }
});

// === SIMPLE REPORTING ===

// Simple Report: /okr-report
app.command('/okr-report', async ({ command, ack, say }) => {
  await ack();

  try {
    if (objectives.length === 0) {
      await say('📊 No OKRs to report on yet. Create some objectives first!');
      return;
    }

    let response = `📊 **OKR REPORT**\n📅 ${new Date().toLocaleDateString()}\n\n`;

    // Summary
    const totalObjs = objectives.length;
    const totalKRs = keyResults.length;
    const avgObjProgress = Math.round(objectives.reduce((sum, obj) => sum + obj.progress, 0) / totalObjs);
    const avgKRProgress = Math.round(keyResults.reduce((sum, kr) => sum + kr.progress, 0) / (totalKRs || 1));

    response += `📈 **SUMMARY:**\n`;
    response += `• ${totalObjs} objectives, ${totalKRs} key results\n`;
    response += `• Average objective progress: ${avgObjProgress}%\n`;
    response += `• Average key result progress: ${avgKRProgress}%\n\n`;

    // Top objectives
    response += `🎯 **OBJECTIVES:**\n`;
    objectives.slice(0, 5).forEach(obj => {
      const progressEmoji = obj.progress >= 75 ? '🟢' : obj.progress >= 50 ? '🟡' : '🔴';
      const krCount = keyResults.filter(kr => kr.objectiveId === obj.id).length;
      response += `${progressEmoji} **${obj.id}:** ${obj.title} (${obj.progress}%) - @${obj.assignee} - ${krCount} KRs\n`;
    });

    await say(response);

  } catch (error) {
    console.error('Error generating report:', error);
    await say('❌ Error generating report.');
  }
});

// === HELP COMMAND ===

app.command('/okr-help', async ({ command, ack, say }) => {
  await ack();
  
  const helpText = `🤖 **Simple OKR Bot Help**

**📋 OBJECTIVES:**
• \`/create-obj "Title" [@user]\` - Create objective (auto-numbered OBJ1, OBJ2...)
• \`/obj-list [@user]\` - List objectives
• \`/update-obj OBJ1 75\` - Update objective progress (0-100%)

**🔑 KEY RESULTS:**
• \`/kr-create OBJ1 "Text" [@user]\` - Create key result (auto-numbered KR1, KR2...)
• \`/kr-list [OBJ1 or @user]\` - List key results
• \`/update-kr KR1 60\` - Update key result progress (0-100%)

**📊 REPORTING:**
• \`/okr-report\` - Generate simple report
• \`/okr-help\` - Show this help

**💡 Quick Start:**
1. \`/create-obj "Increase Sales" @john\` → Creates OBJ1
2. \`/kr-create OBJ1 "Get 10 new customers" @jane\` → Creates KR1
3. \`/update-kr KR1 50\` → Mark KR1 as 50% done
4. \`/obj-list\` → See all objectives

**No dates, no units, no complexity - just simple progress tracking!** 🎯`;
  
  await say(helpText);
});

// Test command
app.command('/hello', async ({ command, ack, say }) => {
  await ack();
  await say('Hello! 👋 Simple OKR Bot is running! Use `/okr-help` for commands.');
});

// Error handling
app.error((error) => {
  console.error('🚨 Slack app error:', error);
});

// Start the app
(async () => {
  try {
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log('⚡️ Simple OKR Bot is running!');
    console.log('📋 Commands: /okr-help');
  } catch (error) {
    console.error('💥 Failed to start bot:', error);
    process.exit(1);
  }
})();