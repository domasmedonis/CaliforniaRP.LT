const browser = mp.browsers.new('package://phone/phone.html');
browser.active = false;
let isPhoneOpen = false;

mp.events.add('openPhoneUI', (isDriver, phoneNumber, callStatus, callPartner, contactsJson) => {
    console.log(`[PHONE] openPhoneUI called`);
    if (!isPhoneOpen) {
        browser.execute(`showHomeScreen(${isDriver});`);
        browser.active = true;
        setTimeout(() => {
            mp.gui.cursor.show(true, true);
            if (mp.game && mp.game.controls && typeof mp.game.controls.disableAllControls === 'function') {
                mp.game.controls.disableAllControls(true);
            }
        }, 100);
        isPhoneOpen = true;
        // Keep chat messages visible but prevent opening chat input with T while phone is open.
        mp.gui.chat.show(true);
        mp.gui.chat.activate(false);
    }
    browser.execute(`loadPhoneData(${JSON.stringify(phoneNumber || '')}, ${JSON.stringify(callStatus || 'idle')}, ${JSON.stringify(callPartner || '')}, ${JSON.stringify(contactsJson || '[]')});`);
});

mp.events.add('updatePhoneUI', (isDriver) => {
    if (isPhoneOpen) browser.execute(`updateDriverStatus(${isDriver});`);
});

mp.events.add('closePhoneUI', () => {
    if (isPhoneOpen) {
        mp.gui.cursor.show(false, false);
        if (mp.game && mp.game.controls && typeof mp.game.controls.disableAllControls === 'function') {
            mp.game.controls.disableAllControls(false);
        }
        browser.active = false;
        isPhoneOpen = false;
        mp.gui.chat.show(true);
        mp.gui.chat.activate(true);
    }
});

mp.keys.bind(0x1B, true, () => {
    if (isPhoneOpen) mp.events.call('closePhoneUI');
});

mp.events.add('incomingCall', (callerName, callerNumber) => {
    if (!isPhoneOpen) {
        browser.execute(`showHomeScreen(false);`);
        mp.gui.cursor.show(true, true);
        browser.active = true;
        isPhoneOpen = true;
    }
    browser.execute(`incomingCall('${callerName}', '${callerNumber}');`);
    playFaceTimeRingtone();
});

mp.events.add('callStarted', (partnerName, partnerNumber) => {
    browser.execute(`callStarted('${partnerName}', '${partnerNumber}');`);
});

mp.events.add('callEnded', () => browser.execute(`callEnded();`));

mp.events.add('newMessageNotification', (senderNumber, senderName, messageText) => {
    if (!isPhoneOpen) {
        mp.gui.chat.push(`!{#00ff00}[Žinutė] !{#ffffff}Nauja žinutė nuo ${senderName || senderNumber}`);
    }
    browser.execute(`showMessageNotification('${senderNumber}', '${senderName || ''}', '${messageText.replace(/'/g, "\\'")}');`);
});

mp.events.add('callFailed', (message) => {
    console.log('[PHONE] callFailed event received:', message, 'isPhoneOpen=', isPhoneOpen);
    if (isPhoneOpen) {
        // Keep the user in the current app but show a toast for failure.
        // Ensure overlay is visible in case the current app has inline style override.
        browser.execute(`showPhoneToast(${JSON.stringify(message)})`);
    } else {
        mp.gui.chat.push(`!{#e74c3c}${message}`);
    }
});

mp.events.add('updateMessagesUI', (number, messagesJson) => browser.execute(`updateMessagesUI('${number}', '${messagesJson}');`));
mp.events.add('updateConversationsUI', (conversationsJson) => browser.execute(`updateConversationsUI('${conversationsJson}');`));

mp.events.add('updateContactsUI', (contactsJson) => {
    if (isPhoneOpen) browser.execute(`updateContacts('${contactsJson}');`);
});

mp.events.add('loadContacts', (contactsJson, isDriver, phoneNumber) => {
    if (!isPhoneOpen) {
        browser.execute(`showHomeScreen(${isDriver});`);
        mp.gui.cursor.show(true, true);
        browser.active = true;
        isPhoneOpen = true;
    }
    browser.execute(`loadContacts('${contactsJson}', '${phoneNumber}');`);
});

mp.events.add('addContact', (name, number) => mp.events.callRemote('addContact', name, number));
mp.events.add('removeContact', (number) => mp.events.callRemote('removeContact', number));
mp.events.add('callContact', (number) => mp.events.callRemote('callContact', number));
mp.events.add('callFromUI', (phoneNumber) => mp.events.callRemote('callFromUI', phoneNumber));
mp.events.add('sendMessage', (recipientNumber, messageText) => mp.events.callRemote('sendMessage', recipientNumber, messageText));
mp.events.add('openMessagesApp', () => mp.events.callRemote('openMessagesApp'));
mp.events.add('openConversation', (number) => mp.events.callRemote('openConversation', number));

// Drive control CEF -> client -> server bridge
mp.events.add('toggleDriverStatus', () => mp.events.callRemote('toggleDriverStatus'));
mp.events.add('requestRide', () => mp.events.callRemote('requestRide'));

let currentRingtone = null;

function playFaceTimeRingtone() {
    stopFaceTimeRingtone();
    currentRingtone = mp.game.audio.playSoundFrontend(-1, "PHONE_RING", "DLC_HEIST_HACKING_SNAKE_SOUNDS", true);
}

function stopFaceTimeRingtone() {
    if (currentRingtone) mp.game.audio.stopSound(currentRingtone);
    currentRingtone = null;
}

let isTypingInPhone = false;

mp.events.add('phoneTypingStarted', () => {
    isTypingInPhone = true;
    mp.gui.chat.show(false);
    mp.gui.chat.activate(false);
});

mp.events.add('phoneTypingEnded', () => {
    isTypingInPhone = false;
    mp.gui.chat.show(true);
    mp.gui.chat.activate(true);
});

mp.keys.bind(0x54, true, () => {
    if (isPhoneOpen) {
        // while phone is open, block T key from opening chat input
        return false;
    }
});

// ==================== DRIVE BUTTONS (FIXED) ====================

mp.events.add('browserDomReady', (b) => {
    if (b !== browser) return;

    console.log("[PHONE CEF] browserDomReady - attaching Drive buttons");

    browser.execute(`
        console.log("[CEF] Attaching click listeners to Drive buttons");

        const toggleBtn = document.getElementById('toggleDriverBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                console.log("[CEF] toggleDriverBtn CLICKED!");
                mp.trigger('toggleDriverStatus');
            });
        } else {
            console.error("[CEF] toggleDriverBtn NOT FOUND!");
        }

        const requestBtn = document.getElementById('requestRideBtn');
        if (requestBtn) {
            requestBtn.addEventListener('click', () => {
                console.log("[CEF] requestRideBtn CLICKED!");
                mp.trigger('requestRide');
            });
        } else {
            console.error("[CEF] requestRideBtn NOT FOUND!");
        }

        const backBtn = document.getElementById('driveBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                console.log("[CEF] driveBackBtn CLICKED!");
                mp.trigger('driveBackToHome');
            });
        }
    `);
});

mp.events.add('driveBackToHome', () => {
    console.log("[PHONE] driveBackToHome received");
    if (isPhoneOpen && browser) {
        browser.execute(`
            document.getElementById('driveApp').classList.remove('active');
            document.getElementById('homeScreen').classList.add('active');
        `);
    }
});

// ==================== TWITTER APP ====================

mp.events.add('loadTwitterData', (handle, tweetsJson) => {
    console.log(`[PHONE] loadTwitterData received in index.js - handle=${handle}, tweetsJson=${tweetsJson}`);
    if (browser && browser.active) {
        browser.execute(`loadTwitterData(${JSON.stringify(handle || '')}, ${JSON.stringify(tweetsJson)});`);
    }
});

mp.events.add('requestTwitterData', () => {
    mp.events.callRemote('requestTwitterData');
});

mp.events.add('twitterStatusUpdate', (text, color) => {
    if (browser && browser.active) {
        browser.execute(`setTwitterStatus(${JSON.stringify(text)}, ${JSON.stringify(color || '#2c3e50')});`);
    }
});

mp.events.add('registerTwitterHandle', (handle) => mp.events.callRemote('registerTwitterHandle', handle));
mp.events.add('postTweet', (content) => mp.events.callRemote('postTweet', content));

mp.events.add('twitterHandleRegistered', (handle) => {
    if (browser && browser.active) {
        browser.execute(`loadTwitterData(${JSON.stringify(handle)}, []);`);
    }
});

mp.events.add('twitterFeedUpdated', (tweetsJson) => {
    if (browser && browser.active) {
        browser.execute(`renderTwitterFeed(${JSON.stringify(tweetsJson)});`);
    }
});


// ==================== BANK APP ====================
mp.events.add('loadBankData', (balance, charName, transactionsJson) => {
    if (browser && browser.active) {
        browser.execute(`
            document.getElementById('balanceDisplay').innerText = '$${parseInt(balance).toLocaleString('lt-LT')}';
            document.getElementById('charNameDisplay').innerText = '${charName}';
            renderTransactions(${JSON.stringify(transactionsJson)});
        `);
    }
});

mp.events.add('bankTransferResult', (success, message, recipientName, amount) => {
    console.log('[BANK] bankTransferResult', success, message, recipientName, amount);

    if (browser && browser.active) {
        browser.execute(`
            console.log('[BANK] bankTransferResult CEF callback', ${JSON.stringify(success)}, ${JSON.stringify(message)});
            showBankNotification(${JSON.stringify(success ? 'success' : 'error')}, ${JSON.stringify(message)});
            resetBankTransferForm();
            ${success ? `addTransactionToHistory('transfer_out', ${JSON.stringify(amount)}, new Date().toISOString());` : ''}
        `);
    }

    if (success) {
        mp.events.callRemote('openBankApp');
    }
});

// Bank helper for CEF
mp.events.add('openBankApp', () => mp.events.callRemote('openBankApp'));