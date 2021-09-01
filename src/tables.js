const { Database } = require('@jodu555/mysqlapi');
const database = Database.getDatabase();

function create() {
    database.createTable('chatuser', {
        options: {
            PK: 'channelId',
            K: ['displayName'],
        },
        channelId: 'TEXT',
        channelUrl: 'TEXT',
        displayName: 'TEXT',
        profileImageUrl: 'TEXT',
        badges: 'TEXT',
    });
}

module.exports = {
    create,
}

