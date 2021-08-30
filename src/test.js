const userAwayMap = new Map();
const timeTillAway = 1000 * 60 * 5;
const coinsPerMinute = 1;
const userDataMap = new Map();

onNewMessage('Jodu555', 'dsaadsad');

console.log(userDataMap);

setTimeout(() => {
    onNewMessage('Jodu555', '1 Second');
}, 1000);

setTimeout(() => {
    onNewMessage('Jodu555', '2 Seconds');
}, 2000);


function updateWatchTimeAndSetCoins(user, time) {
    if (userDataMap.has(user)) {
        const content = userDataMap.get(user);
        content.watchtime += time;
        content.coins += Math.floor(time / 1000 / 60 * coinsPerMinute);
    } else {
        userDataMap.set(user, {
            watchtime: time,
            coins: Math.floor(time / 1000 / 60 * coinsPerMinute),
        })
    }
}

function onNewMessage(user, msg) {
    console.log(msg);
    if (userAwayMap.has(user)) {
        const lastSeen = userAwayMap.get(user);
        const diff = Date.now() - lastSeen;
        if (diff < timeTillAway) {
            updateWatchTimeAndSetCoins(user, diff);
        }
    } else {
        userAwayMap.set(user, Date.now());
    }
}