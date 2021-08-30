const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const fs = require('fs');

class OAuth {
    constructor() {
        this.scope = [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/youtube',
            'https://www.googleapis.com/auth/youtube.force-ssl'
        ];
        this.redirectURI = 'http://localhost:3000/callback';
        this.auth = new OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            this.redirectURI
        );

        this.auth.on('tokens', tokens => {
            if (tokens.refresh_token) {
                fs.writeFileSync('./tokens.json', JSON.stringify(this.auth.tokens));
            }
        });
        this.checkTokens();
    }

    getAuthURL() {
        const authUrl = this.auth.generateAuthUrl({
            access_type: 'offline',
            scope: this.scope
        });
        return authUrl;
    }

    async authorize(code) {
        const credentials = await this.auth.getToken(code);
        this.auth.setCredentials(tokens);
        fs.writeFileSync('./tokens.json', JSON.stringify(tokens));
        console.log('Successfully get credentials');
        this.callCallback('init');
    }

    async checkTokens() {
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
            console.error(error);
            console.log('Error checkTokens');
        }
    }
}

module.exports = OAuth;