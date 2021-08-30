const { google } = require('googleapis');
const youtube = google.youtube('v3');
const fetch = require('node-fetch');

const OAuth = require('./OAuth')

class YouTubeApi {
    constructor() {
        this.callbacks = new Map();
        this.commands = new Map();
        this.init = false;
        this.timeTillAway = 1000 * 60 * 5; //When user doesnt write for 5 Minutes he isn't more in the chat 
        this.liveChatId;
        this.nextPage;
        this.intervalTime = 5000;
        this.interval;
        this.chatMessages = [];

        this.items = [];
        this.oauth = new OAuth(this);
        this.auth = this.oauth.auth;

        this.setCallback('init', async () => {
            const response = await fetch('http://docs.jodu555.de/badwords/de.json');
            this.badwords = await response.json();
        });

    }

    setCallback(key, callback) {
        if (this.callbacks.has(key)) {
            if (typeof this.callbacks.get(key) == 'function') {
                this.callbacks.set(key, [this.callbacks.get(key), callback]); callback
            } else {
                this.callbacks.set(key, [...this.callbacks.get(key), callback]); callback
            }
        } else {
            this.callbacks.set(key, callback);
        }
    }

    async callCallback(key, obj) {
        if (key == 'init' && this.init) return;
        if (key == 'init') this.init = true;

        if (typeof this.callbacks.get(key) == 'function') {
            this.callbacks.get(key)(obj);
        } else {
            this.callbacks.get(key).forEach(fun => {
                fun(obj);
            });
        }


    }

    registerCommand(command, cb) {
        if (command.startsWith('!')) {
            this.commands.set(command.toLowerCase(), cb);
        } else {
            console.error('Command must contain an exclamation mark!');
        }
    }

    callCommand(command, message) {
        const returnmessage = this.commands.get(command)(command, message);
        if (message)
            this.getLiveChatInteractions().insertChatMessage(returnmessage);
    }

    getOAuth() { return this.oauth }

    getUtils() {
        return {
            satisfyMessage: (ytMessaageObject) => {
                const possibleBadges = ['isVerified', 'isChatOwner', 'isChatSponsor', 'isChatModerator'];
                const badges = [];
                possibleBadges.forEach(possibleBadge => {
                    if (ytMessaageObject.authorDetails[possibleBadge])
                        badges.push(this.getUtils().satisfyBadge(possibleBadge));
                });
                const message = {
                    id: ytMessaageObject.id,
                    message: ytMessaageObject.snippet.textMessageDetails.messageText,
                    publishedAt: ytMessaageObject.snippet.publishedAt,
                    author: {
                        channelId: ytMessaageObject.authorDetails.channelId,
                        channelUrl: ytMessaageObject.authorDetails.channelUrl,
                        displayName: ytMessaageObject.authorDetails.displayName,
                        profileImageUrl: ytMessaageObject.authorDetails.profileImageUrl,
                        badges
                    }
                }
                return message;
            },
            satisfyBadge: (badge) => {
                let lastUpperCase = {};
                for (let index = 0; index < badge.length; index++) {
                    const char = badge.charAt(index);
                    if (char && char == char.toUpperCase())
                        lastUpperCase = { char, index }
                }
                return badge.slice(lastUpperCase.index);
            }
        }
    }

    getLiveChatInteractions() {
        return {
            getCurrentLiveChatID: async () => {
                const response = await youtube.liveBroadcasts.list({
                    auth: this.auth,
                    part: 'snippet',
                    broadcastStatus: 'active'
                });
                const latestBroadcast = response.data.items[0];
                if (latestBroadcast && latestBroadcast.snippet.liveChatId) {
                    this.liveChatId = latestBroadcast.snippet.liveChatId;
                    this.startTime = new Date(latestBroadcast.snippet.actualStartTime);
                    console.log("Chat ID Found:", this.liveChatId);
                } else {
                    throw new Error('No Active Chat Found');
                }
            },

            getChatMessages: async () => {
                const response = await youtube.liveChatMessages.list({
                    auth: this.auth,
                    part: 'snippet,authorDetails',
                    liveChatId: this.liveChatId,
                    pageToken: this.nextPage
                });
                const { data } = response;
                const newMessages = data.items.map(ytmsg => this.getUtils().satisfyMessage(ytmsg));
                newMessages.forEach(msg => {
                    //Check for next Page to prevent from re answering the old questions
                    if (this.nextPage && msg.message.startsWith('!')) {
                        const command = msg.message.split(' ')[0];
                        this.callCommand(command, msg);
                    }
                    //Check for badwords
                    if (this.badwords.some(v => msg.message.toLowerCase().includes(v.toLowerCase()))) {
                        console.log('Bad Words detected');
                        this.getLiveChatInteractions().deleteChatMessage(msg.id);
                    }


                    this.callCallback('newMessage', msg);
                });
                this.chatMessages.push(...newMessages);
                this.nextPage = data.nextPageToken;
            },

            getStreamUptime: () => {
                let duration = Date.now() - this.startTime.getTime();

                var milliseconds = parseInt((duration % 1000))
                    , seconds = parseInt((duration / 1000) % 60)
                    , minutes = parseInt((duration / (1000 * 60)) % 60)
                    , hours = parseInt((duration / (1000 * 60 * 60)) % 24);

                let output = '';
                if (hours !== 0)
                    output += `${hours} ${hours > 1 ? 'Stunden' : 'Stunde'} `
                if (minutes !== 0)
                    output += `${minutes} ${minutes > 1 ? 'Minuten' : 'Minute'} und `
                if (seconds !== 0)
                    output += `${seconds} ${seconds > 1 ? 'Sekunden' : 'Sekunde'}`
                return output;
            },

            insertChatMessage: (message) => {
                try {
                    youtube.liveChatMessages.insert({
                        auth: this.auth,
                        part: 'snippet',
                        resource: {
                            snippet: {
                                liveChatId: this.liveChatId,
                                type: 'textMessageEvent',
                                textMessageDetails: {
                                    messageText: message
                                }
                            }
                        }
                    },
                        () => { }
                    );
                } catch (error) {
                    console.error(error);
                }
            },
            deleteChatMessage: (messageId) => {
                try {
                    youtube.liveChatMessages.delete({
                        auth: this.auth,
                        id: messageId,
                    });
                } catch (error) {
                    console.error(error);
                }
            },
            startMessageTracking: () => {
                this.interval = setInterval(this.getLiveChatInteractions().getChatMessages, this.intervalTime);
            }
        }
    }


}

module.exports = YouTubeApi;