const dotenv = require('dotenv').config();
const express = require('express');
const server = express();
const { Database } = require('@jodu555/mysqlapi');
const database = Database.createDatabase('localhost', 'root', '', 'yt-chatbot');
database.connect();
require('./tables').create();

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
youtubeApi.registerCommand('!ts', (command, message) => {
  return 'Teamspeak: server1.Jodu555.de';
});
youtubeApi.registerCommand('!watchtime', async (command, message) => {
  const user = await youtubeApi.getUtils().getUserData(message.author.channelID);
  return 'Du guckst den Stream bereits seid ' + user.watchtime / 1000 + ' Sekunden';
});
youtubeApi.registerCommand('!coins', async (command, message) => {
  const user = await youtubeApi.getUtils().getUserData(message.author.channelID);
  return 'Du hast aktuell ' + user.coins + ' Coins';
});



youtubeApi.setCallback('newMessage', (message) => {
  // console.log(message);

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
