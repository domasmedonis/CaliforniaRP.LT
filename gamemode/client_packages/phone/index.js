const browser = mp.browsers.new('package://phone/phone.html');
browser.active = false;
let isPhoneOpen = false;

mp.events.add('openPhoneUI', (isDriver, phoneNumber, callStatus, callPartner, contactsJson) => {
    console.log(`[DEBUG] Received openPhoneUI: isDriver=${isDriver}, phoneNumber=${phoneNumber}, callStatus=${callStatus}, callPartner=${callPartner}, contacts=${contactsJson}`);
    if (!isPhoneOpen) {
        browser.execute(`showHomeScreen(${isDriver});`);
        mp.gui.cursor.show(true, true);
        browser.active = true;
        isPhoneOpen = true;
    }
    browser.execute(`loadPhoneData('${phoneNumber}', '${callStatus}', '${callPartner || ''}', '${contactsJson}');`);
});

mp.events.add('updatePhoneUI', (isDriver) => {
    if (isPhoneOpen) {
        browser.execute(`updateDriverStatus(${isDriver});`);
    }
});

mp.events.add('closePhoneUI', () => {
    if (isPhoneOpen) {
        mp.gui.cursor.show(false, false);
        browser.active = false;
        isPhoneOpen = false;
    }
});

mp.events.add('toggleDriverStatus', () => {
    mp.events.callRemote('toggleDriverStatus');
});

mp.events.add('requestRide', () => {
    mp.events.callRemote('requestRide');
});

mp.events.add('openDriveApp', (isDriver) => {
    if (isPhoneOpen) {
        browser.execute(`openDriveApp(${isDriver});`);
    }
});

mp.keys.bind(0x1B, true, () => {
    if (isPhoneOpen) {
        mp.events.call('closePhoneUI');
    }
});

// Call-related events
mp.events.add('updatePhoneNumber', (number) => {
    if (isPhoneOpen) {
        browser.execute(`updatePhoneNumber('${number}');`);
    } else {
        console.log(`[PHONE] Cannot update phone number: Phone UI not open`);
    }
});

mp.events.add('incomingCall', (callerName, callerNumber) => {
    if (!isPhoneOpen) {
        // Auto-open phone UI for incoming call
        mp.events.call('openPhoneUI', false); // Open with isDriver=false since it's irrelevant here
    }
    browser.execute(`incomingCall('${callerName}', '${callerNumber}');`);
});

mp.events.add('callStarted', (partnerName, partnerNumber) => {
    if (isPhoneOpen) {
        browser.execute(`callStarted('${partnerName}', '${partnerNumber}');`);
    }
});

mp.events.add('callEnded', () => {
    if (isPhoneOpen) {
        browser.execute(`callEnded();`);
    }
});

mp.events.add('callFromUI', (phoneNumber) => {
    console.log(`[PHONE] Initiating call to ${phoneNumber}`);
    mp.events.callRemote('callFromUI', phoneNumber);
});

// Debug: Check browser state
mp.events.add('render', () => {
    if (isPhoneOpen && !browser.active) {
        console.log('[PHONE] Browser closed unexpectedly');
        isPhoneOpen = false;
        mp.gui.cursor.show(false, false);
    }
});

// Add to your existing client-side script

// Client-side script
mp.events.add('updateContactsUI', (contactsJson) => {
    console.log(`[DEBUG] Received contacts update: ${contactsJson}`);
    if (isPhoneOpen) {
        browser.execute(`updateContacts('${contactsJson}');`);
    } else {
        console.log('[DEBUG] Phone UI not open, contacts will update on next open');
    }
});

// Ensure loadContacts also logs
mp.events.add('loadContacts', (contactsJson, isDriver, phoneNumber) => {
    console.log(`[DEBUG] Loading contacts: ${contactsJson}, isDriver: ${isDriver}, phoneNumber: ${phoneNumber}`);
    if (!isPhoneOpen) {
        browser.execute(`showHomeScreen(${isDriver});`);
        mp.gui.cursor.show(true, true);
        browser.active = true;
        isPhoneOpen = true;
    }
    browser.execute(`loadContacts('${contactsJson}', '${phoneNumber}');`);
});

mp.events.add('addContact', (name, number) => {
    mp.events.callRemote('addContact', name, number);
});

mp.events.add('removeContact', (number) => {
    mp.events.callRemote('removeContact', number);
});

mp.events.add('callContact', (number) => {
    mp.events.callRemote('callContact', number);
});

mp.events.add('incomingCall', (callerName, callerNumber) => {
    console.log(`[DEBUG] Incoming call from ${callerName} (${callerNumber})`);
    if (!isPhoneOpen) {
        mp.gui.cursor.show(true, true);
        browser.active = true;
        isPhoneOpen = true;
    }
    browser.execute(`showIncomingCall('${callerName}', '${callerNumber}');`);
});

mp.events.add('callStarted', (partnerName, partnerNumber) => {
    browser.execute(`callStarted('${partnerName}', '${partnerNumber}');`);
});

mp.events.add('callEnded', () => {
    browser.execute('callEnded();');
});


mp.events.add('sendMessage', (recipientNumber, messageText) => {
    mp.events.callRemote('sendMessage', recipientNumber, messageText);
});

mp.events.add('openMessagesApp', () => {
    mp.events.callRemote('openMessagesApp');
});

mp.events.add('openConversation', (number) => {
    mp.events.callRemote('openConversation', number);
});

mp.events.add('updateMessagesUI', (number, messagesJson) => {
    browser.execute(`updateMessagesUI('${number}', '${messagesJson}');`);
});

mp.events.add('updateConversationsUI', (conversationsJson) => {
    browser.execute(`updateConversationsUI('${conversationsJson}');`);
});