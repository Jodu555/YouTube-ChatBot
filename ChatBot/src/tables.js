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

    database.createTable('chatmessages', {
        options: {
            PK: 'id',
        },
        id: 'VARCHAR(512)',
        author: 'VARCHAR(512)',
        message: 'TEXT',
        profileImageUrl: 'TEXT',
        publishedAt: 'TEXT',
    });
}

module.exports = {
    create,
}

