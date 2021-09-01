const { Database } = require('@jodu555/mysqlapi');
const database = Database.getDatabase();

function create() {
    database.createTable('chatuser', {
        options: {
            PK: 'channelId',
            K: ['displayName'],
        },
        channelId: 'VARCHAR(512)',
        channelUrl: 'TEXT',
        displayName: 'VARCHAR(512)',
        profileImageUrl: 'TEXT',
        badges: 'TEXT',
        watchtime: 'INT',
        coins: 'INT',
    });
    //TODO: Maybe add an table with the unique chat messages
}

module.exports = {
    create,
}

