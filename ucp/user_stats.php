<?php
session_start();
require_once 'config.php'; // Database connection

// Check if the user is logged in
if (!isset($_SESSION['username'])) {
    // Redirect to login page if not logged in
    header("Location: index.php");
    exit;
}

// Get user ID from the database based on the username
$username = $_SESSION['username'];
$stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user) {
    // Handle user not found case
    $_SESSION['error_message'] = 'Vartotojas nerastas.';
    header("Location: index.php");
    exit;
}

$user_id = $user['id'];

// Get character ID from the query string
$character_id = $_GET['character_id'] ?? null;

if (!$character_id) {
    $_SESSION['error_message'] = 'Veikėjas nerastas.';
    header("Location: jusu_veikejai.php");
    exit;
}

// Fetch character details
$stmt = $pdo->prepare("SELECT * FROM characters WHERE id = ? AND user_id = ?");
$stmt->execute([$character_id, $user_id]);
$character = $stmt->fetch();

if (!$character || $character['status'] === 'pending') {
    $_SESSION['error_message'] = 'Veikėjas nerastas arba laukia patvirtinimo.';
    header("Location: jusu_veikejai.php");
    exit;
}

// Display character stats
?>

<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vartotojo Statistikos</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/sidebar.css">
    <link href='https://unpkg.com/boxicons@2.1.1/css/boxicons.min.css' rel='stylesheet'>
    <link rel="icon" type="image/png" sizes="32x32" href="./assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="./assets/images/favicon-16x16.png">
</head>
<body>

<?php include 'sidebar.html'; ?>    

<div class="centruoti">
    <div class="container h70 w80">
        <div class="main-content" style="flex: 1;"> <!-- Main content takes available space -->
            <h1 class="text-center text-shadow pd50top">Veikėjo statistika: <?php echo htmlspecialchars($character['name']); ?></h1>
            <p class="text-center text-shadow">Čia galite peržiūrėti savo statistiką ir informaciją.</p>

            <!-- User Stats Card -->
            <ul class="list-group">
                <li class="list-group-item">Veikėjo vardas: <strong><?php echo htmlspecialchars($character['name']); ?></strong></li>
                <li class="list-group-item">Balansas: <strong><?php echo htmlspecialchars($character['balance'] ?? '0'); ?></strong></li>
                <li class="list-group-item">Turimos transporto priemonės: <strong><?php echo htmlspecialchars($character['vehicles'] ?? 'Nėra'); ?></strong></li>
                <li class="list-group-item">Turimos nuosavybės: <strong><?php echo htmlspecialchars($character['properties'] ?? 'Nėra'); ?></strong></li>
            </ul>
        </div>
    </div>
</div>
</body>
</html>
