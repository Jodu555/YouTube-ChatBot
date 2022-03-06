const dotenv = require('dotenv').config();
const express = require('express');
const http = require('http');
const app = express();
const server = http.Server(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const { Database } = require('@jodu555/mysqlapi');
const database = Database.createDatabase('localhost', 'root', '', 'yt-chatbot');
database.connect();
require('./tables').create();

const YouTubeApi = require('./YouTubeApi');
const youtubeApi = new YouTubeApi(io);

youtubeApi.setCallback('init', async () => {
  // return;
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
  const user = await youtubeApi.getUtils().getUserData(message.author.channelId);
  if (!user) return 'Du hast noch keine Watchtime'
  const timeString = youtubeApi.getUtils().millisecondsToTimeString(user.watchtime);
  return 'Du guckst den Stream bereits seid ' + timeString;
});
youtubeApi.registerCommand('!coins', async (command, message) => {
  const user = await youtubeApi.getUtils().getUserData(message.author.channelId);
  return 'Du hast aktuell ' + user.coins + ' Coins';
});
youtubeApi.registerCommand('!party', async (command, message) => {
  // const user = await youtubeApi.getUtils().getUserData(message.author.channelId);
  return 'Du kannst mitspielen indem du einfach deinen Namen in den Chat Schreibst, dan werden wir dich in unsere Party einladen!';
});

youtubeApi.setCallback('newMessage', (message) => {
  io.emit('newMessage', message);
})

app.get('/authorize', (request, response) => {
  console.log('/auth');
  response.redirect(youtubeApi.getOAuth().getAuthURL());
});

app.get('/callback', (req, response) => {
  console.log('/callback');
  const { code } = req.query;
  youtubeApi.getOAuth().authorize(code);
  response.redirect('/');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server is listening on ${PORT}`);

  // const user = await youtubeApi.getUtils().getUserData('UC80MS3ed304csIeC0LgfI9Q');
});


