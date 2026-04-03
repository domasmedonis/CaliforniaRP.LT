const bcrypt = require('bcrypt');
const mysql = require('mysql');
const moment = require('moment-timezone');



const activeDrivers = new Map();
const activeRides = new Map();
const activeCalls = new Map();

const TWITTER_COOLDOWN = 3600000; // 1 hour between posts
const lastTweetTime = new Map();

function startCall(caller, target) {
    if (!caller || !target || caller.id === target.id) return false;
    if (!caller.charName || !target.charName) return false;
    if (activeCalls.has(caller.id) || activeCalls.has(target.id)) return false;

    const callData = { caller: caller, target: target, status: 'ringing' };
    activeCalls.set(caller.id, callData);
    activeCalls.set(target.id, { caller: caller, target: target, status: 'incoming' });

    caller.outputChatBox(`!{#f7dc6f}Skambinate ${target.charName} (${target.phoneNumber})...`);
    target.outputChatBox(`!{#f7dc6f}Jums skambina ${caller.charName} (${caller.phoneNumber}). Naudokite /answer arba /decline.`);
    target.call('incomingCall', [caller.charName, caller.phoneNumber]);
    return true;
}


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'ragemp_mod'
});


db.connect((err) => {
    if (err) {
        console.error('MySQL Connection Failed:', err);
    } else {
        console.log('Connected to MySQL Database!');
        // Ensure Twitter schema exists
        db.query(`CREATE TABLE IF NOT EXISTS twitter_accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            char_id INT NOT NULL,
            handle VARCHAR(50) UNIQUE NOT NULL,
            FOREIGN KEY (char_id) REFERENCES characters(id)
        )`, (err) => {
            if (err) console.error('Error creating twitter_accounts table:', err);
            else console.log('Twitter accounts table ready.');
        });
        db.query(`CREATE TABLE IF NOT EXISTS twitter_posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            char_id INT NOT NULL,
            handle VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('Error creating twitter_posts table:', err);
            else console.log('Twitter posts table ready.');
        });
    }
});

module.exports = db;

// Store player-specific time info
let playerTimeInfo = {};

mp.events.add('playerConnect', (player) => {
    const ip = player.ip;

    db.query('SELECT * FROM bans WHERE ip = ?', [ip], (error, results) => {
        if (error) {
            console.log('[KLAIDA] Įvyko klaida tikrinant žaidėjo IP');
            return;
        }

        if (results.length > 0) {
            const reason = results[0].reason || "Nenurodyta priežastis";
            player.outputChatBox(`[INFO] Jūs esate užblokuotas. Priežastis: ${reason}`);
            player.kick(`[KICK] Jūs buvote užblokuotas. Priežastis: ${reason}`);
        } else {
            console.log(`Žaidėjas (UCP: ${player.name}) prisijungė prie serverio.`);
        }
    });
});

mp.events.add('playerJoin', (player) => {
    player.call('openLoginUI');
    player.call('hideDefaultCashUI');

    if (!playerTimeInfo[player.id]) {
        playerTimeInfo[player.id] = {};
    }

    playerTimeInfo[player.id].interval = setInterval(() => {
        const serverTime = moment().tz('Europe/Vilnius').format('YYYY-MM-DD HH:mm:ss');
        player.call('updateServerTime', [serverTime]);
    }, 1000);

    console.log(`Žaidėjas (UCP: ${player.name}) prisijungė prie serverio.`);
});

mp.events.add('validateLogin', (player, username, password) => {
    db.query('SELECT * FROM players WHERE name = ?', [username], (err, results) => {
        if (err) {
            console.error('[DATABASE ERROR]', err);
            player.call('login:error', ['⚠️ Duomenų bazės klaida! Bandykite vėliau.']);
            return;
        }

        if (results.length === 0) {
            console.log(`[LOGIN FAILED] Username "${username}" not found.`);
            player.call('login:error', ['❌ Vartotojo vardas nerastas!']);
            return;
        }

        const storedPassword = results[0].password;

        bcrypt.compare(password, storedPassword, (err, isMatch) => {
            if (err) {
                console.error('[BCRYPT ERROR]', err);
                player.call('login:error', ['⚠️ Klaida tikrinant slaptažodį. Bandykite dar kartą.']);
                return;
            }

            if (isMatch) {
                console.log(`[LOGIN SUCCESS] User "${username}" logged in.`);
                player.name = username; // UCP username
                player.call('login:success');
                loadCharacterSelection(player);
            } else {
                console.log(`[LOGIN FAILED] Incorrect password for "${username}".`);
                player.call('login:error', ['❌ Neteisingas slaptažodis!']);
            }
        });
    });
});

function loadCharacterSelection(player) {
    db.query('SELECT id, char_name, money, bank_balance, playtime, health FROM characters WHERE ucp_username = ?',
        [player.name], (err, results) => {
            if (err) {
                console.error('[KLAIDA] Veikėjų sąrašas nepakrautas:', err);
                player.outputChatBox('⚠️ Klaida kraunant veikėjus. Susisiekite su administratoriumi.');
                return;
            }

            const characterCount = results.length;
            if (characterCount === 0) {
                player.outputChatBox('!{#f7dc6f}Jūs neturite veikėjų. Sukurkite juos UCP (californiarp.lt/ucp)!');
                return;
            }

            const characters = results.map(row => ({
                id: row.id,
                name: row.char_name,
                money: row.money,
                bankBalance: row.bank_balance,
                playtime: row.playtime,
                playtimeFormatted: Math.floor(row.playtime / 60) + ' val. ' + (row.playtime % 60) + ' min.',
                health: row.health
            }));

            player.call('showCharacterSelectionUI', [JSON.stringify(characters)]);
        });
}

mp.events.add('selectCharacter', (player, charId) => {
    db.query('SELECT * FROM characters WHERE id = ? AND ucp_username = ?', [charId, player.name], (err, results) => {
        if (err || results.length === 0) {
            console.error('[KLAIDA] Veikėjas nerastas:', err);
            player.outputChatBox('⚠️ Klaida pasirenkant veikėją.');
            return;
        }

        const charData = results[0];
        player.charId = charData.id;
        player.charName = charData.char_name;
        player.adminName = charData.admin_name || charData.char_name; // Use admin_name if set, otherwise char_name
        player.health = charData.health;
        player.money = charData.money;
        player.bankBalance = charData.bank_balance;
        player.playtime = charData.playtime;
        player.position = new mp.Vector3(charData.position_x, charData.position_y, charData.position_z);
        player.isPMEnabled = charData.is_pm_enabled;
        player.adminLevel = charData.admin_level;
        player.phoneNumber = charData.phone_number;

        // Load bank account (now tied to char_name)
        db.query('SELECT * FROM bank_accounts WHERE char_name = ?', [player.charName], (err, bankResults) => {
            if (err) {
                console.error('[KLAIDA] Banko sąskaita nepakrauta:', err);
                player.outputChatBox('⚠️ Klaida kraunant banko duomenis.');
                return;
            }

            if (bankResults.length === 0) {
                db.query('INSERT INTO bank_accounts (char_name, balance) VALUES (?, ?)', [player.charName, 0]);
                player.bankBalance = 0;
            } else {
                player.bankBalance = bankResults[0].balance;
            }
            player.call('updateBankHUD', [player.bankBalance]);
        });

        player.spawn(player.position);

        player.call('updateMoneyHUD', [player.money]);
        player.call('updateBankHUD', [player.bankBalance]);
        player.call('updatePhoneNumber', [player.phoneNumber]);
        player.outputChatBox(`!{#7aa164}Pasirinkote veikėją: ${charData.char_name}. Sveiki atvykę į CaliforniaRP.LT!`);

        loadCharacterContacts(player);

        if (!player.timer) {
            player.timer = setInterval(() => {
                player.playtime += 1;
                if (player.playtime % 30 === 0) {
                    const paycheckAmount = 1000;
                    player.bankBalance += paycheckAmount;
                    player.call('showPaycheckPopup', [paycheckAmount]);
                    db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
                    db.query('UPDATE characters SET playtime = ? WHERE id = ?', [player.playtime, player.charId]);
                    player.outputChatBox(`!{#229954}Jūsų atlyginimas ($${paycheckAmount}) pervestas į banko sąskaitą.`);
                    player.call('updateBankHUD', [player.bankBalance]);
                }
            }, 60000);
        }

        // Start periodic saving (every 5 minutes)
        if (!player.saveTimer) {
            player.saveTimer = setInterval(() => {
                saveCharacterData(player);
            }, 300000); // 5 minutes
        }

        console.log(`[VEIKĖJAS] ${player.name} pasirinko veikėją ${charData.char_name}`);
    });
});


// Ensure loadCharacterContacts sends the update to the client
function loadCharacterContacts(player) {
    if (!player.charId) return;

    db.query('SELECT contact_name, contact_number FROM contacts WHERE char_id = ?', [player.charId], (err, results) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko įkelti kontaktų:', err);
            return;
        }
        const contacts = results.map(row => ({ name: row.contact_name, number: row.contact_number }));
        player.contacts = contacts;
        console.log(`[DEBUG] Loaded contacts for charId ${player.charId}:`, contacts);

        // Ensure the UI updates even if the phone isn't open yet
        player.call('updateContactsUI', [JSON.stringify(contacts)]);
    });
}

// Function to save character data
function saveCharacterData(player) {
    if (player.charId) {
        db.query('UPDATE characters SET playtime = ?, money = ?, bank_balance = ?, position_x = ?, position_y = ?, position_z = ?, health = ?, is_pm_enabled = ?, phone_number = ? WHERE id = ?',
            [player.playtime || 0, player.money || 0, player.bankBalance || 0, player.position.x, player.position.y, player.position.z, player.health || 100, player.isPMEnabled ? 1 : 0, player.phoneNumber, player.charId],
            (err) => {
                if (err) {
                    console.error('[KLAIDA] Nepavyko išsaugoti veikėjo duomenų:', err);
                } else {
                    console.log(`[VEIKĖJAS] ${player.charName} duomenys išsaugoti sėkmingai.`);
                }
            });

        db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance || 0, player.charName], (err) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko išsaugoti banko sąskaitos:', err);
            }
        });
    }
}

// World time sync
setInterval(() => {
    const currentHour = moment().tz('Europe/Vilnius').hour();
    if (currentHour >= 20 || currentHour < 6) {
        mp.world.time.hour = 0;
        mp.world.time.minute = 0;
    } else {
        mp.world.time.hour = 12;
        mp.world.time.minute = 0;
    }
}, 60000);

// Chat and Commands
const messageColor = "#c2749d";

mp.events.addCommand('me', (player, _, ...action) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (action.length === 0) {
        player.outputChatBox('Naudojimas: /me <veiksmas>');
        return;
    }

    const actionMessage = action.join(' ');
    const message = `!{${messageColor}}* ${player.charName} ${actionMessage}`;

    mp.players.forEachInRange(player.position, 10, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(message);
    });
});

mp.events.addCommand('do', (player, _, ...description) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (description.length === 0) {
        player.outputChatBox('Naudojimas: /do <apibudinimas>');
        return;
    }

    const descriptionMessage = description.join(' ');
    const message = `!{${messageColor}}* ${descriptionMessage} ((${player.charName}))`;

    mp.players.forEachInRange(player.position, 10, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(message);
    });
});

mp.events.addCommand('s', (player, _, ...shoutMessage) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (shoutMessage.length === 0) {
        player.outputChatBox('Naudojimas: /s <žodis>');
        return;
    }

    const shoutText = shoutMessage.join(' ');
    const message = `* ${player.charName} šaukia: ${shoutText}`;

    mp.players.forEachInRange(player.position, 50, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(message);
    });
});

mp.events.addCommand('low', (player, _, ...whisperMessage) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (whisperMessage.length === 0) {
        player.outputChatBox('Naudojimas: /low <žodis>');
        return;
    }

    const whisperText = whisperMessage.join(' ');
    const whisperColor = "#A0A0A0";
    const message = `!{${whisperColor}}* ${player.charName} šnabžda: ${whisperText}`;

    mp.players.forEachInRange(player.position, 5, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(message);
    });
});


mp.events.add('playerChat', (player, text) => {
    if (!player.charName) return;
    if (!text || text.trim().length === 0) return;

    const isOnCall = activeCalls.has(player.id) && activeCalls.get(player.id).status === 'active';
    const proximityPrefix = isOnCall ? '!{#e8dc27}[Skambutis]' : '';
    const proximityMessage = `${proximityPrefix}${player.charName} sako: ${text}`;
    const callMessage = `!{#e8dc27}[Skambutis] ${player.charName}: ${text}`;

    // Send to players in proximity (including the player themselves)
    mp.players.forEachInRange(player.position, 20.0, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(proximityMessage);
    });

    // If on a call, also send to the call partner with [Skambutis] prefix
    if (isOnCall) {
        const callData = activeCalls.get(player.id);
        const partner = (callData.caller === player) ? callData.target : callData.caller;
        if (partner && partner !== player) { // Ensure partner exists and isn’t the same player
            partner.outputChatBox(callMessage);
            console.log(`[DEBUG] Call chat to partner: ${player.charName} -> ${partner.charName}: ${text}`);
        }
    }

    console.log(`[DEBUG] Chat: ${player.charName} says "${text}" (on call: ${isOnCall})`);
});

mp.events.addCommand('b', (player, _, ...messageArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (messageArray.length === 0) {
        player.outputChatBox(`!{#B0C4DE}Naudojimas: /b [žinutė] - Nusiusti OOC žinutę šalia esantiems žaidėjams.`);
        return;
    }

    const message = messageArray.join(" ");
    const chatMessage = `((${player.charName}: ${message}))`;

    mp.players.forEachInRange(player.position, 10, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(chatMessage);
    });
});

mp.events.addCommand('help', (player) => {
    player.outputChatBox(`!{#ADD8E6}----- Galimos komandos -----`);
    player.outputChatBox(`ROLEPLAY KOMANDOS - /me, /do, /b, /s, /low, /pm, /id, /try`);
    player.outputChatBox(`KITOS KOMANDOS - /stats, /pay, /bank, /withdraw, /deposit`);
    player.outputChatBox(`!{#ADD8E6}----------------------------`);
    player.outputChatBox(`Įvedus komandą gausite komandos paaiškinimą.`);
    player.outputChatBox(`Daugiau informacijos galite rasti mūsų forume arba /helpme <klausimas>.`);
});

mp.events.addCommand('id', (player, fullText, partialName) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!partialName) {
        player.outputChatBox(`Jūsų žaidėjo ID: ${player.id}`);
    } else {
        const matchingPlayers = mp.players.toArray().filter(p => p.charName && p.charName.toLowerCase().includes(partialName.toLowerCase()));
        if (matchingPlayers.length === 0) {
            player.outputChatBox(`Nerastas žaidėjas "${partialName}".`);
        } else {
            matchingPlayers.forEach(target => {
                player.outputChatBox(`ID: ${target.id} | Vardas: ${target.charName}`);
            });
        }
    }
});

mp.events.addCommand('pm', (player, fullText, targetIdentifier, ...messageArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier || messageArray.length === 0) {
        player.outputChatBox(`Naudojimas: /pm [ID ar dalis vardo] [žinutė]`);
        return;
    }

    const message = messageArray.join(" ");
    let target;

    target = getPlayerByIDOrName(targetIdentifier);

    if (!target) {
        player.outputChatBox(`Nerastas žaidėjas vardu "${targetIdentifier}".`);
        return;
    }

    if (!target.charName) {
        player.outputChatBox('!{#e74c3c}Žaidėjas dar nepasirinko veikėjo.');
        return;
    }

    if (!target.isPMEnabled) {
        player.outputChatBox('!{#E74C3C}Žaidėjas šiuo metu yra išjungęs privačias žinutes.');
        return;
    }

    if (!player.isPMEnabled) {
        player.outputChatBox('!{#E74C3C}Jūs išjungėte privačias žinutes ir negalite jų siųsti.');
        return;
    }

    if (target) {
        target.outputChatBox(`!{#FFFF00}((PM iš ${player.charName}: ${message}))`);
        player.outputChatBox(`!{#FFFF00}((PM nusiųsta ${target.charName}: ${message}))`);
    } else {
        player.outputChatBox(`Žaidėjas "${targetIdentifier}" nerastas.`);
    }
});

mp.events.addCommand('stats', player => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    player.outputChatBox(`!{#f7dc6f}===== Jūsų informacija =====`);
    player.outputChatBox(`UCP vartotojo vardas: ${player.name}, Veikėjo vardas: ${player.charName}`); // Show UCP username
    player.outputChatBox(`------------------------------------------------------`);
    player.outputChatBox(`📱 Telefono numeris: ${player.phoneNumber || 'Nėra'}`);
    player.outputChatBox(`Gyvybės: ${player.health}, Žaidimo laikas: ${Math.floor(player.playtime / 60)} val. ${player.playtime % 60} min.`);
    player.outputChatBox(`Grynieji pinigai: $${player.money}, Banko sąskaitos balansas: $${player.bankBalance}`);
});

mp.events.addCommand('try', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!fullText) {
        player.outputChatBox('Naudojimas: /try [veiksmas]');
        return;
    }

    const success = Math.random() < 0.5;
    const outcome = success ? 'pavyko' : 'nepavyko';
    const message = `${player.charName} bando ${fullText} ir jam ${outcome}.`;

    const nearbyPlayers = mp.players.toArray().filter(target => {
        const distance = Math.sqrt(
            Math.pow(player.position.x - target.position.x, 2) +
            Math.pow(player.position.y - target.position.y, 2) +
            Math.pow(player.position.z - target.position.z, 2)
        );
        return distance <= 10;
    });

    nearbyPlayers.forEach(target => {
        target.outputChatBox(`!{#c2749d}${message}`);
    });
});

mp.events.addCommand('time', (player) => {
    const serverTime = moment().tz('Europe/Vilnius').format('YYYY-MM-DD HH:mm:ss');
    player.outputChatBox(`!{#f4f4f4}Dabartinis serverio laikas: ${serverTime}`);
});

mp.events.add('playerCommand', (player, command) => {
    const args = command.split(' ');

    if (args[0] === 'pay' && args.length === 3) {
        if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
        const targetNameOrID = args[1];
        const amount = parseInt(args[2]);

        if (isNaN(amount) || amount <= 0) {
            player.outputChatBox('!{#f7dc6f}Prašome nurodyti galiojančią sumą.');
            return;
        }

        const targetPlayer = getPlayerByIDOrName(targetNameOrID);
        if (!targetPlayer) {
            player.outputChatBox('!{#f7dc6f}Žaidėjas nerastas!');
            return;
        }

        if (!targetPlayer.charName) {
            player.outputChatBox('!{#e74c3c}Žaidėjas dar nepasirinko veikėjo.');
            return;
        }

        if (player === targetPlayer) {
            player.outputChatBox('!{#f7dc6f}Negalite pervesti pinigų patys sau!');
            return;
        }

        const distance = player.position.distanceTo(targetPlayer.position);
        if (distance > 5) {
            player.outputChatBox('!{#f7dc6f}Jūs turite būti šalia kito žaidėjo, kad atliktumėte pervedimą.');
            return;
        }

        if (player.money < amount) {
            player.outputChatBox('!{#f7dc6f}Jūs neturite pakankamai pinigų!');
            return;
        }

        player.money -= amount;
        targetPlayer.money += amount;

        db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName], (err) => {
            if (err) {
                console.error(err);
                player.outputChatBox('!{#f7dc6f}Įvyko klaida atnaujinant jūsų paskyrą.');
                return;
            }
        });

        db.query('UPDATE characters SET money = ? WHERE char_name = ?', [targetPlayer.money, targetPlayer.charName], (err) => {
            if (err) {
                console.error(err);
                player.outputChatBox('!{#f7dc6f}Įvyko klaida atnaujinant gavėjo paskyrą.');
                return;
            }

            player.outputChatBox(`!{#f7dc6f}Jūs pervedėte $${amount} žaidėjui ${targetPlayer.charName}.`);
            targetPlayer.outputChatBox(`!{#f7dc6f}Jūs gavote $${amount} iš žaidėjo ${player.charName}.`);
        });
        return;
    }

    if (args[0] === 'togglepm') {
        if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
        player.isPMEnabled = !player.isPMEnabled;

        if (player.isPMEnabled) {
            player.outputChatBox('!{#27AE60}Jūs įjungėte privačias žinutes.');
        } else {
            player.outputChatBox('!{#E74C3C}Jūs išjungėte privačias žinutes.');
        }

        db.query('UPDATE characters SET is_pm_enabled = ? WHERE char_name = ?', [player.isPMEnabled ? 1 : 0, player.charName], (err) => {
            if (err) {
                console.error(err);
                player.outputChatBox('!{#E74C3C}Įvyko klaida atnaujinant jūsų privačias žinutes.');
            }
        });
        return;
    }
});

mp.events.add('updateServerTime', () => {
    let vilniusTime = moment().tz("Europe/Vilnius").format("HH:mm");
    mp.players.forEach(player => {
        player.call('updateServerTime', [vilniusTime]);
    });
});

const ATMsAndBanks = [
    { x: -57.83, y: -92.48, z: 57.78 },
];

function isNearATMOrBank(player) {
    for (let i = 0; i < ATMsAndBanks.length; i++) {
        const atm = ATMsAndBanks[i];
        const distance = Math.sqrt(
            Math.pow(player.position.x - atm.x, 2) +
            Math.pow(player.position.y - atm.y, 2) +
            Math.pow(player.position.z - atm.z, 2)
        );
        if (distance < 5) {
            return true;
        }
    }
    return false;
}

mp.events.addCommand('bank', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!isNearATMOrBank(player)) {
        player.outputChatBox('!{#e74c3c}Neesate šalia banko ar bankomato.');
        return;
    }

    db.query('SELECT transaction_type, amount, date FROM bank_transactions WHERE char_name = ? ORDER BY date DESC LIMIT 5', [player.charName], (err, results) => {
        if (err) return;

        player.call('openBankUI', [player.bankBalance, JSON.stringify(results)]);
    });
});

mp.events.add('bankAction', (player, type, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) {
        player.call('bankError', ['Įveskite teisingą sumą.']);
        return;
    }

    if (type === 'withdraw') {
        if (player.bankBalance >= amount) {
            player.bankBalance -= amount;
            player.money += amount;
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
            db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, ?, ?, NOW())', [player.charName, 'withdraw', amount]);
            player.call('updateBankUI', [player.bankBalance, player.money]);
            player.call('updateMoneyHUD', [player.money]);
        } else {
            player.call('bankError', ['Nepakanka lėšų sąskaitoje.']);
        }
    } else if (type === 'deposit') {
        if (player.money >= amount) {
            player.money -= amount;
            player.bankBalance += amount;
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
            db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, ?, ?, NOW())', [player.charName, 'deposit', amount]);
            player.call('updateBankUI', [player.bankBalance, player.money]);
            player.call('updateMoneyHUD', [player.money]);
        } else {
            player.call('bankError', ['Neturite pakankamai grynųjų pinigų.']);
        }
    }
});

mp.events.addCommand('withdraw', (player, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!isNearATMOrBank(player)) {
        player.outputChatBox('!{#e74c3c}Neesate šalia banko ar bankomato.');
        return;
    }

    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) return player.outputChatBox("Naudojimas: /withdraw [suma]");

    if (player.bankBalance >= amount) {
        player.bankBalance -= amount;
        player.money += amount;

        db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
        db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);

        player.call('updateBankHUD', [player.bankBalance]);
        player.call('updateMoneyHUD', [player.money]);

        player.outputChatBox(`!{#229954}Jūs išsigryninote $${amount} iš banko.`);
    } else {
        player.outputChatBox("!{#FF0000}Jūsų banko sąskaitoje nėra pakankamai pinigų.");
    }
});

mp.events.addCommand('deposit', (player, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!isNearATMOrBank(player)) {
        player.outputChatBox('!{#e74c3c}Neesate šalia banko ar bankomato.');
        return;
    }

    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) return player.outputChatBox("Naudojimas: /deposit [suma]");

    if (player.money >= amount) {
        player.money -= amount;
        player.bankBalance += amount;

        db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
        db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);

        player.call('updateBankHUD', [player.bankBalance]);
        player.call('updateMoneyHUD', [player.money]);

        player.outputChatBox(`!{#229954}Jūs įnešėte $${amount} į banko sąskaitą.`);
    } else {
        player.outputChatBox("!{#FF0000}Neturite pakankamai grynųjų pinigų.");
    }
});

mp.events.addCommand('transfer', (player, fullText, targetName, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    amount = parseInt(amount);
    if (!targetName || isNaN(amount) || amount <= 0) return player.outputChatBox("Naudojimas: /transfer [gavėjo vardas] [suma]");

    db.query('SELECT * FROM bank_accounts WHERE char_name = ?', [targetName], (err, results) => {
        if (err || results.length === 0) {
            return player.outputChatBox("!{#FF0000}Gavėjo sąskaita nerasta.");
        }

        if (player.bankBalance >= amount) {
            player.bankBalance -= amount;
            let targetBalance = results[0].balance + amount;

            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [targetBalance, targetName]);

            player.call('updateBankHUD', [player.bankBalance]);
            player.outputChatBox(`!{#229954}Jūs pervedėte $${amount} žaidėjui ${targetName}.`);

            let target = mp.players.toArray().find(p => p.charName === targetName);
            if (target) {
                target.call('updateBankHUD', [targetBalance]);
                target.outputChatBox(`!{#229954}Jūs gavote $${amount} iš ${player.charName}.`);
            }
        } else {
            player.outputChatBox("!{#FF0000}Jūsų banko sąskaitoje nėra pakankamai pinigų.");
        }
    });
});

// Admin Commands
function getAdminLevel(player, callback) {
    if (!player.charName) return callback(null, 0);
    db.query('SELECT admin_level FROM characters WHERE char_name = ?', [player.charName], (error, results) => {
        if (error) return callback(error, null);
        if (results.length > 0) {
            return callback(null, results[0].admin_level);
        }
        return callback(null, 0);
    });
}

function isAdmin(player, level, callback) {
    getAdminLevel(player, (error, adminLevel) => {
        if (error) return callback(error, false);
        return callback(null, adminLevel >= level);
    });
}

function getPlayerByIDOrName(identifier) {
    if (!identifier) return null;

    const numericId = Number(identifier);
    if (!isNaN(numericId) && Number.isInteger(numericId)) {
        const byId = mp.players.toArray().find(p => p.id === numericId);
        if (byId) return byId;
    }

    const byNameExact = mp.players.toArray().find(p => p.charName && p.charName.toLowerCase() === identifier.toLowerCase());
    if (byNameExact) return byNameExact;

    // Fallback to partial match
    return mp.players.toArray().find(p => p.charName && p.charName.toLowerCase().includes(identifier.toLowerCase()));
}

function sendUsageInstructions(player, command) {
    const instructions = {
        'kick': "[KICK] Naudojimas: /kick [ID arba vardas] - Išmesti žaidėją.",
        'freeze': "[FREEZE] Naudojimas: /freeze [ID arba vardas] - Užšaldyti žaidėją.",
        'goto': "[GOTO] Naudojimas: /goto [ID arba vardas] - Eiti pas žaidėją.",
        'bring': "[BRING] Naudojimas: /bring [ID arba vardas] - Atnešti žaidėją pas tave.",
        'ban': "[BAN] Naudojimas: /ban [ID arba vardas] [Priežastis] - Užblokuoti žaidėją.",
    };
    player.outputChatBox(instructions[command] || "Netinkamas komandos pavadinimas.");
}

mp.events.addCommand('kick', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'kick');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");
        target.kick("Buvo išmestas administratoriaus.");
    });
});

mp.events.addCommand('freeze', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'freeze');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");

        if (target.frozen) {
            target.call('freezePlayer', [false]);
            target.frozen = false;
            player.outputChatBox(`[INFO] Atšaldėte žaidėją ${target.charName || target.name}.`);
        } else {
            target.call('freezePlayer', [true]);
            target.frozen = true;
            player.outputChatBox(`[INFO] Užšaldėte žaidėją ${target.charName || target.name}.`);
        }
    });
});

mp.events.addCommand('goto', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'goto');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");
        player.position = target.position;
    });
});

mp.events.addCommand('bring', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'bring');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");
        target.position = player.position;
    });
});

mp.events.addCommand('ban', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!fullText) {
        return sendUsageInstructions(player, 'ban');
    }

    const args = fullText.split(" ");
    const targetIdentifier = args[0];
    const reason = args.slice(1).join(" ") || "Nenurodyta priežastis";

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");

        const ip = target.ip;
        db.query('INSERT INTO bans (ip, reason, admin) VALUES (?, ?, ?)', [ip, reason, player.charName], (error) => {
            if (error) return player.outputChatBox("[KLAIDA] Įvyko klaida bandant užblokuoti žaidėją.");

            target.kick(`Buvo užblokuotas. Priežastis: ${reason}`);
            player.outputChatBox(`[INFO] Jūs užblokavote žaidėją ${target.charName || target.name} (IP: ${ip}). Priežastis: ${reason}`);
            mp.players.broadcast(`[INFO] Žaidėjas ${target.charName || target.name} buvo užblokuotas. Priežastis: ${reason}`);
        });
    });
});

const activeHelpRequests = new Map();

async function getAdminLevelFromDB(player) {
    return new Promise((resolve, reject) => {
        if (!player.charName) return resolve(0);
        const query = "SELECT admin_level FROM characters WHERE char_name = ?";
        db.query(query, [player.charName], (err, results) => {
            if (err) {
                console.error("Klaida tikrinant admin lygį:", err);
                resolve(0);
            } else {
                resolve(results.length > 0 ? results[0]["admin_level"] : 0);
            }
        });
    });
}

mp.events.addCommand('helpme', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!fullText) {
        player.outputChatBox("[HELP] Naudojimas: /helpme <klausimas>");
        return;
    }

    if (activeHelpRequests.has(player.id)) {
        player.outputChatBox("[HELP] Jūs jau pateikėte pagalbos prašymą. Palaukite administratoriaus atsakymo.");
        return;
    }

    activeHelpRequests.set(player.id, fullText);

    mp.players.forEach(async (admin) => {
        const adminLevel = await getAdminLevelFromDB(admin);
        if (adminLevel === 1 || adminLevel === 2) {
            admin.outputChatBox(`!{#ADD8E6}[HELP] ${player.charName} (${player.id}): ${fullText} - priimti su /accepthelp ${player.id}`);
        }
    });

    player.outputChatBox("[HELP] Jūsų pagalbos prašymas buvo išsiųstas administratoriams.");
});

mp.events.addCommand('accepthelp', async (admin, playerId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        admin.outputChatBox("[HELP] Jūs nesate administratorius.");
        return;
    }

    const target = getPlayerByIDOrName(playerId);
    if (!target) {
        admin.outputChatBox("[HELP] Žaidėjas nerastas.");
        return;
    }

    if (!activeHelpRequests.has(target.id)) {
        admin.outputChatBox("[HELP] Šis žaidėjas nepateikė pagalbos prašymo.");
        return;
    }

    activeHelpRequests.delete(target.id);
    target.outputChatBox(`!{#7aa164}[HELP] Administratorius ${admin.charName} jums padės.`);
    admin.outputChatBox(`[HELP] Jūs priėmėte ${target.charName || target.name} (${target.id}) pagalbos prašymą.`);
});

mp.events.addCommand('declinehelp', async (admin, playerId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        admin.outputChatBox("[HELP] Jūs nesate administratorius.");
        return;
    }

    const target = getPlayerByIDOrName(playerId);
    if (!target) {
        admin.outputChatBox("[HELP] Žaidėjas nerastas.");
        return;
    }

    if (!activeHelpRequests.has(target.id)) {
        admin.outputChatBox("[HELP] Šis žaidėjas nepateikė pagalbos prašymo.");
        return;
    }

    activeHelpRequests.delete(target.id);
    target.outputChatBox(`!{#cd5d3c}[HELP] Administratorius ${admin.charName} atmetė jūsų pagalbos prašymą.`);
    admin.outputChatBox(`[HELP] Jūs atmetėte ${target.charName || target.name} (${target.id}) pagalbos prašymą.`);
});

const reports = new Map();

mp.events.addCommand("report", async (player, fullText, targetId, ...reasonArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetId || reasonArray.length === 0) {
        return player.outputChatBox("Naudojimas: /report [žaidėjo ID] [priežastis]");
    }
    if (reports.has(player.id)) {
        return player.outputChatBox("Jūsų reportas jau laukia administratorių sprendimo.");
    }

    const target = getPlayerByIDOrName(targetId);
    if (!target) {
        return player.outputChatBox("Žaidėjas su tokiu ID nerastas.");
    }

    if (!target.charName) {
        return player.outputChatBox("Žaidėjas dar nepasirinko veikėjo.");
    }

    const reason = reasonArray.join(" ");
    reports.set(player.id, { player, target, reason });

    mp.players.forEach(async (admin) => {
        const adminLvl = await getAdminLevelFromDB(admin);
        if (adminLvl >= 1) {
            admin.outputChatBox(`!{#f0e237}[REPORT] ${player.charName} pranešė apie ${target.charName}: ${reason} (ID: ${player.id})`);
        }
    });

    player.outputChatBox("Jūsų reportas buvo išsiųstas administracijai.");
});

mp.events.addCommand("acceptreport", async (admin, fullText, reportId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        return admin.outputChatBox("Neturite teisių naudoti šią komandą.");
    }
    if (!reportId || !reports.has(parseInt(reportId))) {
        return admin.outputChatBox("Neteisingas reporto ID.");
    }

    const report = reports.get(parseInt(reportId));
    reports.delete(parseInt(reportId));

    report.player.outputChatBox(`!{#7aa164}Jūsų report buvo priimtas administratoriaus ${admin.charName}.`);
    mp.players.forEach(async adminPlayer => {
        const adminLevel = await getAdminLevelFromDB(adminPlayer);
        if (adminLevel >= 1) {
            adminPlayer.outputChatBox(`[REPORT] ${admin.charName} priėmė ${report.player.charName} reportą prieš ${report.target.charName}.`);
        }
    });
});

mp.events.addCommand("declinereport", async (admin, fullText, reportId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        return admin.outputChatBox("Neturite teisių naudoti šią komandą.");
    }
    if (!reportId || !reports.has(parseInt(reportId))) {
        return admin.outputChatBox("Neteisingas reporto ID.");
    }

    const report = reports.get(parseInt(reportId));
    reports.delete(parseInt(reportId));

    report.player.outputChatBox("!{#cd5d3c}Jūsų report buvo atmestas administratoriaus.");
    admin.outputChatBox(`[REPORT] Jūs atmetėte ${report.player.charName} reportą prieš ${report.target.charName}.`);
});


// /admins command - List all online admins (level 1 or 2)
mp.events.addCommand('admins', (player) => {
    const onlineAdmins = mp.players.toArray().filter(p => p.adminLevel >= 1 && p.adminLevel <= 2);

    if (onlineAdmins.length === 0) {
        player.outputChatBox('!{#f7dc6f}Šiuo metu nėra prisijungusių administratorių.');
        return;
    }

    player.outputChatBox('!{#f7dc6f}===== Prisijungę Administratoriai =====');
    onlineAdmins.forEach(admin => {
        const adminLevelText = admin.adminLevel === 1 ? 'Administratorius' : 'Vadovybė';
        player.outputChatBox(`[${adminLevelText}] ${admin.adminName} (ID: ${admin.id})`);
    });
    player.outputChatBox('!{#f7dc6f}=====================================');
});

// /setaname command - Set admin name for display in /admins
mp.events.addCommand('setaname', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!fullText) {
        player.outputChatBox('Naudojimas: /setaname [admin vardas]');
        return;
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        const newAdminName = fullText.trim();
        if (newAdminName.length < 3 || newAdminName.length > 20) {
            player.outputChatBox('!{#e74c3c}Admin vardas turi būti nuo 3 iki 20 simbolių.');
            return;
        }

        // Update admin_name in the database
        db.query('UPDATE characters SET admin_name = ? WHERE char_name = ?', [newAdminName, player.charName], (err) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko atnaujinti admin vardo:', err);
                player.outputChatBox('!{#e74c3c}Įvyko klaida keičiant admin vardą.');
                return;
            }

            player.adminName = newAdminName;
            player.outputChatBox(`!{#7aa164}Jūsų admin vardas nustatytas: ${newAdminName}`);
        });
    });
});

mp.events.addCommand('changechar', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    // Save current character data
    saveCharacterData(player);
    console.log(`[DEBUG] Saved data for ${player.charName}`);

    // Clear timers
    if (player.timer) {
        clearInterval(player.timer);
        delete player.timer;
    }
    if (player.saveTimer) {
        clearInterval(player.saveTimer);
        delete player.saveTimer;
    }
    if (playerTimeInfo[player.id] && playerTimeInfo[player.id].interval) {
        clearInterval(playerTimeInfo[player.id].interval);
        delete playerTimeInfo[player.id];
    }
    console.log('[DEBUG] Cleared timers');

    // Reset character-specific data
    player.charId = null;
    player.charName = null;
    player.adminName = null;
    player.health = 100;
    player.money = 0;
    player.bankBalance = 0;
    player.playtime = 0;
    player.isPMEnabled = true;
    player.adminLevel = 0;
    player.contacts = null;
    player.phoneNumber = null;
    player.isPhoneOpen = false;

    // Hide HUD elements
    player.call('updateMoneyHUD', [0]);
    player.call('updateBankHUD', [0]);
    player.call('updatePhoneNumber', ['']);
    console.log('[DEBUG] Reset character data and HUD');

    // Hide player and freeze (matches client-side hidePlayerModel)
    player.call('hidePlayerModel');
    console.log('[DEBUG] Called hidePlayerModel');

    // Load character selection UI
    loadCharacterSelection(player);
    player.outputChatBox('!{#f7dc6f}Jūs atsijungėte nuo veikėjo. Pasirinkite naują veikėją.');
    console.log('[DEBUG] Called loadCharacterSelection');
});




mp.events.addCommand('coords', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const coords = player.position;
    player.outputChatBox(`Current Coordinates: X: ${coords.x.toFixed(2)}, Y: ${coords.y.toFixed(2)}, Z: ${coords.z.toFixed(2)}`);
});

mp.events.addCommand('createtwittertables', (player) => {
    if (!player.charName) return;
    db.query(`CREATE TABLE IF NOT EXISTS twitter_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        char_id INT NOT NULL,
        handle VARCHAR(50) UNIQUE NOT NULL,
        FOREIGN KEY (char_id) REFERENCES characters(id)
    )`, (err) => {
        if (err) console.error('Error creating twitter_accounts table:', err);
        else console.log('Twitter accounts table ready.');
    });
    db.query(`CREATE TABLE IF NOT EXISTS twitter_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        handle VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating twitter_posts table:', err);
        else console.log('Twitter posts table ready.');
    });
    player.outputChatBox('Twitter tables created.');
});





// TAXI and PHONE

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System


mp.events.addCommand('ph', (player) => openPhone(player));
mp.events.addCommand('phone', (player) => openPhone(player));

// Server-side
// ==================== OPEN PHONE FUNCTION (FIXED) ====================


// ==================== DRIVE / PAVEŽĖJŲ SISTEMA (CLEAN & FIXED) ====================

function openPhone(player) {
    if (!player.charName) {
        return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    }

    let callStatus = 'idle';
    let callPartner = null;

    if (activeCalls.has(player.id)) {
        const callData = activeCalls.get(player.id);
        callStatus = callData.status || 'idle';
        callPartner = callData.caller === player
            ? (callData.target ? callData.target.charName : null)
            : (callData.caller ? callData.caller.charName : null);
    }

    const isDriver = activeDrivers.has(player.id);
    const contacts = player.contacts || [];

    console.log(`[PHONE] Opening phone for ${player.charName} | Driver: ${isDriver} | Status: ${callStatus}`);

    player.call('openPhoneUI', [
        isDriver,
        player.phoneNumber || '',
        callStatus,
        callPartner || '',
        JSON.stringify(contacts)
    ]);
}

// Toggle driver status
mp.events.add('toggleDriverStatus', (player) => {
    if (!player.charName) return;

    if (activeDrivers.has(player.id)) {
        activeDrivers.delete(player.id);
        player.outputChatBox('!{#cd5d3c}Jūs nebesate Drive vairuotojas.');
        player.call('updateDriverStatus', [false]);
    } else {
        if (!player.vehicle) {
            return player.outputChatBox('!{#e74c3c}Jums reikia būti transporto priemonėje!');
        }
        activeDrivers.set(player.id, { player, status: "available" });
        player.outputChatBox('!{#7aa164}Jūs tapote Drive vairuotoju!');
        player.call('updateDriverStatus', [true]);
    }
});

// Request ride
mp.events.add('requestRide', (player) => {
    if (!player.charName) return;
    if (activeRides.has(player.id)) {
        return player.outputChatBox('!{#e74c3c}Jūs jau turite aktyvią kelionę!');
    }

    if (activeDrivers.size === 0) {
        return player.outputChatBox('!{#f7dc6f}Šiuo metu nėra laisvų vairuotojų.');
    }

    activeRides.set(player.id, {
        requester: player,
        driver: null,
        blip: null,
        interval: null
    });

    activeDrivers.forEach((data) => {
        if (data.status === "available") {
            const dist = player.position.distanceTo(data.player.position);
            if (dist < 700) {
                data.player.outputChatBox(`!{#f7dc6f}[Drive] ${player.charName} ieško pavežėjimo! /acceptdrive ${player.id}`);
            }
        }
    });

    player.outputChatBox('!{#7aa164}Užklausa išsiųsta vairuotojams...');
});

// Accept ride command
mp.events.addCommand('acceptdrive', (driver, requesterIdStr) => {
    if (!driver.charName || !activeDrivers.has(driver.id)) {
        return driver.outputChatBox('!{#e74c3c}Jūs nesate aktyvus vairuotojas!');
    }

    const reqId = parseInt(requesterIdStr);
    if (!activeRides.has(reqId)) {
        return driver.outputChatBox('!{#f7dc6f}Užklausa nebegalioja.');
    }

    const ride = activeRides.get(reqId);
    if (ride.driver) {
        return driver.outputChatBox('!{#e74c3c}Šią užklausą jau priėmė kitas vairuotojas.');
    }

    ride.driver = driver;
    activeDrivers.get(driver.id).status = "busy";

    ride.blip = mp.blips.new(1, ride.requester.position, {
        name: `Keleivis: ${ride.requester.charName}`,
        color: 2,
        scale: 1.2
    });

    driver.outputChatBox(`!{#7aa164}Priėmėte ${ride.requester.charName}! Važiuokite jo pasiimti.`);
    ride.requester.outputChatBox(`!{#7aa164}Vairuotojas ${driver.charName} priėmė jūsų užklausą!`);

    ride.interval = setInterval(() => {
        if (!ride.driver || !ride.requester) {
            clearInterval(ride.interval);
            return;
        }
        const dist = ride.driver.position.distanceTo(ride.requester.position);
        if (dist <= 12) {
            clearInterval(ride.interval);
            ride.driver.outputChatBox('!{#7aa164}✅ Jūs pasiekėte keleivį!');
            ride.requester.outputChatBox('!{#7aa164}✅ Vairuotojas atvyko pas jus!');
        }
    }, 2000);
});

// Tracks ongoing calls: { callerId: { caller, target, status } }

// /call command
mp.events.addCommand('call', (player, phoneNumber) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!phoneNumber) return player.outputChatBox('Naudojimas: /call [telefono numeris]');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio.');
    if (activeCalls.has(player.id)) return player.outputChatBox('!{#e74c3c}Jūs jau esate skambutyje arba laukiate atsakymo.');

    const target = mp.players.toArray().find(p => p.phoneNumber === phoneNumber);
    if (!target || !target.charName) {
        player.call('callFailed', 'Šis telefono numeris nerastas arba žaidėjas neprisijungęs.');
        return player.outputChatBox('!{#f7dc6f}Šis telefono numeris nerastas arba žaidėjas neprisijungęs.');
    }

    if (target.id === player.id) {
        player.call('callFailed', 'Negalite skambinti sau!');
        return player.outputChatBox('!{#e74c3c}Negalite skambinti sau!');
    }

    if (!startCall(player, target)) {
        player.call('callFailed', 'Skambutis negali būti pradėtas.');
        return player.outputChatBox('!{#e74c3c}Skambutis negali būti pradėtas.');
    }
});

// /answer command
mp.events.addCommand('answer', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    const callRequest = activeCalls.get(player.id);
    if (!callRequest || callRequest.status !== 'incoming') {
        return player.outputChatBox('!{#f7dc6f}Šiuo metu jums niekas neskambina.');
    }

    const caller = callRequest.caller;
    const activeCallData = { caller, target: player, status: 'active' };
    activeCalls.set(player.id, activeCallData);
    activeCalls.set(caller.id, activeCallData);

    player.outputChatBox(`!{#7aa164}Jūs priėmėte skambutį iš ${caller.charName}.`);
    caller.outputChatBox(`!{#7aa164}${player.charName} priėmė jūsų skambutį.`);
    player.call('callStarted', [caller.charName, caller.phoneNumber]); // Update phone UI
    caller.call('callStarted', [player.charName, player.phoneNumber]); // Update caller's phone UI
});

// /decline command
mp.events.addCommand('decline', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    const callRequest = activeCalls.get(player.id);
    if (!callRequest || callRequest.status !== 'incoming') {
        return player.outputChatBox('!{#f7dc6f}Šiuo metu jums niekas neskambina.');
    }

    const caller = callRequest.caller;
    activeCalls.delete(player.id);
    activeCalls.delete(caller.id);

    player.outputChatBox(`!{#cd5d3c}Jūs atmetėte skambutį iš ${caller.charName}.`);
    caller.outputChatBox(`!{#cd5d3c}${player.charName} atmetė jūsų skambutį.`);
    player.call('callEnded');
    caller.call('callEnded');
});

// Handle player disconnect
mp.events.add('playerQuit', (player) => {
    // Character timers
    if (player.timer) {
        clearInterval(player.timer);
        delete player.timer;
    }

    if (player.saveTimer) {
        clearInterval(player.saveTimer);
        delete player.saveTimer;
    }

    if (playerTimeInfo[player.id] && playerTimeInfo[player.id].interval) {
        clearInterval(playerTimeInfo[player.id].interval);
        delete playerTimeInfo[player.id];
    }

    // Save current character state
    saveCharacterData(player);

    // Clean up driver/ride state
    if (activeDrivers.has(player.id)) {
        activeDrivers.delete(player.id);
    }

    for (const [requesterId, ride] of activeRides.entries()) {
        if (!ride) continue;
        if ((ride.requester && ride.requester.id === player.id) || (ride.driver && ride.driver.id === player.id)) {
            if (ride.interval) clearInterval(ride.interval);
            if (ride.blip) ride.blip.destroy();
            if (ride.requester && ride.requester.id !== player.id) {
                ride.requester.outputChatBox('!{#e74c3c}Jūsų užsakymas atšauktas, vairuotojas išjungėsi.');
            }
            if (ride.driver && ride.driver.id !== player.id) {
                ride.driver.outputChatBox('!{#e74c3c}Kelionė nutraukta, keleivis atsijungė.');
            }
            activeRides.delete(requesterId);
        }
    }

    // Clean up phone state
    player.contacts = null;
    player.isPhoneOpen = false;

    // Handle active calls
    if (activeCalls.has(player.id)) {
        const callData = activeCalls.get(player.id);
        const partner = (callData.caller && callData.caller.id === player.id) ? callData.target : callData.caller;

        if (partner) {
            partner.outputChatBox(`!{#cd5d3c}${player.charName || player.name} atsijungė, skambutis baigtas.`);
            partner.call('callEnded');
            activeCalls.delete(partner.id);
        }

        activeCalls.delete(player.id);
    }

    // Notify if player had a ringing incoming call not found by key
    const ringingIncoming = Array.from(activeCalls.values()).find(c => c.target && c.target.id === player.id && c.status === 'ringing');
    if (ringingIncoming && ringingIncoming.caller) {
        ringingIncoming.caller.outputChatBox(`!{#cd5d3c}${player.charName || player.name} atsijungė, skambutis atšauktas.`);
        ringingIncoming.caller.call('callEnded');
        activeCalls.delete(ringingIncoming.caller.id);
    }

    if (player.charId) {
        player.outputChatBox('!{#f7dc6f}Jūsų veikėjo duomenys išsaugoti. Iki pasimatymo!');
    } else {
        console.log(`[INFO] Žaidėjas ${player.name} atsijungė be pasirinkto veikėjo.`);
    }
});

mp.events.add('callFromUI', (player, phoneNumber) => {
    if (!/^\d+$/.test(phoneNumber)) {
        player.call('callFailed', 'Numeris turi būti tik skaitmenys!');
        return player.outputChatBox('!{#e74c3c}Numeris turi būti tik skaitmenys!');
    }
    mp.events.call('call', player, phoneNumber);
});



// Server-side
mp.events.add('openPhoneUI', (player, isDriver) => {
    if (!player.charId) {
        player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
        return;
    }
    const contacts = player.contacts || [];
    player.isPhoneOpen = true;
    console.log(`[DEBUG] Sending contacts to client for charId ${player.charId}:`, contacts);
    player.call('loadContacts', [JSON.stringify(contacts), isDriver, player.phoneNumber || 'Nėra numerio']);
});

// Add contact to database
mp.events.add('addContact', (player, name, number) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!/^\d+$/.test(number)) return player.outputChatBox('!{#e74c3c}Numeris turi būti tik skaitmenys!');

    db.query('SELECT COUNT(*) as count FROM contacts WHERE char_id = ?', [player.charId], (err, countResult) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko patikrinti kontaktų skaičiaus:', err);
            return player.outputChatBox('!{#e74c3c}Klaida pridedant kontaktą.');
        }

        if (countResult[0].count >= 50) {
            return player.outputChatBox('!{#e74c3c}Jūsų kontaktų sąrašas pilnas!');
        }

        db.query('SELECT * FROM contacts WHERE char_id = ? AND contact_number = ?', [player.charId, number], (err, results) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko patikrinti kontakto:', err);
                return player.outputChatBox('!{#e74c3c}Klaida pridedant kontaktą.');
            }

            if (results.length > 0) {
                return player.outputChatBox('!{#e74c3c}Šis numeris jau yra jūsų kontaktuose!');
            }

            db.query('INSERT INTO contacts (char_id, contact_name, contact_number) VALUES (?, ?, ?)',
                [player.charId, name, number], (err) => {
                    if (err) {
                        console.error('[KLAIDA] Nepavyko pridėti kontakto:', err);
                        return player.outputChatBox('!{#e74c3c}Klaida pridedant kontaktą.');
                    }

                    loadCharacterContacts(player);
                    player.outputChatBox(`!{#7aa164}Pridėtas kontaktas: ${name} (${number})`);
                });
        });
    });
});

// Remove contact from database
mp.events.add('removeContact', (player, number) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    db.query('DELETE FROM contacts WHERE char_id = ? AND contact_number = ?', [player.charId, number], (err, result) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko pašalinti kontakto:', err);
            return player.outputChatBox('!{#e74c3c}Klaida šalinant kontaktą.');
        }

        if (result.affectedRows === 0) return;

        loadCharacterContacts(player);
        const removedContact = (player.contacts || []).find(c => c.number === number);
        if (removedContact) {
            player.outputChatBox(`!{#cd5d3c}Pašalintas kontaktas: ${removedContact.name}`);
        }
    });
});

// Call contact (unchanged)
mp.events.add('callContact', (player, number) => {
    mp.events.call('call', player, number); // No length restriction needed
});

// Update /sharenumber command
mp.events.addCommand('sharenumber', (player, fullText, targetId, contactName) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetId || !contactName) {
        return player.outputChatBox('Naudojimas: /sharenumber [ID] [vardas]');
    }

    const target = mp.players.at(parseInt(targetId));
    if (!target) {
        return player.outputChatBox('!{#e74c3c}Žaidėjas nerastas!');
    }
    if (!target.charId) {
        return player.outputChatBox('!{#e74c3c}Žaidėjas dar nepasirinko veikėjo.');
    }
    if (!player.phoneNumber) {
        return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');
    }

    db.query('SELECT * FROM contacts WHERE char_id = ? AND contact_number = ?', [target.charId, player.phoneNumber], (err, results) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko patikrinti kontakto:', err);
            return player.outputChatBox('!{#e74c3c}Klaida dalinantis numeriu.');
        }

        if (results.length > 0) {
            return player.outputChatBox('!{#e74c3c}Jūsų numeris jau yra šio žaidėjo kontaktuose!');
        }

        db.query('INSERT INTO contacts (char_id, contact_name, contact_number) VALUES (?, ?, ?)',
            [target.charId, contactName, player.phoneNumber], (err) => {
                if (err) {
                    console.error('[KLAIDA] Nepavyko pridėti kontakto:', err);
                    return player.outputChatBox('!{#e74c3c}Klaida dalinantis numeriu.');
                }

                loadCharacterContacts(target);
                player.outputChatBox(`!{#7aa164}Jūs pasidalinote savo numeriu su ${target.charName} kaip ${contactName}`);
                target.outputChatBox(`!{#7aa164}${player.charName} pridėjo jus į kontaktus kaip ${contactName} (${player.phoneNumber})`);
            });
    });
});

mp.events.add('call', (player, number) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');

    const target = mp.players.toArray().find(p => p.phoneNumber === number);
    if (!target) {
        player.outputChatBox('!{#e74c3c}Numeris nepasiekiamas arba neegzistuoja!');
        return;
    }
    if (!target.charName) {
        player.outputChatBox('!{#e74c3c}Šis žaidėjas dar nepasirinko veikėjo!');
        return;
    }
    if (activeCalls.has(target.id)) {
        player.outputChatBox('!{#e74c3c}Šis numeris šiuo metu užimtas!');
        return;
    }

    if (!startCall(player, target)) {
        player.outputChatBox('!{#e74c3c}Skambutis negali būti pradėtas.');
    }
});

mp.events.add('acceptCall', (player) => {
    if (!activeCalls.has(player.id) || activeCalls.get(player.id).status !== 'incoming') {
        player.outputChatBox('!{#e74c3c}Nėra gaunamo skambučio!');
        return;
    }

    const callData = activeCalls.get(player.id);
    const caller = callData.caller;

    activeCalls.set(player.id, { caller: caller, target: player, status: 'active' });
    activeCalls.set(caller.id, { caller: caller, target: player, status: 'active' });

    player.outputChatBox(`!{#7aa164}Jūs priėmėte skambutį nuo ${caller.charName}!`);
    caller.outputChatBox(`!{#7aa164}${player.charName} priėmė jūsų skambutį!`);
    player.call('callStarted', [caller.charName, caller.phoneNumber]);
    caller.call('callStarted', [player.charName, player.phoneNumber]);
});

mp.events.add('declineCall', (player) => {
    if (!activeCalls.has(player.id) || activeCalls.get(player.id).status !== 'incoming') {
        player.outputChatBox('!{#e74c3c}Nėra gaunamo skambučio!');
        return;
    }

    const callData = activeCalls.get(player.id);
    const caller = callData.caller;

    activeCalls.delete(player.id);
    activeCalls.delete(caller.id);

    player.outputChatBox(`!{#7aa164}Jūs atmetėte skambutį nuo ${caller.charName}.`);
    caller.outputChatBox(`!{#e74c3c}${player.charName} atmetė jūsų skambutį.`);
    player.call('callEnded');
    caller.call('callEnded');
});

mp.events.addCommand('hangup', (player) => {
    if (!activeCalls.has(player.id)) {
        player.outputChatBox('!{#e74c3c}Jūs nesate skambutyje!');
        return;
    }

    const callData = activeCalls.get(player.id);
    const partner = (callData.caller && callData.caller.id === player.id) ? callData.target : callData.caller;

    activeCalls.delete(player.id);
    if (partner && activeCalls.has(partner.id)) {
        activeCalls.delete(partner.id);
        partner.outputChatBox('!{#e74c3c}Skambutis baigtas kitos pusės.');
        partner.call('callEnded');
    }

    player.outputChatBox('!{#7aa164}Jūs baigėte skambutį.');
    player.call('callEnded');
    console.log(`[DEBUG] Call ended by ${player.charName}`);
});






// Send a message from the phone UI
// Send a message from the phone UI
// ==================== SMS / MESSAGES SYSTEM ====================

const messageCooldowns = new Map(); // Anti-spam protection
const MAX_MESSAGES_PER_MINUTE = 30;
const COOLDOWN_PERIOD = 60000;


// Helper: Send notification when someone receives a message (Phone popup only)
function sendMessageNotification(recipient, senderNumber, senderName, messageText) {
    if (!recipient || !recipient.phoneNumber) return;

    // Trigger the nice notification popup on the phone (even if closed)
    recipient.call('newMessageNotification', [senderNumber, senderName, messageText]);

    // Refresh messages/conversations if phone is open
    if (recipient.isPhoneOpen) {
        loadConversationsForPlayer(recipient);
        loadMessagesForPlayer(recipient, senderNumber);
    }
}

// /sms command (from chat)
mp.events.addCommand('sms', (player, fullText, targetNumber, ...messageArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');
    if (!targetNumber || messageArray.length === 0) {
        return player.outputChatBox('Naudojimas: /sms [telefono numeris] [žinutė]');
    }

    const messageText = messageArray.join(' ');
    if (messageText.length > 500) {
        return player.outputChatBox('!{#e74c3c}Žinutė per ilga! Maksimumas 500 simbolių.');
    }

    // Anti-spam check
    const now = Date.now();
    let cooldown = messageCooldowns.get(player) || { last: 0, count: 0 };
    if (now - cooldown.last > COOLDOWN_PERIOD) {
        cooldown = { last: now, count: 1 };
    } else {
        cooldown.count++;
        if (cooldown.count > MAX_MESSAGES_PER_MINUTE) {
            return player.outputChatBox('!{#e74c3c}Per daug žinučių! Palaukite minutę.');
        }
    }
    messageCooldowns.set(player, cooldown);

    const target = mp.players.toArray().find(p => p.phoneNumber === targetNumber);

    // Save message to database
    db.query(
        'INSERT INTO messages (char_id, sender_number, recipient_number, message_text) VALUES (?, ?, ?, ?)',
        [player.charId, player.phoneNumber, targetNumber, messageText],
        (err) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko išsaugoti žinutės:', err);
                return player.outputChatBox('!{#e74c3c}Klaida siunčiant žinutę.');
            }

            player.outputChatBox(`!{#7aa164}Žinutė nusiųsta → ${targetNumber}${target ? ` (${target.charName})` : ' (neprisijungęs)'}`);

            // Send notification to recipient
            if (target && target !== player) {
                sendMessageNotification(target, player.phoneNumber, player.charName, messageText);
            }
        }
    );
});

// Send message from Phone UI
mp.events.add('sendMessage', (player, recipientNumber, messageText) => {
    console.log(`[DEBUG] Phone UI sendMessage: ${player.charName} → ${recipientNumber}`);

    if (!player.charName || !player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');
    if (!recipientNumber || !messageText || messageText.trim().length === 0) {
        return player.outputChatBox('!{#e74c3c}Įveskite gavėją ir žinutę!');
    }
    if (!/^\d+$/.test(recipientNumber)) {
        return player.outputChatBox('!{#e74c3c}Numeris turi būti tik skaitmenys!');
    }
    if (messageText.length > 500) {
        return player.outputChatBox('!{#e74c3c}Žinutė per ilga! (max 500 simbolių)');
    }

    // Anti-spam
    const now = Date.now();
    let cooldown = messageCooldowns.get(player) || { last: 0, count: 0 };
    if (now - cooldown.last > COOLDOWN_PERIOD) {
        cooldown = { last: now, count: 1 };
    } else {
        cooldown.count++;
        if (cooldown.count > MAX_MESSAGES_PER_MINUTE) {
            return player.outputChatBox('!{#e74c3c}Per daug žinučių! Palaukite minutę.');
        }
    }
    messageCooldowns.set(player, cooldown);

    const target = mp.players.toArray().find(p => p.phoneNumber === recipientNumber);

    // Save to database
    db.query(
        'INSERT INTO messages (char_id, sender_number, recipient_number, message_text) VALUES (?, ?, ?, ?)',
        [player.charId, player.phoneNumber, recipientNumber, messageText],
        (err) => {
            if (err) {
                console.error('[KLAIDA] Failed to save UI message:', err);
                return player.outputChatBox('!{#e74c3c}Klaida siunčiant žinutę.');
            }

            player.outputChatBox(`!{#7aa164}Žinutė nusiųsta → ${recipientNumber}${target ? ` (${target.charName})` : ''}`);

            // Notify the recipient
            if (target && target !== player) {
                sendMessageNotification(target, player.phoneNumber, player.charName, messageText);
            }

            // Refresh sender's own UI
            loadMessagesForPlayer(player, recipientNumber);
            loadConversationsForPlayer(player);
        }
    );
});

// Load messages for specific conversation
function loadMessagesForPlayer(player, otherNumber) {
    if (!player.charId || !player.phoneNumber) return;

    db.query(
        `SELECT sender_number, recipient_number, message_text, timestamp 
         FROM messages 
         WHERE (sender_number = ? AND recipient_number = ?) 
            OR (sender_number = ? AND recipient_number = ?) 
         ORDER BY timestamp ASC`,
        [player.phoneNumber, otherNumber, otherNumber, player.phoneNumber],
        (err, results) => {
            if (err) return console.error('[KLAIDA] Load messages error:', err);

            const messages = results.map(row => ({
                sender: row.sender_number,
                text: row.message_text,
                timestamp: row.timestamp.toISOString()
            }));

            player.call('updateMessagesUI', [otherNumber, JSON.stringify(messages)]);
        }
    );
}

// Load list of conversations
function loadConversationsForPlayer(player) {
    if (!player.charId || !player.phoneNumber) return;

    db.query(
        `SELECT DISTINCT 
            CASE WHEN sender_number = ? THEN recipient_number ELSE sender_number END AS contact_number 
         FROM messages 
         WHERE sender_number = ? OR recipient_number = ?`,
        [player.phoneNumber, player.phoneNumber, player.phoneNumber],
        (err, results) => {
            if (err) return console.error('[KLAIDA] Load conversations error:', err);

            const promises = results.map(row => {
                return new Promise(resolve => {
                    const number = row.contact_number;
                    db.query(
                        `SELECT sender_number, message_text, timestamp 
                         FROM messages 
                         WHERE (sender_number = ? AND recipient_number = ?) 
                            OR (sender_number = ? AND recipient_number = ?) 
                         ORDER BY timestamp DESC LIMIT 1`,
                        [player.phoneNumber, number, number, player.phoneNumber],
                        (err, msg) => {
                            if (err || !msg.length) return resolve(null);

                            const contactName = (player.contacts || []).find(c => c.number === number)?.name || number;

                            resolve({
                                number: number,
                                contactName: contactName,
                                lastMessage: msg[0].message_text,
                                timestamp: msg[0].timestamp.toISOString()
                            });
                        }
                    );
                });
            });

            Promise.all(promises).then(conversations => {
                const validConversations = conversations.filter(c => c !== null)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                player.call('updateConversationsUI', [JSON.stringify(validConversations)]);
            });
        }
    );
}

// Open Messages App
mp.events.add('openMessagesApp', (player) => {
    if (!player.charId) return;
    loadConversationsForPlayer(player);
});

mp.events.add('openConversation', (player, number) => {
    if (!player.charId) return;
    if (!/^\d+$/.test(number)) return;
    loadMessagesForPlayer(player, number);
});


// Request data when player opens Twitter app
mp.events.add('requestTwitterData', (player) => {
    console.log(`[TWITTER] requestTwitterData called for playerId=${player.id}, charId=${player.charId}`);

    const sendData = (handle) => {
        db.query(`
            SELECT t.handle, t.content, t.timestamp 
            FROM twitter_posts t 
            ORDER BY t.timestamp DESC LIMIT 10
        `, (err, tweets) => {
            if (err) {
                console.error('[TWITTER] Error fetching tweets:', err);
            }
            const tweetsJson = (!err && tweets) ? JSON.stringify(tweets) : '[]';
            console.log(`[TWITTER] send loadTwitterData handle=${handle || ''} tweetsCount=${(tweets && tweets.length) || 0}`);
            player.call('loadTwitterData', [handle || '', tweetsJson]);
        });
    };

    if (!player.charId) {
        console.log('[TWITTER] No charId, returning empty twitter data');
        sendData(null);
        return;
    }

    db.query('SELECT handle FROM twitter_accounts WHERE char_id = ?', [player.charId], (err, rows) => {
        if (err) {
            console.error('[TWITTER] Error fetching handle:', err);
            sendData(null);
            return;
        }
        const handle = (rows && rows.length > 0) ? rows[0].handle : null;
        sendData(handle);
    });
});

// Register unique handle
mp.events.add('registerTwitterHandle', (player, handle) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Pasirinkite veikėją!');
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
        return player.outputChatBox('!{#e74c3c}Leidžiami tik raidės, skaičiai ir _ !');
    }

    db.query('SELECT * FROM twitter_accounts WHERE handle = ?', [handle], (err, rows) => {
        if (rows.length > 0) {
            return player.outputChatBox('!{#e74c3c}Šis @slapyvardis jau užimtas!');
        }

        db.query('INSERT INTO twitter_accounts (char_id, handle) VALUES (?, ?)', [player.charId, handle], (err) => {
            if (err) return console.error(err);
            player.outputChatBox(`!{#7aa164}Jūsų @${handle} sėkmingai užregistruotas!`);
            player.call('twitterHandleRegistered', [handle]);
        });
    });
});

// Post a tweet
mp.events.add('postTweet', (player, content) => {
    if (!player.charId) return;

    if (content.length > 150) {
        return player.outputChatBox('!{#e74c3c}Skelbimas per ilgas! (max 150 simbolių)');
    }

    const now = Date.now();
    if (lastTweetTime.has(player.id) && now - lastTweetTime.get(player.id) < TWITTER_COOLDOWN) {
        const remaining = Math.ceil((TWITTER_COOLDOWN - (now - lastTweetTime.get(player.id))) / 60000);
        return player.outputChatBox(`!{#e74c3c}Galite skelbti tik kartą per valandą. Liko ${remaining} min.`);
    }

    db.query('SELECT handle FROM twitter_accounts WHERE char_id = ?', [player.charId], (err, rows) => {
        if (rows.length === 0) {
            return player.outputChatBox('!{#e74c3c}Pirmiausia užregistruokite @slapyvardį!');
        }

        const handle = rows[0].handle;

        // Check count, delete oldest if >=10
        db.query('SELECT COUNT(*) as count FROM twitter_posts', (err, results) => {
            if (err) return console.error(err);
            if (results[0].count >= 10) {
                db.query('DELETE FROM twitter_posts ORDER BY timestamp ASC LIMIT 1', (err) => {
                    if (err) return console.error(err);
                    insertTweet();
                });
            } else {
                insertTweet();
            }

            function insertTweet() {
                db.query('INSERT INTO twitter_posts (char_id, handle, content) VALUES (?, ?, ?)',
                    [player.charId, handle, content], (err) => {
                        if (err) return console.error(err);

                        lastTweetTime.set(player.id, now);
                        player.outputChatBox('!{#7aa164}Skelbimas paskelbtas visiems!');
                        player.call('twitterStatusUpdate', ['Skelbimas paskelbtas!', '#2ecc71']);

                        // Refresh feed for EVERYONE who has phone open
                        mp.players.forEach(p => {
                            if (p.isPhoneOpen) {
                                mp.events.call('requestTwitterData', p); // re-send fresh feed
                            }
                        });
                    });
            }
        });
    });
});


// ====================== MOBILE BANKING APP ======================

mp.events.add('openBankApp', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    // Get balance + last 5 transactions
    db.query(`
        SELECT balance FROM bank_accounts WHERE char_name = ?
    `, [player.charName], (err, balanceRes) => {
        if (err || balanceRes.length === 0) {
            return player.call('loadBankData', [0, player.charName, '[]']);
        }

        const balance = balanceRes[0].balance;

        db.query(`
            SELECT transaction_type, amount, date 
            FROM bank_transactions 
            WHERE char_name = ? 
            ORDER BY date DESC LIMIT 5
        `, [player.charName], (err, txRes) => {
            const transactions = txRes.map(t => ({
                type: t.transaction_type,
                amount: t.amount,
                date: t.date
            }));

            player.call('loadBankData', [
                balance,
                player.charName,
                JSON.stringify(transactions)
            ]);
        });
    });
});

mp.events.add('bankTransfer', (player, recipientName, amountStr) => {
    if (!player.charName) return;

    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
        return player.call('bankTransferResult', [false, 'Neteisinga suma!']);
    }

    // Check if sender has enough
    db.query('SELECT balance FROM bank_accounts WHERE char_name = ?', [player.charName], (err, senderRes) => {
        if (err || senderRes.length === 0) {
            console.log('[BANK] bankTransfer failed sender lookup', player.charName, recipientName, amount, err);
            return player.call('bankTransferResult', [false, 'Nepakanka lėšų sąskaitoje!']);
        }
        if (senderRes[0].balance < amount) {
            console.log('[BANK] bankTransfer insufficient balance', player.charName, recipientName, amount);
            return player.call('bankTransferResult', [false, 'Nepakanka lėšų sąskaitoje!']);
        }

        // Check recipient exists
        db.query('SELECT balance FROM bank_accounts WHERE char_name = ?', [recipientName], (err, targetRes) => {
            if (err || targetRes.length === 0) {
                console.log('[BANK] bankTransfer recipient not found', recipientName);
                return player.call('bankTransferResult', [false, 'Gavėjas nerastas!']);
            }

            // Only allow transfers to players who are currently online
            const recipientPlayer = mp.players.toArray().find(p => p.charName === recipientName);
            if (!recipientPlayer) {
                console.log('[BANK] bankTransfer recipient offline', recipientName);
                return player.call('bankTransferResult', [false, 'Gavėjas turi būti prisijungęs žaidėjas!']);
            }

            const newSenderBalance = senderRes[0].balance - amount;
            const newTargetBalance = targetRes[0].balance + amount;

            // Update both accounts
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [newSenderBalance, player.charName]);
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [newTargetBalance, recipientName]);

            // Log transactions
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, "transfer_out", ?, NOW())', [player.charName, amount]);
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, "transfer_in", ?, NOW())', [recipientName, amount]);

            // Notify sender
            player.bankBalance = newSenderBalance;
            player.call('updateBankHUD', [newSenderBalance]);
            player.call('bankTransferResult', [true, `Sėkmingai pervesta $${amount} žaidėjui ${recipientName}`, recipientName, amount]);

            // Notify recipient if online
            const targetPlayer = mp.players.toArray().find(p => p.charName === recipientName);
            if (targetPlayer) {
                targetPlayer.bankBalance = newTargetBalance;
                targetPlayer.call('updateBankHUD', [newTargetBalance]);
                targetPlayer.outputChatBox(`!{#229954}Jūs gavote $${amount} iš ${player.charName} per mobilųjį banką.`);
            }
        });
    });
});