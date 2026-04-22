require('./gamemode');
require('./phone');


// Track weapon ammo and send updates to server
const WEAPON_UNARMED_HASH = mp.game.joaat('weapon_unarmed');
let lastTrackedAmmo = null;
let lastTrackedWeapon = null;

function getCurrentWeaponHash(localPlayer) {
    if (!localPlayer || !localPlayer.handle) return 0;

    try {
        if (mp.game && mp.game.weapon && typeof mp.game.weapon.getSelectedPedWeapon === 'function') {
            const selected = Number(mp.game.weapon.getSelectedPedWeapon(localPlayer.handle));
            if (Number.isFinite(selected)) {
                return selected;
            }
        }
    } catch (err) {
        // Ignore missing native errors on client builds.
    }

    const fallback = Number(localPlayer.weapon);
    return Number.isFinite(fallback) ? fallback : 0;
}

function getTotalAmmoForWeapon(localPlayer, weaponHash) {
    if (!localPlayer || !localPlayer.handle) return null;

    try {
        if (mp.game && mp.game.weapon && typeof mp.game.weapon.getAmmoInPedWeapon === 'function') {
            const totalAmmo = Number(mp.game.weapon.getAmmoInPedWeapon(localPlayer.handle, weaponHash));
            if (Number.isFinite(totalAmmo)) {
                return totalAmmo;
            }
        }
    } catch (err) {
        // Ignore missing native errors on client builds.
    }

    return null;
}

setInterval(() => {
    try {
        const localPlayer = mp.players.local;
        if (!localPlayer || !localPlayer.handle) return;

        const currentWeapon = Number(getCurrentWeaponHash(localPlayer));
        if (!Number.isFinite(currentWeapon) || currentWeapon === 0 || currentWeapon === WEAPON_UNARMED_HASH) {
            lastTrackedWeapon = null;
            lastTrackedAmmo = null;
            return;
        }

        const ammo = getTotalAmmoForWeapon(localPlayer, currentWeapon);
        if (!Number.isFinite(ammo)) {
            return;
        }

        if (ammo !== lastTrackedAmmo || currentWeapon !== lastTrackedWeapon) {
            lastTrackedAmmo = ammo;
            lastTrackedWeapon = currentWeapon;

            mp.events.callRemote('updateWeaponAmmo', currentWeapon, ammo);
        }
    } catch (err) {
        console.error('[WEAPONS] Client tracking error:', err.message);
    }
}, 1000); // Check every second

mp.events.add('playerWeaponShot', () => {
    try {
        const localPlayer = mp.players.local;
        if (!localPlayer || !localPlayer.handle) return;

        const weaponHash = Number(getCurrentWeaponHash(localPlayer));
        if (!Number.isFinite(weaponHash) || weaponHash === 0 || weaponHash === WEAPON_UNARMED_HASH) {
            return;
        }

        if (Number.isFinite(lastTrackedAmmo) && lastTrackedWeapon === weaponHash && lastTrackedAmmo > 0) {
            lastTrackedAmmo -= 1;
        }

        mp.events.callRemote('weaponShotFired', weaponHash);
    } catch (err) {
        console.error('[WEAPONS] playerWeaponShot tracking error:', err.message);
    }
});