const { google } = require('googleapis');
const youtube = google.youtube('v3');
const OAuth = require('./OAuth')
const { Database } = require('@jodu555/mysqlapi');
const database = Database.getDatabase();

class YouTubeApi {
    constructor(io) {
        this.io = io;
        this.init = false;
        this.callbacks = new Map();
        this.commands = new Map();
        this.userAwayMap = new Map();
        this.userDataMap = new Map();

        this.timeTillAway = 1000 * 60 * 5; //When user doesnt write for 5 Minutes he isn't more in the chat 
        this.coinsPerMinute = 1; // The amount of coins a user gains per minute
        this.intervalTime = 7000; //The millisecond Interval to check for new chatMessages
        this.startCoins = 1000; //Every user gets 1000 Coins if he joins the stream
        this.appStart = Date.now();

        this.liveChatId;
        this.nextPage;
        this.interval;
        this.chatMessages = [];

        this.oauth = new OAuth(this);
        this.auth = this.oauth.auth;

        this.setCallback('init', async () => {
            // const response = await fetch('http://docs.jodu555.de/badwords/de.json');
            // this.badwords = await response.json();
            this.badwords = [];
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

    async callCommand(command, message) {
        const returnmessage = await this.commands.get(command)(command, message);
        if (message)
            this.getLiveChatInteractions().insertChatMessage(returnmessage);
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
            },
            getUserData: async (channelId) => {
                const user = await database.get('chatuser').getOne({ channelId });
                return user;
            },
            millisecondsToTimeString: (duration) => {
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
            checkIfOldMessage: (msg) => new Date(msg.publishedAt).getTime() >= this.appStart
        }
    }


    /**
     * @typedef {Object} ChatMessage
     * @property {string} id the message id
     * @property {string} message the message content
     * @property {string} publishedAt the date where the message got published
     * @property {Author} author the message author informations
     */

    /**
     * @typedef {Object} Author
     * @property {string} channelId the authors channelId
     * @property {string} channelUrl the authors channelUrl
     * @property {string} displayName the display name
     * @property {string} profileImageUrl the profileImageUrl
     * @property {string[]} badges a list of badges
     */

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
            /**
             * @returns {ChatMessage[]} returns chat messages
             */
            getAPIChatMessages: async () => {
                const response = await youtube.liveChatMessages.list({
                    auth: this.auth,
                    part: 'snippet,authorDetails',
                    liveChatId: this.liveChatId,
                    pageToken: this.nextPage
                });
                const { data } = response;
                return data.items;
            },
            getChatMessages: async () => {
                const response = await youtube.liveChatMessages.list({
                    auth: this.auth,
                    part: 'snippet,authorDetails',
                    liveChatId: this.liveChatId,
                    pageToken: this.nextPage
                });
                const { data } = response;
                // const tmpmsgs = await this.getLiveChatInteractions().getAPIChatMessages()
                // const newMessages = tmpmsgs.map(ytmsg => this.getUtils().satisfyMessage(ytmsg));
                const newMessages = data.items.map(ytmsg => this.getUtils().satisfyMessage(ytmsg));
                await newMessages.forEach(async (msg) => {
                    await this.getLiveChatInteractions().manageWatchTimeAndCoins(msg);
                    //Check for badwords
                    if (this.badwords.some(v => msg.message.toLowerCase().includes(v.toLowerCase()))) {
                        console.log('Bad Words detected');
                        this.getLiveChatInteractions().deleteChatMessage(msg.id);
                    }
                    //Check for oldMessage to prevent from reanswering old questions
                    if (this.getUtils().checkIfOldMessage(msg) && msg.message.startsWith('!')) {
                        const command = msg.message.split(' ')[0];
                        this.callCommand(command, msg);
                    }
                    this.callCallback('newMessage', msg);
                });
                this.chatMessages.push(...newMessages);
                this.nextPage = data.nextPageToken;
            },
            /**
             * @param {ChatMessage} msg - the message
             */
            manageWatchTimeAndCoins: async (msg) => {
                const user = msg.author;
                if (!(await database.get('chatuser').getOne({ channelId: user.channelId }))) {
                    user.badges = user.badges.length == 0 ? '' : user.badges;
                    database.get('chatuser').create({
                        ...user,
                        watchtime: 0,
                        coins: this.startCoins,
                    });
                }
                if (this.userAwayMap.has(user.channelId)) {
                    const lastSeen = this.userAwayMap.get(user.channelId);
                    const diff = Date.now() - lastSeen;
                    if (diff < this.timeTillAway) {
                        await this.getLiveChatInteractions().updateWatchTimeAndSetCoins(msg.author, diff);
                    } else {
                        console.log('User was away');
                    }
                } else {
                    this.userAwayMap.set(user.channelId, Date.now());
                }
            },
            /**
             * @param {Author} user - the author
             * @param {int} time - the time the user have watched
             */
            updateWatchTimeAndSetCoins: async (user, time) => {
                user = await database.get('chatuser').getOne({ channelId: user.channelId });
                if (user) {
                    const update = {
                        watchtime: user.watchtime,
                        coins: user.coins
                    };
                    update.watchtime += time;
                    update.coins += Math.floor(time / 1000 / 60 * this.coinsPerMinute);
                    await database.get('chatuser').update({ channelId: user.channelId }, { ...update });
                } else {
                    database.get('chatuser').create({
                        ...user,
                        watchtime: time,
                        coins: Math.floor(time / 1000 / 60 * this.coinsPerMinute),
                    });
                }
            },
            getStreamUptime: () => {
                let duration = Date.now() - this.startTime.getTime();
                const output = this.getUtils().millisecondsToTimeString(duration);
                // var milliseconds = parseInt((duration % 1000))
                //     , seconds = parseInt((duration / 1000) % 60)
                //     , minutes = parseInt((duration / (1000 * 60)) % 60)
                //     , hours = parseInt((duration / (1000 * 60 * 60)) % 24);

                // let output = '';
                // if (hours !== 0)
                //     output += `${hours} ${hours > 1 ? 'Stunden' : 'Stunde'} `
                // if (minutes !== 0)
                //     output += `${minutes} ${minutes > 1 ? 'Minuten' : 'Minute'} und `
                // if (seconds !== 0)
                //     output += `${seconds} ${seconds > 1 ? 'Sekunden' : 'Sekunde'}`
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

    getOAuth() { return this.oauth }
}

module.exports = YouTubeApi;