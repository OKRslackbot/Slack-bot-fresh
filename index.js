require('dotenv').config();

const { App } = require('@slack/bolt');

// Add safety net to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Something went wrong:', error);
  // But keep the bot running!
});

process.on('unhandledRejection', (error) => {
  console.error('Promise error:', error);
  // But keep the bot running!
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  // Add extra logging
  logLevel: 'debug'
});

// ===== DEBUG LOGGING MIDDLEWARE =====
// Log all incoming events
app.use(async ({ payload, next }) => {
  console.log('📥 Incoming event type:', payload.type);
  if (payload.action_id) {
    console.log('🔘 Action ID:', payload.action_id);
  }
  if (payload.callback_id) {
    console.log('📋 Callback ID:', payload.callback_id);
  }
  await next();
});

// Simple in-memory storage
let objectives = [];
let keyResults = [];
let objCounter = 1;
let krCounter = 1;

// Helper function to send messages with accessibility text
function sendMessage(client, channel, blocks, fallbackText) {
  return client.chat.postMessage({
    channel: channel,
    text: fallbackText,
    blocks: blocks
  });
}

// === MAIN MENU COMMAND ===

app.command('/okr', async ({ command, ack, client }) => {
  console.log('🎯 /okr command received from user:', command.user_id);
  await ack();

  try {
    console.log('📝 Opening main menu modal...');
    const result = await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'main_menu',
        title: { type: 'plain_text', text: '🎯 OKR Manager' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Welcome to OKR Manager!* 🚀\n\nWhat would you like to do?' }
          },
          { type: 'divider' },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: '🎯 Create Objective' },
                action_id: 'create_objective',
                style: 'primary'
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: '🔑 Create Key Result' },
                action_id: 'create_key_result'
              }
            ]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: '📈 Update Progress' },
                action_id: 'update_progress'
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: '📋 View All OKRs' },
                action_id: 'view_okrs'
              }
            ]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: '📊 Generate Report' },
                action_id: 'generate_report'
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: '🗑️ Delete OKR' },
                action_id: 'delete_okr',
                style: 'danger'
              }
            ]
          }
        ]
      }
    });
    console.log('✅ Main menu opened successfully!', result.ok);
  } catch (error) {
    console.error('❌ Error opening main menu:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    await client.chat.postMessage({
      channel: command.user_id,
      text: '❌ Error opening OKR menu. Please try again.'
    });
  }
});

// === CREATE OBJECTIVE MODAL ===

app.action('create_objective', async ({ ack, body, client }) => {
  console.log('🎯 CREATE OBJECTIVE CLICKED!');
  console.log('User:', body.user.id);
  
  await ack();
  console.log('✅ Acknowledged create_objective action');

  try {
    console.log('📝 Attempting to open modal...');
    console.log('Trigger ID:', body.trigger_id);
    console.log('objCounter value:', objCounter);
    
    const viewPayload = {
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'create_objective_modal',
        title: { type: 'plain_text', text: '🎯 Create Objective' },
        submit: { type: 'plain_text', text: 'Create' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Creating Objective OBJ${objCounter}*` }
          },
          {
            type: 'input',
            block_id: 'objective_title',
            element: {
              type: 'plain_text_input',
              action_id: 'title',
              placeholder: { type: 'plain_text', text: 'e.g., Increase Q3 Revenue' },
              max_length: 200
            },
            label: { type: 'plain_text', text: 'Objective Title' }
          },
          {
            type: 'input',
            block_id: 'objective_description',
            element: {
              type: 'plain_text_input',
              action_id: 'description',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'Optional: Add more details about this objective...' },
              max_length: 500
            },
            label: { type: 'plain_text', text: 'Description (Optional)' },
            optional: true
          },
          {
            type: 'input',
            block_id: 'objective_owner',
            element: {
              type: 'users_select',
              action_id: 'owner',
              placeholder: { type: 'plain_text', text: 'Select objective owner' }
            },
            label: { type: 'plain_text', text: 'Assign to' }
          }
        ]
      }
    };
    
    console.log('📤 Sending view.open request to Slack...');
    const result = await client.views.open(viewPayload);
    
    console.log('✅ Modal open result:', result.ok);
    if (!result.ok) {
      console.error('❌ Modal failed to open. Error:', result.error);
    } else {
      console.log('✅ Modal should be visible now!');
    }
    
  } catch (error) {
    console.error('❌ Error opening create objective modal:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    console.error('Error stack:', error.stack);
    
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: `❌ Error opening form: ${error.message}. Please try again.`
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// Handle objective creation submission
app.view('create_objective_modal', async ({ ack, body, view, client }) => {
  console.log('📋 CREATE OBJECTIVE FORM SUBMITTED!');
  await ack();

  try {
    const values = view.state.values;
    console.log('Form values:', JSON.stringify(values, null, 2));
    
    const title = values.objective_title.title.value;
    const description = values.objective_description?.description?.value || '';
    const owner = values.objective_owner.owner.selected_user;

    const objId = `OBJ${objCounter++}`;
    const objective = {
      id: objId,
      title: title,
      description: description,
      assignee: owner,
      progress: 0,
      keyResults: [],
      createdAt: new Date()
    };

    objectives.push(objective);
    console.log('✅ Objective created:', objId);

    // Send success message
    await sendMessage(client, body.user.id, [
      {
        type: 'section',
        text: { 
          type: 'mrkdwn', 
          text: `✅ *Objective Created Successfully!*\n\n🎯 *${objId}:* ${title}\n👤 *Owner:* <@${owner}>\n📊 *Progress:* 0%` 
        }
      },
      {
        type: 'section',
        text: { 
          type: 'mrkdwn', 
          text: `💡 *Next step:* Add key results to measure progress toward this objective.` 
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: '🔑 Add Key Result' },
          action_id: 'create_key_result',
          value: objId
        }
      }
    ], `Objective Created: ${title}`);

  } catch (error) {
    console.error('❌ Error creating objective:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error creating objective. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// === CREATE KEY RESULT MODAL ===

app.action('create_key_result', async ({ ack, body, client }) => {
  console.log('🔑 CREATE KEY RESULT CLICKED!');
  await ack();
  console.log('✅ Acknowledged create_key_result action');

  try {
    // Build options for objective selection
    const objectiveOptions = objectives.map(obj => ({
      text: { type: 'plain_text', text: `${obj.id}: ${obj.title}` },
      value: obj.id
    }));

    if (objectiveOptions.length === 0) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ No objectives found. Please create an objective first using `/okr`.'
      });
      return;
    }

    console.log('📝 Opening key result modal...');
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'create_key_result_modal',
        title: { type: 'plain_text', text: '🔑 Create Key Result' },
        submit: { type: 'plain_text', text: 'Create' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Creating Key Result KR${krCounter}*` }
          },
          {
            type: 'input',
            block_id: 'kr_objective',
            element: {
              type: 'static_select',
              action_id: 'objective',
              placeholder: { type: 'plain_text', text: 'Select objective' },
              options: objectiveOptions,
              initial_option: body.actions?.[0]?.value ? 
                objectiveOptions.find(opt => opt.value === body.actions[0].value) : 
                objectiveOptions[0]
            },
            label: { type: 'plain_text', text: 'Link to Objective' }
          },
          {
            type: 'input',
            block_id: 'kr_title',
            element: {
              type: 'plain_text_input',
              action_id: 'title',
              placeholder: { type: 'plain_text', text: 'e.g., Get 10 new customers' },
              max_length: 200
            },
            label: { type: 'plain_text', text: 'Key Result Description' }
          },
          {
            type: 'input',
            block_id: 'kr_owner',
            element: {
              type: 'users_select',
              action_id: 'owner',
              placeholder: { type: 'plain_text', text: 'Select key result owner' }
            },
            label: { type: 'plain_text', text: 'Assign to' }
          }
        ]
      }
    });
    console.log('✅ Key result modal opened');
  } catch (error) {
    console.error('❌ Error opening create key result modal:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error opening form. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// Handle key result creation submission
app.view('create_key_result_modal', async ({ ack, body, view, client }) => {
  console.log('📋 CREATE KEY RESULT FORM SUBMITTED!');
  await ack();

  try {
    const values = view.state.values;
    const objId = values.kr_objective.objective.selected_option.value;
    const title = values.kr_title.title.value;
    const owner = values.kr_owner.owner.selected_user;

    const objective = objectives.find(obj => obj.id === objId);
    if (!objective) {
      throw new Error('Objective not found');
    }

    const krId = `KR${krCounter++}`;
    const keyResult = {
      id: krId,
      objectiveId: objId,
      text: title,
      assignee: owner,
      progress: 0,
      createdAt: new Date()
    };

    keyResults.push(keyResult);
    console.log('✅ Key result created:', krId);

    // Send success message
    await sendMessage(client, body.user.id, [
      {
        type: 'section',
        text: { 
          type: 'mrkdwn', 
          text: `✅ *Key Result Created Successfully!*\n\n🔑 *${krId}:* ${title}\n🎯 *For:* ${objId} - ${objective.title}\n👤 *Owner:* <@${owner}>\n📊 *Progress:* 0%` 
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '📈 Update Progress' },
            action_id: 'update_kr_progress',
            value: krId
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔑 Add Another KR' },
            action_id: 'create_key_result',
            value: objId
          }
        ]
      }
    ], `Key Result Created: ${title}`);

  } catch (error) {
    console.error('❌ Error creating key result:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error creating key result. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// === UPDATE PROGRESS MODAL ===

app.action('update_progress', async ({ ack, body, client }) => {
  console.log('📈 UPDATE PROGRESS CLICKED!');
  await ack();

  try {
    // Build options for all objectives and key results
    const allItems = [];
    
    objectives.forEach(obj => {
      allItems.push({
        text: { type: 'plain_text', text: `🎯 ${obj.id}: ${obj.title} (${obj.progress}%)` },
        value: `obj_${obj.id}`
      });
    });

    keyResults.forEach(kr => {
      allItems.push({
        text: { type: 'plain_text', text: `🔑 ${kr.id}: ${kr.text} (${kr.progress}%)` },
        value: `kr_${kr.id}`
      });
    });

    if (allItems.length === 0) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ No OKRs found. Please create some objectives and key results first using `/okr`.'
      });
      return;
    }

    console.log('📝 Opening update progress modal...');
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'update_progress_modal',
        title: { type: 'plain_text', text: '📈 Update Progress' },
        submit: { type: 'plain_text', text: 'Update' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Update progress for any objective or key result:*' }
          },
          {
            type: 'input',
            block_id: 'progress_item',
            element: {
              type: 'static_select',
              action_id: 'item',
              placeholder: { type: 'plain_text', text: 'Select objective or key result' },
              options: allItems
            },
            label: { type: 'plain_text', text: 'Select Item to Update' }
          },
          {
            type: 'input',
            block_id: 'progress_value',
            element: {
              type: 'number_input',
              action_id: 'value',
              is_decimal_allowed: false,
              min_value: '0',
              max_value: '100',
              placeholder: { type: 'plain_text', text: 'Enter percentage (0-100)' }
            },
            label: { type: 'plain_text', text: 'Progress Percentage' }
          }
        ]
      }
    });
    console.log('✅ Update progress modal opened');
  } catch (error) {
    console.error('❌ Error opening update progress modal:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error opening form. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// Handle progress update submission
app.view('update_progress_modal', async ({ ack, body, view, client }) => {
  console.log('📋 UPDATE PROGRESS FORM SUBMITTED!');
  await ack();

  try {
    const values = view.state.values;
    const selectedItem = values.progress_item.item.selected_option.value;
    const newProgress = parseInt(values.progress_value.value.value);

    const [type, id] = selectedItem.split('_');

    if (type === 'obj') {
      // Update objective
      const objective = objectives.find(obj => obj.id === id);
      if (objective) {
        const oldProgress = objective.progress;
        objective.progress = newProgress;

        const progressEmoji = newProgress >= 75 ? '🟢' : newProgress >= 50 ? '🟡' : '🔴';
        const changeEmoji = newProgress > oldProgress ? '📈' : newProgress < oldProgress ? '📉' : '➡️';

        await client.chat.postMessage({
          channel: body.user.id,
          text: `${changeEmoji} Objective Updated! ${id}: ${objective.title} - Progress: ${oldProgress}% → ${newProgress}% ${progressEmoji}`
        });
      }
    } else if (type === 'kr') {
      // Update key result
      const keyResult = keyResults.find(kr => kr.id === id);
      if (keyResult) {
        const oldProgress = keyResult.progress;
        keyResult.progress = newProgress;

        // Update related objective progress
        const relatedKRs = keyResults.filter(kr => kr.objectiveId === keyResult.objectiveId);
        const avgProgress = Math.round(relatedKRs.reduce((sum, kr) => sum + kr.progress, 0) / relatedKRs.length);
        
        const objective = objectives.find(obj => obj.id === keyResult.objectiveId);
        if (objective) {
          objective.progress = avgProgress;
        }

        const progressEmoji = newProgress >= 75 ? '🟢' : newProgress >= 50 ? '🟡' : '🔴';
        const changeEmoji = newProgress > oldProgress ? '📈' : newProgress < oldProgress ? '📉' : '➡️';

        await client.chat.postMessage({
          channel: body.user.id,
          text: `${changeEmoji} Key Result Updated! ${id}: ${keyResult.text} - Progress: ${oldProgress}% → ${newProgress}% ${progressEmoji}\nObjective ${keyResult.objectiveId} now at: ${avgProgress}%`
        });
      }
    }

  } catch (error) {
    console.error('❌ Error updating progress:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error updating progress. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// === VIEW OKRS ACTION ===

app.action('view_okrs', async ({ ack, body, client }) => {
  console.log('📋 VIEW OKRS CLICKED!');
  await ack();

  try {
    if (objectives.length === 0) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '📭 No objectives found yet. Use `/okr` to create your first objective!'
      });
      return;
    }

    let blocks = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*📋 All Objectives & Key Results*' }
      },
      { type: 'divider' }
    ];

    objectives.forEach(obj => {
      const progressEmoji = obj.progress >= 75 ? '🟢' : obj.progress >= 50 ? '🟡' : '🔴';
      const objKRs = keyResults.filter(kr => kr.objectiveId === obj.id);

      blocks.push({
        type: 'section',
        text: { 
          type: 'mrkdwn', 
          text: `${progressEmoji} *${obj.id}: ${obj.title}* (${obj.progress}%)\n👤 <@${obj.assignee}> | 🔑 ${objKRs.length} key results` 
        }
      });

      objKRs.forEach(kr => {
        const krProgressEmoji = kr.progress >= 75 ? '🟢' : kr.progress >= 50 ? '🟡' : '🔴';
        blocks.push({
          type: 'section',
          text: { 
            type: 'mrkdwn', 
            text: `   ${krProgressEmoji} *${kr.id}:* ${kr.text} (${kr.progress}%) - <@${kr.assignee}>` 
          }
        });
      });

      blocks.push({ type: 'divider' });
    });

    await sendMessage(client, body.user.id, blocks, 'All Objectives & Key Results');

  } catch (error) {
    console.error('❌ Error viewing OKRs:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error viewing OKRs. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// === GENERATE REPORT ACTION ===

app.action('generate_report', async ({ ack, body, client }) => {
  console.log('📊 GENERATE REPORT CLICKED!');
  await ack();

  try {
    if (objectives.length === 0) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '📊 No OKRs to report on yet. Create some objectives first!'
      });
      return;
    }

    const totalObjs = objectives.length;
    const totalKRs = keyResults.length;
    const avgObjProgress = Math.round(objectives.reduce((sum, obj) => sum + obj.progress, 0) / totalObjs);
    const avgKRProgress = Math.round(keyResults.reduce((sum, kr) => sum + kr.progress, 0) / (totalKRs || 1));

    let reportBlocks = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*📊 OKR REPORT*\n📅 ${new Date().toLocaleDateString()}` }
      },
      { type: 'divider' },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*📈 Summary:*\n• ${totalObjs} objectives\n• ${totalKRs} key results` },
          { type: 'mrkdwn', text: `*📊 Progress:*\n• Avg Objective: ${avgObjProgress}%\n• Avg Key Result: ${avgKRProgress}%` }
        ]
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*🎯 Objectives:*' }
      }
    ];

    objectives.slice(0, 5).forEach(obj => {
      const progressEmoji = obj.progress >= 75 ? '🟢' : obj.progress >= 50 ? '🟡' : '🔴';
      const krCount = keyResults.filter(kr => kr.objectiveId === obj.id).length;
      reportBlocks.push({
        type: 'section',
        text: { 
          type: 'mrkdwn', 
          text: `${progressEmoji} *${obj.id}:* ${obj.title} (${obj.progress}%) - <@${obj.assignee}> - ${krCount} KRs` 
        }
      });
    });

    await sendMessage(client, body.user.id, reportBlocks, `OKR Report - ${totalObjs} objectives, ${totalKRs} key results`);

  } catch (error) {
    console.error('❌ Error generating report:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error generating report. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// === DELETE OKR MODAL ===

app.action('delete_okr', async ({ ack, body, client }) => {
  console.log('🗑️ DELETE OKR CLICKED!');
  await ack();

  try {
    const allItems = [];
    
    objectives.forEach(obj => {
      allItems.push({
        text: { type: 'plain_text', text: `🎯 ${obj.id}: ${obj.title}` },
        value: `obj_${obj.id}`
      });
    });

    keyResults.forEach(kr => {
      allItems.push({
        text: { type: 'plain_text', text: `🔑 ${kr.id}: ${kr.text}` },
        value: `kr_${kr.id}`
      });
    });

    if (allItems.length === 0) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ No OKRs found to delete.'
      });
      return;
    }

    console.log('📝 Opening delete OKR modal...');
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'delete_okr_modal',
        title: { type: 'plain_text', text: '🗑️ Delete OKR' },
        submit: { type: 'plain_text', text: 'Delete' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*⚠️ Warning: This action cannot be undone!*' }
          },
          {
            type: 'input',
            block_id: 'delete_item',
            element: {
              type: 'static_select',
              action_id: 'item',
              placeholder: { type: 'plain_text', text: 'Select item to delete' },
              options: allItems
            },
            label: { type: 'plain_text', text: 'Select OKR to Delete' }
          }
        ]
      }
    });
    console.log('✅ Delete OKR modal opened');
  } catch (error) {
    console.error('❌ Error opening delete modal:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error opening form. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// Handle delete submission
app.view('delete_okr_modal', async ({ ack, body, view, client }) => {
  console.log('📋 DELETE OKR FORM SUBMITTED!');
  await ack();

  try {
    const values = view.state.values;
    const selectedItem = values.delete_item.item.selected_option.value;
    const [type, id] = selectedItem.split('_');

    if (type === 'obj') {
      // Delete objective and related key results
      const objective = objectives.find(obj => obj.id === id);
      const relatedKRs = keyResults.filter(kr => kr.objectiveId === id);
      
      objectives = objectives.filter(obj => obj.id !== id);
      keyResults = keyResults.filter(kr => kr.objectiveId !== id);

      await client.chat.postMessage({
        channel: body.user.id,
        text: `✅ Objective Deleted! Deleted: "${objective.title}" and ${relatedKRs.length} related key results`
      });
    } else if (type === 'kr') {
      // Delete key result
      const keyResult = keyResults.find(kr => kr.id === id);
      keyResults = keyResults.filter(kr => kr.id !== id);

      // Update related objective progress
      const relatedKRs = keyResults.filter(kr => kr.objectiveId === keyResult.objectiveId);
      if (relatedKRs.length > 0) {
        const avgProgress = Math.round(relatedKRs.reduce((sum, kr) => sum + kr.progress, 0) / relatedKRs.length);
        const objective = objectives.find(obj => obj.id === keyResult.objectiveId);
        if (objective) {
          objective.progress = avgProgress;
        }
      }

      await client.chat.postMessage({
        channel: body.user.id,
        text: `✅ Key Result Deleted! Deleted: "${keyResult.text}"`
      });
    }

  } catch (error) {
    console.error('❌ Error deleting OKR:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error deleting OKR. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// === QUICK UPDATE ACTIONS ===

app.action('update_kr_progress', async ({ ack, body, client }) => {
  console.log('📈 UPDATE KR PROGRESS CLICKED!');
  await ack();

  try {
    const krId = body.actions[0].value;
    const keyResult = keyResults.find(kr => kr.id === krId);

    if (!keyResult) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Key result not found.'
      });
      return;
    }

    console.log('📝 Opening quick update modal...');
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'quick_update_kr_modal',
        title: { type: 'plain_text', text: '📈 Quick Update' },
        submit: { type: 'plain_text', text: 'Update' },
        close: { type: 'plain_text', text: 'Cancel' },
        private_metadata: krId,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Updating: ${krId}*\n${keyResult.text}\n\nCurrent Progress: ${keyResult.progress}%` }
          },
          {
            type: 'input',
            block_id: 'quick_progress',
            element: {
              type: 'number_input',
              action_id: 'value',
              is_decimal_allowed: false,
              min_value: '0',
              max_value: '100',
              initial_value: keyResult.progress.toString(),
              placeholder: { type: 'plain_text', text: 'Enter new percentage' }
            },
            label: { type: 'plain_text', text: 'Progress Percentage' }
          }
        ]
      }
    });
    console.log('✅ Quick update modal opened');
  } catch (error) {
    console.error('❌ Error opening quick update modal:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error opening form. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

app.view('quick_update_kr_modal', async ({ ack, body, view, client }) => {
  console.log('📋 QUICK UPDATE KR FORM SUBMITTED!');
  await ack();

  try {
    const krId = view.private_metadata;
    const newProgress = parseInt(view.state.values.quick_progress.value.value);

    const keyResult = keyResults.find(kr => kr.id === krId);
    if (keyResult) {
      const oldProgress = keyResult.progress;
      keyResult.progress = newProgress;

      // Update related objective progress
      const relatedKRs = keyResults.filter(kr => kr.objectiveId === keyResult.objectiveId);
      const avgProgress = Math.round(relatedKRs.reduce((sum, kr) => sum + kr.progress, 0) / relatedKRs.length);
      
      const objective = objectives.find(obj => obj.id === keyResult.objectiveId);
      if (objective) {
        objective.progress = avgProgress;
      }

      const progressEmoji = newProgress >= 75 ? '🟢' : newProgress >= 50 ? '🟡' : '🔴';
      const changeEmoji = newProgress > oldProgress ? '📈' : newProgress < oldProgress ? '📉' : '➡️';

      await client.chat.postMessage({
        channel: body.user.id,
        text: `${changeEmoji} Quick Update Complete! ${krId}: ${keyResult.text} - Progress: ${oldProgress}% → ${newProgress}% ${progressEmoji}\nObjective ${keyResult.objectiveId} now at: ${avgProgress}%`
      });
    }

  } catch (error) {
    console.error('❌ Error in quick update:', error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Error updating progress. Please try again.'
      });
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// === LEGACY COMMANDS FOR BACKWARDS COMPATIBILITY ===

app.command('/okr-help', async ({ command, ack, say }) => {
  console.log('ℹ️ /okr-help command received');
  await ack();
  
  try {
    const helpText = `🤖 *OKR Bot - Easy Forms Interface!*

*🎯 Main Command:*
• \`/okr\` - Opens the main OKR manager with easy-to-use forms

*📋 Quick Commands:*
• \`/okr-report\` - Generate team report
• \`/hello\` - Test bot connection
• \`/okr-help\` - Show this help

*🚀 Pro Tip:* Use \`/okr\` for everything! It gives you beautiful forms instead of typing complex commands.

Try \`/okr\` now! 👆`;
    
    await say(helpText);
  } catch (error) {
    console.error('Error in help command:', error);
  }
});

app.command('/hello', async ({ command, ack, say }) => {
  console.log('👋 /hello command received');
  await ack();
  
  try {
    await say('Hello! 👋 OKR Bot with easy forms is running! Use `/okr` to get started with the main menu.');
  } catch (error) {
    console.error('Error in hello command:', error);
  }
});

app.command('/okr-report', async ({ command, ack, client }) => {
  console.log('📊 /okr-report command received');
  await ack();
  
  try {
    // Generate quick report
    if (objectives.length === 0) {
      await client.chat.postMessage({
        channel: command.user_id,
        text: '📊 No OKRs to report on yet. Use `/okr` to create some objectives first!'
      });
      return;
    }

    const totalObjs = objectives.length;
    const totalKRs = keyResults.length;
    const avgObjProgress = Math.round(objectives.reduce((sum, obj) => sum + obj.progress, 0) / totalObjs);

    let reportText = `📊 OKR REPORT\n📅 ${new Date().toLocaleDateString()}\n\n`;
    reportText += `📈 Summary: ${totalObjs} objectives, ${totalKRs} key results\n`;
    reportText += `📊 Average Progress: ${avgObjProgress}%\n\n`;
    reportText += `🎯 Objectives:\n`;

    objectives.slice(0, 5).forEach(obj => {
      const progressEmoji = obj.progress >= 75 ? '🟢' : obj.progress >= 50 ? '🟡' : '🔴';
      reportText += `${progressEmoji} ${obj.id}: ${obj.title} (${obj.progress}%)\n`;
    });

    await client.chat.postMessage({
      channel: command.user_id,
      text: reportText
    });
  } catch (error) {
    console.error('Error in report command:', error);
  }
});

// Error handling
app.error((error) => {
  console.error('🚨 Slack app error:', error);
  console.error('Error details:', {
    code: error.code,
    data: error.data,
    stack: error.stack
  });
  // Don't crash, just log the error
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📛 SIGTERM signal received: closing bot gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT signal received: closing bot gracefully');
  process.exit(0);
});

// === DEBUG: Log all event types we're receiving ===
console.log('🔍 Setting up debug event listeners...');

// Start the app
(async () => {
  try {
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log('⚡️ Complete OKR Bot with Modals is running!');
    console.log('🎯 Main command: /okr');
    console.log('📊 Current data: 0 objectives, 0 key results');
    console.log('✅ All error handling in place!');
    console.log('🔍 Debug logging enabled!');
    console.log('');
    console.log('📝 Watching for events...');
  } catch (error) {
    console.error('💥 Failed to start bot:', error);
    process.exit(1);
  }
})();