const { google } = require('googleapis');
const fs = require('fs');
const youtube = google.youtube('v3');
const OAuth2 = google.auth.OAuth2;

class YouTubeApi {
    constructor() {
        this.callbacks = new Map();
        this.init = false;
        this.scope = [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/youtube',
            'https://www.googleapis.com/auth/youtube.force-ssl'
        ];
        this.redirectURI = 'http://localhost:3000/callback';
        this.auth = new OAuth2(process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            this.redirectURI
        );
        this.liveChatId;
        this.nextPage;
        this.intervalTime = 5000;
        this.interval;
        this.chatMessages = [];

        this.items = [];

        this.auth.on('tokens', tokens => {
            if (tokens.refresh_token) {
                fs.writeFileSync('./tokens.json', JSON.stringify(this.auth.tokens));
            }
        });
        this.getOAuth().checkTokens();
    }

    setCallback(key, callback) {
        this.callbacks.set(key, callback);
    }

    callCallback(key, obj) {
        if (key == 'init' && this.init)
            return;
        if (key == 'init')
            this.init = true;
        this.callbacks.get(key)(obj);
    }

    getOAuth() {
        return {
            getAuthURL: () => {
                const authUrl = this.auth.generateAuthUrl({
                    access_type: 'offline',
                    scope: this.scope
                });
                return authUrl;
            },
            authorize: async (code) => {
                const credentials = await this.auth.getToken(code);
                this.auth.setCredentials(tokens);
                fs.writeFileSync('./tokens.json', JSON.stringify(tokens));
                console.log('Successfully get credentials');
                this.callCallback('init');
            },
            checkTokens: async () => {
                try {
                    //TODO: file stuff
                    const tokens = JSON.parse(await fs.readFileSync('./tokens.json'));
                    if (tokens) {
                        this.auth.setCredentials(tokens);
                        console.log('tokens set');
                    } else {
                        console.log('no tokens set');
                    }
                    this.callCallback('init');
                } catch (error) {
                    console.log('Error checkTokens');
                }
            }
        }
    }

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
                const newMessages = data.items;
                newMessages.forEach(newMessage => {
                    this.callCallback('newMessage', newMessage);
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
            startMessageTracking: () => {
                this.interval = setInterval(this.getLiveChatInteractions().getChatMessages, this.intervalTime);
            }
        }
    }


}

module.exports = YouTubeApi;