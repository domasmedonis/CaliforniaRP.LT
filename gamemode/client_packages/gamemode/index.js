mp.gui.chat.push('Hello World')


mp.events.add('freezePlayer', (freeze) => {
    if (freeze) {
        mp.players.local.freezePosition(true); // Freeze the player's position
    } else {
        mp.players.local.freezePosition(false); // Unfreeze the player's position
    }
});



mp.events.add('hideDefaultCashUI', () => {
    // Disable the default cash HUD display
    mp.game.ui.displayCash(false); // This hides the default cash UI element
});



let playerMoney = 0;

// Receive money update from the server
mp.events.add('updateMoneyHUD', (money) => {
    playerMoney = money;
});

// Render money on the screen
mp.events.add('render', () => {
    mp.game.graphics.drawText(`$${playerMoney}`, [0.95, 0.05], {
        font: 7, // GTA-style font (try 4 or 7 if you want to experiment)
        color: [158, 199, 121, 255], // HEX #27AE60 converted to RGBA
        scale: [0.77, 0.77], // Good size for visibility
        outline: true, // Adds outline for better contrast
        shadow: true // Adds depth with shadow
    });
});


let currentServerTime = "00:00"; // Default time

// Event to receive the server time from the server
mp.events.add('updateServerTime', (serverTime) => {
    // Convert serverTime to Date and format it to HH:mm (hours and minutes only)
    const time = new Date(serverTime);
    const hours = String(time.getHours()).padStart(2, '0'); // Format hours to 2 digits
    const minutes = String(time.getMinutes()).padStart(2, '0'); // Format minutes to 2 digits
    currentServerTime = `${hours}:${minutes}`;
    console.log("Received server time:", currentServerTime); // Log to verify correct time format
});

// Render the time on the screen
mp.events.add('render', () => {
    const timeX = 0.5; // X position (centered)
    const timeY = 0.955; // Y position (bottom of the screen)
    const font = 0; // Basic font
    const scale = 0.45; // Scale (size of text)
    const whiteColor = [255, 255, 255, 255]; // White color for time
    const californiaText = "CaliforniaRP.LT";

    // Display the time part (HH:mm) and CaliforniaRP.LT
    mp.game.graphics.drawText(`${currentServerTime} | ${californiaText}`, [timeX, timeY], {
        font: font,
        color: whiteColor,
        scale: [scale, scale],
        alignment: 1, // Center alignment
        outline: true,
    });
});



let paycheckBrowser = null;

mp.events.add('showPaycheckPopup', (amount) => {
    if (!paycheckBrowser) {
        paycheckBrowser = mp.browsers.new('package://cef/paycheck.html');
    }


    paycheckBrowser.execute(`showPaycheck(${amount})`); // Call the function in HTML
});

mp.keys.bind(0x45, false, function () { // 'E' key
    if (paycheckBrowser) {
        paycheckBrowser.execute(`closePaycheck()`);
        setTimeout(() => {
            paycheckBrowser.destroy();
            paycheckBrowser = null;
        }, 100);
    }
});


// Update your existing functions

// Client-Side (main client-side .js file)

// When the bank UI is opened, the history and balance are updated
mp.events.add('openBankUI', (balance, history) => {
    if (typeof bankUI !== 'undefined') {
        bankUI.destroy();
    }

    // Open the bank UI browser
    bankUI = mp.browsers.new('package://cef/bankUI.html');
    // Ensure history is passed as a stringified JSON array
    bankUI.execute(`updateBankBalance(${balance}); updateTransactionHistory(${JSON.stringify(history)});`);

    // Show cursor
    mp.gui.cursor.show(true, true);
});

// Event to update the bank balance and cash balance in the UI
mp.events.add('updateBankUI', (balance, cash, history) => {
    if (bankUI) {
        // Update balance and history in the UI
        bankUI.execute(`updateBankBalance(${balance}); updateCash(${cash}); updateTransactionHistory(${JSON.stringify(history)});`);
    }
});

// Event to handle error messages (like invalid amount)
mp.events.add('bankError', (message) => {
    if (bankUI) {
        bankUI.execute(`showBankError('${message}');`);
    }
});

// Event to close the bank UI and hide the cursor
mp.events.add('closeBankUI', () => {
    if (typeof bankUI !== 'undefined') {
        bankUI.destroy();
        delete bankUI;
    }
    mp.gui.cursor.show(false, false);
});

// Event listener from the bank UI to handle deposit/withdraw actions
mp.events.add('bankAction', (type, amount) => {
    // Validate the amount before passing it to the server
    if (isNaN(amount) || amount <= 0) {
        mp.events.call('bankError', "Įveskite teisingą sumą.");
        return;
    }

    // Trigger server-side event to handle deposit/withdraw
    mp.events.callRemote('bankAction', type, amount);  // Sends data to the server-side
});


let camera = null;
let loginUI = null;
let cameraPosition = new mp.Vector3(-80, -1525, 300);  // Higher position for the camera (view of Los Santos)
let cameraRotation = new mp.Vector3(-20, 0, 0);  // Looking downward for a good view of the city
let isLoginUIActive = false;

mp.events.add('openLoginUI', () => {
    // Open the login UI
    loginUI = mp.browsers.new("package://cef/loginUI.html");

    // Set login UI flag to true
    isLoginUIActive = true;

    // Disable the chat input (to prevent T or t from opening chat)
    mp.gui.chat.show(false);  // Disable the chat

    // Delay to show the cursor
    setTimeout(() => {
        mp.gui.cursor.show(true, true);  // Ensure cursor is visible when UI opens
    }, 100);

    mp.game.ui.displayRadar(false);

    // Create and activate the camera with a static high position and a downward view
    camera = mp.cameras.new('default', cameraPosition, cameraRotation, 50);  // Static view
    camera.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, true);  // Start rendering the camera
});

// When login is submitted
mp.events.add('login:submit', (username, password) => {
    mp.events.callRemote('validateLogin', username, password);
});

// If login fails, show error and keep cursor visible
mp.events.add('login:failed', (message) => {
    mp.gui.chat.push(message);  // Show the reason in chat
    mp.gui.cursor.show(true, true);  // Keep cursor visible after failure
});

// On successful login, hide UI, reset camera, and allow chat again
mp.events.add('login:success', () => {
    // Hide the login UI
    if (loginUI) {
        loginUI.execute(`hideLoginUI();`); // Call the function inside the CEF UI
    }

    // Reset camera to normal game view
    if (camera) {
        camera.setActive(false);  // Deactivate the camera
        mp.game.cam.renderScriptCams(false, false, 0, true, true);  // Return to normal game camera
    }

    // Hide the cursor after login
    mp.gui.cursor.show(false, false);

    mp.game.ui.displayRadar(true);

    // Re-enable the chat system
    mp.gui.chat.show(true);  // Enable chat

    // Allow the chat input again after login success
    isLoginUIActive = false;  // Set UI state to false
});

// Function to hide the cursor from the UI (if needed)
mp.events.add('login:hideCursor', () => {
    mp.gui.cursor.show(false, false);  // Hide the cursor
});

// Show error message in the login UI if login fails
mp.events.add('login:error', (message) => {
    if (loginUI) {
        loginUI.execute(`showErrorMessage("${message}")`);  // Show error inside the UI
    }
});



// client_scripts/character_selection.js
let browser;
let cameraChar;

mp.events.add('showCharacterSelectionUI', (charactersJson) => {
    cameraChar = mp.cameras.new('characterSelectionCam');
    cameraChar.setCoord(150.0, -1000.0, 300.0);
    cameraChar.pointAtCoord(441.0, -978.0, 30.0);
    cameraChar.setFov(70.0);
    cameraChar.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    mp.players.local.freezePosition(true);
    mp.players.local.setVisible(false, false);
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);

    browser = mp.browsers.new('package://cef/character_selection.html');
    browser.execute(`displayCharacters(${charactersJson})`);

    // Disable the chat input (to prevent T or t from opening chat)
    mp.gui.chat.show(false);  // Disable the chat

    // Delay to show the cursor
    setTimeout(() => {
        mp.gui.cursor.show(true, true);  // Ensure cursor is visible when UI opens
    }, 100);
});

mp.events.add('hidePlayerModel', () => {
    mp.players.local.setVisible(false, false); // Hide the PED
    mp.players.local.freezePosition(true); // Freeze to prevent movement
});


mp.events.add('selectCharacter', (charId) => {
    mp.events.callRemote('selectCharacter', charId);
    if (browser) {
        browser.destroy();
        browser = null;
    }
    if (cameraChar) {
        mp.game.cam.renderScriptCams(false, false, 0, true, false);
        cameraChar.setActive(false);
        cameraChar.destroy();
        cameraChar = null;
        mp.game.ui.displayHud(true);
        mp.game.ui.displayRadar(true);
    }

    mp.players.local.freezePosition(false);
    mp.players.local.setVisible(true, true);

    mp.gui.chat.show(true);
    mp.gui.cursor.show(false, false);  // Hide the cursor
});



mp.events.add('playerQuit', () => {
    if (browser) browser.destroy();
    if (cameraChar) {
        mp.game.cam.renderScriptCams(false, false, 0, true, false);
        cameraChar.destroy();
        mp.gui.chat.show(true);
        mp.gui.cursor.show(false, false);  // Hide the cursor
    }
});

