require('dotenv').config();
const axios = require('axios');
const moment = require('moment');

async function getWeeklyMessageCounts(channelId, token, weeksToAnalyze = 2) {
  const weeklyCounts = [];
  const endDate = moment();
  
  for (let i = 0; i < weeksToAnalyze; i++) {
    // Calculate timestamps for this week
    const weekEnd = moment(endDate).subtract(7 * i, 'days');
    const weekStart = moment(weekEnd).subtract(7, 'days');
    const oldest = weekStart.unix();
    const latest = weekEnd.unix();
    
    let messageCount = 0;
    let hasMore = true;
    let cursor = null;
    
    // Handle pagination
    while (hasMore) {
      const params = {
        channel: channelId,
        oldest: oldest,
        latest: latest,
        limit: 1000
      };
      
      if (cursor) params.cursor = cursor;
      
      try {
        const response = await axios.get('https://slack.com/api/conversations.history', {
          params,
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = response.data;
        
        if (data.ok) {
          messageCount += data.messages.length;
          hasMore = data.has_more === true;
          cursor = data.response_metadata?.next_cursor;
        } else {
          console.error(`Error: ${data.error}`);
          hasMore = false;
        }
      } catch (error) {
        console.error(`API request failed: ${error.message}`);
        hasMore = false;
      }
    }
    
    weeklyCounts.push({
      Week: `${weekStart.format('YYYY-MM-DD')} to ${weekEnd.format('YYYY-MM-DD')}`,
      MessageCount: messageCount
    });
  }
  
  return weeklyCounts;
}

async function countMentions(channelId, token, targetId, weeksToAnalyze = 2) {
  const weeklyCounts = [];
  const endDate = moment();
  
  for (let i = 0; i < weeksToAnalyze; i++) {
    // Calculate start and end timestamps for this week
    const weekEnd = moment(endDate).subtract(7 * i, 'days');
    const weekStart = moment(weekEnd).subtract(7, 'days');
    
    // Convert to Unix timestamps
    const oldest = weekStart.unix();
    const latest = weekEnd.unix();
    
    let mentionCount = 0;
    let hasMore = true;
    let cursor = null;
    
    // Make API requests, handling pagination
    while (hasMore) {
      try {
        const params = {
          channel: channelId,
          oldest: oldest,
          latest: latest,
          limit: 1000
        };
        
        if (cursor) {
          params.cursor = cursor;
        }
        
        const response = await axios.get('https://slack.com/api/conversations.history', {
          params,
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const data = response.data;
        
        if (data.ok) {
          // Count mentions in this batch of messages
          data.messages.forEach(message => {
            // Check for user mentions (<@U12345>)
            if (message.text && message.text.includes(`<@${targetId}>`)) {
              mentionCount++;
            }
            
            // Check for user group mentions (<@subteam^ID>)
            if (targetId.startsWith('S') && message.text && message.text.includes(`<!subteam^${targetId}>`)) {
              mentionCount++;
            }
          });
          
          // Handle pagination
          hasMore = data.has_more === true;
          cursor = data.response_metadata?.next_cursor;
        } else {
          console.error(`Error fetching data: ${data.error}`);
          hasMore = false;
        }
      } catch (error) {
        console.error(`API request failed: ${error.message}`);
        hasMore = false;
      }
    }
    
    // Format dates for readability
    const weekRange = `${weekStart.format('YYYY-MM-DD')} to ${weekEnd.format('YYYY-MM-DD')}`;
    weeklyCounts.push({
      Week: weekRange,
      MentionCount: mentionCount
    });
  }
  
  return weeklyCounts;
}

async function countHereEveryoneMentions(channelId, token, targetId, weeksToAnalyze = 2) {
  const weeklyCounts = [];
  const endDate = moment();

  for (let i = 0; i < weeksToAnalyze; i++) {
    // Calculate start and end timestamps for this week
    const weekEnd = moment(endDate).subtract(7 * i, 'days');
    const weekStart = moment(weekEnd).subtract(7, 'days');
    const oldest = weekStart.unix();
    const latest = weekEnd.unix();

    let mentionCount = 0;
    let hasMore = true;
    let cursor = null;

    // Handle pagination
    while (hasMore) {
      try {
        const params = {
          channel: channelId,
          oldest: oldest,
          latest: latest,
          limit: 1000
        };

        if (cursor) {
          params.cursor = cursor;
        }

        const response = await axios.get('https://slack.com/api/conversations.history', {
          params,
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = response.data;

        if (data.ok) {
          // Count @here and @everyone mentions using Slack's formatted syntax
          data.messages.forEach(message => {
            // In Slack API, @here appears as <!here> and @everyone/channel as <!everyone> or <!channel>
            if (message.text && (
              message.text.includes('<!here>') || 
              message.text.includes('<!everyone>') || 
              message.text.includes('<!channel>')
            )) {
              mentionCount++;
            }

            // Check for user group mentions (<@subteam^ID>)
            if (targetId.startsWith('S') && message.text && message.text.includes(`<!subteam^${targetId}>`)) {
              mentionCount++;
            }
          });

          // Handle pagination
          hasMore = data.has_more === true;
          cursor = data.response_metadata?.next_cursor;
        } else {
          console.error(`Error fetching data: ${data.error}`);
          hasMore = false;
        }
      } catch (error) {
        console.error(`API request failed: ${error.message}`);
        hasMore = false;
      }
    }

    // Format dates for readability
    const weekRange = `${weekStart.format('YYYY-MM-DD')} to ${weekEnd.format('YYYY-MM-DD')}`;
    weeklyCounts.push({
      Week: weekRange,
      HereEveryoneMentionCount: mentionCount
    });
  }

  return weeklyCounts;
}

async function main() {
  const channelId = process.env.CHANNEL_ID;
  const engChannelId = process.env.GAIL_ENG_CHANNEL_ID;
  const token = process.env.SLACK_TOKEN;
  const mention = process.env.ON_CALL_TARGET_ID;
  
  try {
    const weeksToAnalyze = 10;
    const totalCounts = await getWeeklyMessageCounts(channelId, token, weeksToAnalyze);
    const mentionCounts = await countMentions(channelId, token, mention, weeksToAnalyze);
    const hereEveryoneCounts = await countHereEveryoneMentions(engChannelId, token, mention, weeksToAnalyze);

    console.table(totalCounts);
    console.table(mentionCounts);
    console.table(hereEveryoneCounts);

  } catch (error) {
    console.error('Failed to get message counts:', error);
  }
}

main();
