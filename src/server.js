const dotenv = require('dotenv').config;
const express = require('express');
const server = express();
const YouTubeApi = require('./YouTubeApi');


const youtubeApi = new YouTubeApi();

youtubeApi.setCallback('init', async () => {
  await youtubeApi.getLiveChatInteractions().getCurrentLiveChatID();
  youtubeApi.getLiveChatInteractions().startMessageTracking();
  // youtubeApi.getLiveChatInteractions().insertChatMessage('Hello from the NodeJS Application Second');
});

youtubeApi.registerCommand('!uptime', (command, message) => {
  return 'Der Stream ist bereits seit ' + youtubeApi.getLiveChatInteractions().getStreamUptime() + ' Live!'
});

youtubeApi.setCallback('newMessage', (message) => {
  console.log(message);
  if (message.message.includes('!ts')) {
    youtubeApi.getLiveChatInteractions().insertChatMessage('Teamspeak: server1.Jodu555.de!');
  }


});

server.get('/authorize', (request, response) => {
  console.log('/auth');
  response.redirect(youtubeApi.getOAuth().getAuthURL());
});

server.get('/callback', (req, response) => {
  console.log('/callback');
  const { code } = req.query;
  youtubeApi.getOAuth().authorize(code);
  response.redirect('/');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on ${PORT}`);
});
