const bcrypt = require('bcrypt');
const mysql = require('mysql');
const moment = require('moment-timezone');

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

mp.events.add('playerQuit', (player) => {
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

    saveCharacterData(player);

    if (player.charId) {
        player.outputChatBox('!{#f7dc6f}Jūsų veikėjo duomenys išsaugoti. Iki pasimatymo!');
    } else {
        console.log(`[INFO] Žaidėjas ${player.name} atsijungė be pasirinkto veikėjo.`);
    }
});

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

    if (!isNaN(targetIdentifier)) {
        const targetId = parseInt(targetIdentifier);
        target = mp.players.at(targetId);
    } else {
        const matchingPlayers = mp.players.toArray().filter(p => p.charName && p.charName.toLowerCase().includes(targetIdentifier.toLowerCase()));
        if (matchingPlayers.length === 0) {
            player.outputChatBox(`Nerastas žaidėjas vardu "${targetIdentifier}".`);
            return;
        } else if (matchingPlayers.length > 1) {
            player.outputChatBox(`Rasti keli žaidėjai vardu "${targetIdentifier}":`);
            matchingPlayers.forEach(target => {
                player.outputChatBox(`ID: ${target.id} | Vardas: ${target.charName}`);
            });
            player.outputChatBox(`Įveskite tikslų vardą.`);
            return;
        } else {
            target = matchingPlayers[0];
        }
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

        let targetPlayer = null;
        if (!isNaN(targetNameOrID)) {
            targetPlayer = mp.players.at(parseInt(targetNameOrID));
        } else {
            targetPlayer = mp.players.toArray().find(p => p.charName && p.charName.toLowerCase().includes(targetNameOrID.toLowerCase()));
        }

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
    let player = mp.players.at(Number(identifier));
    if (!player) {
        player = mp.players.toArray().find(p => p.charName && p.charName.toLowerCase() === identifier.toLowerCase());
    }
    return player;
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

    const target = mp.players.at(parseInt(playerId));
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

    const target = mp.players.at(parseInt(playerId));
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

    const target = mp.players.at(parseInt(targetId));
    if (!target) {
        return player.outputChatBox("Žaidėjas su tokiu ID nerastas.");
    }

    if (!target.charName) {
        return player.outputChatBox("Žaidėjas dar nepasirinko veikėjo.");
    }

    const reason = reasonArray.join(" ");
    reports.set(player.id, { player, target, reason });

    const adminLevel = await getAdminLevelFromDB(player);
    if (adminLevel >= 1) {
        mp.players.forEach(admin => {
            if (adminLevel >= 1) {
                admin.outputChatBox(`!{#f0e237}[REPORT] ${player.charName} pranešė apie ${target.charName}: ${reason} (ID: ${player.id})`);
            }
        });
    }

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





// TAXI and PHONE

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

const activeDrivers = new Map();
const rideRequests = new Map();

mp.events.addCommand('ph', (player) => openPhone(player));
mp.events.addCommand('phone', (player) => openPhone(player));

// Server-side
function openPhone(player) {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const isDriver = activeDrivers.has(player.id);
    const callStatus = activeCalls.has(player.id) ? activeCalls.get(player.id).status : 'idle';
    const callPartner = callStatus !== 'idle' ? (activeCalls.get(player.id).caller === player ? activeCalls.get(player.id).target.charName : activeCalls.get(player.id).caller.charName) : null;
    const contacts = player.contacts || [];
    console.log(`[DEBUG] Opening phone for ${player.charName}, sending contacts:`, contacts);
    player.call('openPhoneUI', [isDriver, player.phoneNumber, callStatus, callPartner, JSON.stringify(contacts)]);
}

mp.events.add('toggleDriverStatus', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Jums reikia transporto priemonės, kad taptumėte vairuotoju!');
    }

    if (activeDrivers.has(player.id)) {
        activeDrivers.delete(player.id);
        player.outputChatBox('!{#cd5d3c}Jūs nebesate Drive vairuotojas.');
        player.call('updatePhoneUI', [false]);
    } else {
        activeDrivers.set(player.id, { player, status: "available" });
        player.outputChatBox('!{#7aa164}Jūs tapote Drive vairuotoju! Laukite užsakymų.');
        player.call('updatePhoneUI', [true]);
    }
});

mp.events.add('requestRide', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (rideRequests.has(player.id)) {
        return player.outputChatBox('!{#e74c3c}Jūs jau pateikėte kelionės užklausą!');
    }
    if (activeDrivers.size === 0) {
        return player.outputChatBox('!{#f7dc6f}Šiuo metu nėra laisvų Drive vairuotojų.');
    }

    rideRequests.set(player.id, { requester: player, driver: null });

    activeDrivers.forEach((driverData, driverId) => {
        const driver = driverData.player;
        const distance = player.position.distanceTo(driver.position);
        if (distance <= 500 && driverData.status === "available") {
            driver.outputChatBox(`!{#f7dc6f}[Drive] ${player.charName} prašo kelionės! Priimti: /acceptdrive ${player.id}`);
        }
    });

    player.outputChatBox('!{#7aa164}Jūsų kelionės užklausa išsiųsta Drive vairuotojams.');
});

mp.events.addCommand('acceptdrive', (driver, requesterId) => {
    if (!driver.charName) return driver.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!activeDrivers.has(driver.id)) {
        return driver.outputChatBox('!{#e74c3c}Jūs nesate Drive vairuotojas! Įjunkite per telefoną.');
    }
    const reqId = parseInt(requesterId);
    if (!rideRequests.has(reqId)) {
        return driver.outputChatBox('!{#f7dc6f}Ši kelionės užklausa nebegalioja.');
    }

    const request = rideRequests.get(reqId);
    if (request.driver) {
        return driver.outputChatBox('!{#e74c3c}Šią užklausą jau priėmė kitas vairuotojas.');
    }

    request.driver = driver;
    activeDrivers.get(driver.id).status = "busy";

    // Create a blip on the driver's map at the requester's position
    const passengerBlip = mp.blips.new(1, request.requester.position, {
        name: `Keleivis: ${request.requester.charName}`,
        color: 2, // Green color
        shortRange: false,
        scale: 1.0
    });

    // Store the blip reference and passenger position in the driver object
    driver.passengerBlip = passengerBlip;
    driver.passengerPosition = request.requester.position;

    driver.outputChatBox(`!{#7aa164}Priėmėte ${request.requester.charName} kelionės užklausą. Pasažierio vieta pažymėta žemėlapyje! Susisiekite su keleiviu dėl tikslo ir kainos.`);
    request.requester.outputChatBox(`!{#7aa164}Vairuotojas ${driver.charName} priėmė jūsų užklausą! Susisiekite dėl tikslo ir kainos.`);
});

// Add an event to check driver proximity to passenger
mp.events.add('render', () => {
    mp.players.forEach(driver => {
        // Check if this driver has an active passenger blip and position
        if (driver.passengerBlip && driver.passengerPosition) {
            const driverPos = driver.position;

            // Manual distance calculation
            const distance = Math.sqrt(
                Math.pow(driverPos.x - driver.passengerPosition.x, 2) +
                Math.pow(driverPos.y - driver.passengerPosition.y, 2) +
                Math.pow(driverPos.z - driver.passengerPosition.z, 2)
            );

            // Alternative using mp.Vector3 (commented out, but left for reference)
            // const distance = mp.Vector3.getDistanceBetweenPoints3D(driverPos, driver.passengerPosition);

            // Define a reasonable pickup radius (e.g., 10 units)
            const pickupRadius = 10.0;

            if (distance <= pickupRadius) {
                // Driver has reached their assigned passenger
                driver.passengerBlip.destroy(); // Remove the blip
                driver.passengerBlip = null;    // Clear the blip reference
                driver.passengerPosition = null; // Clear the position reference
                driver.outputChatBox('!{#7aa164}Pasiekėte keleivio vietą!');

                // Find the specific ride request associated with this driver
                const request = Array.from(rideRequests.values()).find(r => r.driver === driver);
                if (request && request.requester) {
                    request.requester.outputChatBox(`!{#7aa164}Vairuotojas ${driver.charName} atvyko jūsų pasiimti!`);
                }
            }
        }
    });
});


mp.events.addCommand('cancelride', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!rideRequests.has(player.id)) {
        return player.outputChatBox('!{#f7dc6f}Jūs neturite aktyvios kelionės užklausos.');
    }

    const request = rideRequests.get(player.id);
    if (request.driver) {
        request.driver.outputChatBox(`!{#cd5d3c}${player.charName} atšaukė kelionės užklausą.`);
        activeDrivers.get(request.driver.id).status = "available";
    }
    rideRequests.delete(player.id);
    player.outputChatBox('!{#cd5d3c}Jūsų kelionės užklausa atšaukta.');
});

mp.events.add('playerQuit', (player) => {
    if (activeDrivers.has(player.id)) {
        activeDrivers.delete(player.id);
    }
    if (rideRequests.has(player.id)) {
        const request = rideRequests.get(player.id);
        if (request.driver) {
            request.driver.outputChatBox(`!{#cd5d3c}${player.charName} atsijungė, kelionė atšaukta.`);
            activeDrivers.get(request.driver.id).status = "available";
        }
        rideRequests.delete(player.id);
    }
});


const activeCalls = new Map(); // Tracks ongoing calls: { callerId: { caller, target, status } }

// /call command
mp.events.addCommand('call', (player, phoneNumber) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!phoneNumber) return player.outputChatBox('Naudojimas: /call [telefono numeris]');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio.');

    if (activeCalls.has(player.id)) {
        return player.outputChatBox('!{#e74c3c}Jūs jau esate skambutyje arba laukiate atsakymo.');
    }

    // Find target player by phone number
    const target = mp.players.toArray().find(p => p.phoneNumber === phoneNumber);
    if (!target || !target.charName) {
        return player.outputChatBox('!{#f7dc6f}Šis telefono numeris nerastas arba žaidėjas neprisijungęs.');
    }

    if (target === player) {
        return player.outputChatBox('!{#e74c3c}Negalite skambinti sau!');
    }

    // Initiate call request
    activeCalls.set(player.id, { caller: player, target, status: 'ringing' });
    player.outputChatBox(`!{#f7dc6f}Skambinate ${target.charName} (${phoneNumber})...`);
    target.outputChatBox(`!{#f7dc6f}Jums skambina ${player.charName} (${player.phoneNumber}). Naudokite /answer arba /decline.`);
    target.call('incomingCall', [player.charName, player.phoneNumber]); // Notify phone UI
});

// /answer command
mp.events.addCommand('answer', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    const callRequest = Array.from(activeCalls.values()).find(call => call.target === player && call.status === 'ringing');
    if (!callRequest) {
        return player.outputChatBox('!{#f7dc6f}Šiuo metu jums niekas neskambina.');
    }

    const caller = callRequest.caller;
    callRequest.status = 'active';
    activeCalls.set(caller.id, callRequest);

    player.outputChatBox(`!{#7aa164}Jūs priėmėte skambutį iš ${caller.charName}.`);
    caller.outputChatBox(`!{#7aa164}${player.charName} priėmė jūsų skambutį.`);
    player.call('callStarted', [caller.charName, caller.phoneNumber]); // Update phone UI
    caller.call('callStarted', [player.charName, player.phoneNumber]); // Update caller's phone UI
});

// /decline command
mp.events.addCommand('decline', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    const callRequest = Array.from(activeCalls.values()).find(call => call.target === player && call.status === 'ringing');
    if (!callRequest) {
        return player.outputChatBox('!{#f7dc6f}Šiuo metu jums niekas neskambina.');
    }

    const caller = callRequest.caller;
    activeCalls.delete(caller.id);

    player.outputChatBox(`!{#cd5d3c}Jūs atmetėte skambutį iš ${caller.charName}.`);
    caller.outputChatBox(`!{#cd5d3c}${player.charName} atmetė jūsų skambutį.`);
    caller.call('callEnded'); // Update caller's phone UI
});

// Handle player disconnect
mp.events.add('playerQuit', (player) => {

    player.contacts = null;
    player.isPhoneOpen = false;

    if (activeCalls.has(player.id)) {
        const call = activeCalls.get(player.id);
        call.target.outputChatBox(`!{#cd5d3c}${player.charName} atsijungė, skambutis baigtas.`);
        call.target.call('callEnded');
        activeCalls.delete(player.id);
    }

    const incomingCall = Array.from(activeCalls.values()).find(call => call.target === player && call.status === 'ringing');
    if (incomingCall) {
        incomingCall.caller.outputChatBox(`!{#cd5d3c}${player.charName} atsijungė, skambutis atšauktas.`);
        incomingCall.caller.call('callEnded');
        activeCalls.delete(incomingCall.caller.id);
    }
});

mp.events.add('callFromUI', (player, phoneNumber) => {
    if (!/^\d+$/.test(number)) return player.outputChatBox('!{#e74c3c}Numeris turi būti tik skaitmenys!');
    mp.events.call('call', player, number); // Assuming 'call' handles any length
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

    let target = null;
    mp.players.forEach(p => {
        if (p.phoneNumber === number) target = p;
    });

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

    activeCalls.set(player.id, { caller: player, target: target, status: 'ringing' });
    activeCalls.set(target.id, { caller: player, target: target, status: 'incoming' });

    player.outputChatBox(`!{#7aa164}Skambinate ${target.charName} (${number})...`);
    player.call('callStarted', [target.charName, number]);
    target.call('incomingCall', [player.charName, player.phoneNumber]);
    console.log(`[DEBUG] Call initiated: ${player.charName} -> ${target.charName}`);
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
    const partner = (callData.caller === player) ? callData.target : callData.caller;

    activeCalls.delete(player.id);
    activeCalls.delete(partner.id);

    player.outputChatBox('!{#7aa164}Jūs baigėte skambutį.');
    partner.outputChatBox('!{#e74c3c}Skambutis baigtas kitos pusės.');
    player.call('callEnded');
    partner.call('callEnded');
    console.log(`[DEBUG] Call ended by ${player.charName}`);
});


mp.events.addCommand('sms', (player, fullText, targetNumber, ...messageArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');
    if (!targetNumber || messageArray.length === 0) return player.outputChatBox('Naudojimas: /sms [telefono numeris] [žinutė]');

    const messageText = messageArray.join(' ');
    if (messageText.length > 500) return player.outputChatBox('!{#e74c3c}Žinutė per ilga! Maksimumas 500 simbolių.');

    // Find the target player by phone number
    const target = mp.players.toArray().find(p => p.phoneNumber === targetNumber);
    if (!target || !target.charName) {
        // Store the message even if the recipient is offline
        db.query(
            'INSERT INTO messages (char_id, sender_number, recipient_number, message_text) VALUES (?, ?, ?, ?)',
            [player.charId, player.phoneNumber, targetNumber, messageText],
            (err) => {
                if (err) {
                    console.error('[KLAIDA] Nepavyko išsaugoti žinutės:', err);
                    return player.outputChatBox('!{#e74c3c}Klaida siunčiant žinutę.');
                }
                player.outputChatBox(`!{#7aa164}Žinutė nusiųsta ${targetNumber} (gavėjas neprisijungęs).`);
            }
        );
        return;
    }

    if (target === player) return player.outputChatBox('!{#e74c3c}Negalite siųsti žinutės sau!');

    // Save the message to the database
    db.query(
        'INSERT INTO messages (char_id, sender_number, recipient_number, message_text) VALUES (?, ?, ?, ?)',
        [player.charId, player.phoneNumber, targetNumber, messageText],
        (err) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko išsaugoti žinutės:', err);
                return player.outputChatBox('!{#e74c3c}Klaida siunčiant žinutę.');
            }

            // Notify both players
            player.outputChatBox(`!{#7aa164}[Žinutė nusiųsta -> ${target.charName} (${targetNumber})]: ${messageText}`);
            target.outputChatBox(`!{#7aa164}[Žinutė gauta iš ${player.charName} (${player.phoneNumber})]: ${messageText}`);

            // Update target's phone UI if Messages app is open
            if (target.isPhoneOpen) {
                loadMessagesForPlayer(target, targetNumber);
            }
        }
    );
});








const messageCooldowns = new Map(); // Map<player, { lastMessageTime: number, messageCount: number }>
const MAX_MESSAGES_PER_MINUTE = 30; // Limit to 10 messages per minute
const COOLDOWN_PERIOD = 60000; // 1 minute in milliseconds


// Send a message from the phone UI
// Send a message from the phone UI
mp.events.add('sendMessage', (player, recipientNumber, messageText) => {
    console.log(`[DEBUG] UI sendMessage for ${player.name} to ${recipientNumber}: "${messageText}"`);

    if (!player.charName || !player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');
    if (!recipientNumber || !messageText || messageText.trim().length === 0) return player.outputChatBox('!{#e74c3c}Įveskite gavėjo numerį ir žinutę!');
    if (!/^\d+$/.test(recipientNumber)) return player.outputChatBox('!{#e74c3c}Numeris turi būti tik skaitmenys!');
    if (messageText.length > 500) return player.outputChatBox('!{#e74c3c}Žinutė per ilga! Maksimumas 500 simbolių.');

    const now = Date.now();
    let cooldownData = messageCooldowns.get(player) || { lastMessageTime: 0, messageCount: 0 };
    if (now - cooldownData.lastMessageTime > COOLDOWN_PERIOD) {
        cooldownData = { lastMessageTime: now, messageCount: 1 };
    } else {
        cooldownData.messageCount++;
        if (cooldownData.messageCount > MAX_MESSAGES_PER_MINUTE) {
            return player.outputChatBox('!{#e74c3c}Per daug žinučių! Palaukite minutę.');
        }
    }
    messageCooldowns.set(player, cooldownData);

    const target = mp.players.toArray().find(p => p.phoneNumber === recipientNumber);
    db.query(
        'INSERT INTO messages (char_id, sender_number, recipient_number, message_text) VALUES (?, ?, ?, ?)',
        [player.charId, player.phoneNumber, recipientNumber, messageText],
        (err, result) => {
            if (err) {
                console.error('[KLAIDA] Failed to save UI message:', err);
                return player.outputChatBox('!{#e74c3c}Klaida siunčiant žinutę.');
            }
            console.log(`[DEBUG] UI message saved: ID=${result.insertId}, ${player.phoneNumber} -> ${recipientNumber}`);
            player.outputChatBox(`!{#7aa164}Žinutė nusiųsta ${recipientNumber}${target ? ` (${target.charName})` : ' (neprisijungęs)'}.`);
            if (target && target !== player) {
                target.outputChatBox(`!{#7aa164}[Žinutė gauta iš ${player.charName} (${player.phoneNumber})]: ${messageText}`);
                if (target.isPhoneOpen) loadMessagesForPlayer(target, player.phoneNumber);
            }
            loadMessagesForPlayer(player, recipientNumber);
            loadConversationsForPlayer(player);
        }
    );
});

// Load message history for a specific conversation
function loadMessagesForPlayer(player, otherNumber) {
    if (!player.charId || !player.phoneNumber) return;
    db.query(
        'SELECT id, sender_number, recipient_number, message_text, timestamp, is_read ' +
        'FROM messages WHERE (sender_number = ? AND recipient_number = ?) OR (sender_number = ? AND recipient_number = ?) ' +
        'ORDER BY timestamp ASC',
        [player.phoneNumber, otherNumber, otherNumber, player.phoneNumber],
        (err, results) => {
            if (err) {
                console.error('[KLAIDA] Failed to load messages:', err);
                return;
            }
            const messages = results.map(row => ({
                id: row.id,
                sender: row.sender_number,
                recipient: row.recipient_number,
                text: row.message_text,
                timestamp: row.timestamp.toISOString(), // Ensure timestamp is serializable
                isRead: row.is_read
            }));
            console.log(`[DEBUG] Sending ${messages.length} messages to ${player.name} for ${otherNumber}`);
            player.call('updateMessagesUI', [otherNumber, JSON.stringify(messages)]);
        }
    );
}

function loadConversationsForPlayer(player) {
    if (!player.charId || !player.phoneNumber) return;
    db.query(
        'SELECT DISTINCT CASE WHEN sender_number = ? THEN recipient_number ELSE sender_number END AS contact_number ' +
        'FROM messages WHERE sender_number = ? OR recipient_number = ?',
        [player.phoneNumber, player.phoneNumber, player.phoneNumber],
        (err, results) => {
            if (err) {
                console.error('[KLAIDA] Failed to load conversations:', err);
                return;
            }
            const contactNumbers = results.map(row => row.contact_number);
            const conversations = [];
            const promises = contactNumbers.map(number => {
                return new Promise(resolve => {
                    db.query(
                        'SELECT sender_number, message_text, timestamp, is_read ' +
                        'FROM messages WHERE (sender_number = ? AND recipient_number = ?) OR (sender_number = ? AND recipient_number = ?) ' +
                        'ORDER BY timestamp DESC LIMIT 1',
                        [player.phoneNumber, number, number, player.phoneNumber],
                        (err, msgResults) => {
                            if (err || !msgResults.length) return resolve(null);
                            const contactName = (player.contacts || []).find(c => c.number === number)?.name || number;
                            resolve({
                                number,
                                contactName,
                                lastMessage: msgResults[0].message_text,
                                timestamp: msgResults[0].timestamp.toISOString(),
                                isRead: msgResults[0].is_read
                            });
                        }
                    );
                });
            });

            Promise.all(promises).then(results => {
                results.filter(r => r).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(conv => conversations.push(conv));
                console.log(`[DEBUG] Sending ${conversations.length} conversations to ${player.name}`);
                player.call('updateConversationsUI', [JSON.stringify(conversations)]);
            });
        }
    );
}

// Event to open Messages app and load conversations
mp.events.add('openMessagesApp', (player) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    loadConversationsForPlayer(player);
});

// Event to open a specific conversation
mp.events.add('openConversation', (player, number) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!/^\d+$/.test(number)) return player.outputChatBox('!{#e74c3c}Netinkamas numeris!');
    loadMessagesForPlayer(player, number);
});