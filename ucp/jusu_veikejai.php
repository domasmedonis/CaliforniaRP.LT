<?php
session_start();
require_once 'config.php';

// Check if user is logged in
if (!isset($_SESSION['username'])) {
    header("Location: index.php"); // Redirect to login page if not logged in
    exit;
}

$username = $_SESSION['username'];

// Get user ID from the database using the username
$stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? LIMIT 1");
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user) {
    die("Debug: User not found in the database for username: " . htmlspecialchars($username));
}

$user_id = $user['id']; // Get the actual user ID

// Fetch characters with accepted status
$stmt_accepted = $pdo->prepare("SELECT * FROM characters WHERE user_id = ? AND status = 'approved'");
$stmt_accepted->execute([$user_id]);
$accepted_characters = $stmt_accepted->fetchAll();

// Fetch characters with pending status
$stmt_pending = $pdo->prepare("SELECT * FROM characters WHERE user_id = ? AND status = 'pending'");
$stmt_pending->execute([$user_id]);
$pending_characters = $stmt_pending->fetchAll();

// Fetch declined characters
$stmt_declined = $pdo->prepare("SELECT * FROM characters WHERE user_id = ? AND status = 'rejected'");
$stmt_declined->execute([$user_id]);
$declined_characters = $stmt_declined->fetchAll();
?>

<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <title>Jūsų veikėjai</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="icon" type="image/png" sizes="32x32" href="./assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="./assets/images/favicon-16x16.png">
    <script>
        function toggleDeclinedCharacters() {
            const declinedSection = document.getElementById('declined-characters');
            const button = document.getElementById('toggle-button');
            if (declinedSection.style.display === 'none' || declinedSection.style.display === '') {
                declinedSection.style.display = 'block';
                button.textContent = 'Slėpti atmestus veikėjus';
            } else {
                declinedSection.style.display = 'none';
                button.textContent = 'Rodyti atmestus veikėjus';
            }
        }
    </script>
    <style>
        body {
            background: linear-gradient(to right, #f5f7fa, #c3cfe2);
            color: black;
            font-family: 'Arial', sans-serif;
        }
        .container {
            max-width: 1100px;
        }
        .card {
            background: rgba(255, 255, 255, 0.9);
            border: none;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            color: black;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            padding: 25px;
            box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
        }
        .card:hover {
            transform: scale(1.05);
            box-shadow: 0px 6px 25px rgba(0, 0, 0, 0.15);
        }
        .list-group-item {
            background: rgba(255, 255, 255, 0.95);
            border: none;
            color: black;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-radius: 10px;
            margin-bottom: 10px;
        }
        .btn-primary, .btn-secondary {
            border-radius: 50px;
            font-weight: bold;
            padding: 12px 25px;
            transition: 0.3s;
        }
        .btn-primary:hover, .btn-secondary:hover {
            transform: scale(1.1);
        }
    </style>
</head>
<body>

<?php include 'sidebar.html'; ?>   

<div class="container mt-5">
    <h2 class="text-center pd70">Jūsų veikėjai</h2>
    
    <?php if (isset($_SESSION['error_message'])): ?>
        <div class="alert alert-danger text-center"> <?php echo $_SESSION['error_message']; unset($_SESSION['error_message']); ?> </div>
    <?php endif; ?>

    <?php if (isset($_SESSION['success_message'])): ?>
        <div class="alert alert-success text-center"> <?php echo $_SESSION['success_message']; unset($_SESSION['success_message']); ?> </div>
    <?php endif; ?>

    <div class="row">
        <?php if (!empty($accepted_characters)): ?>
            <div class="col-md-12">
                <div class="row">
                    <?php foreach ($accepted_characters as $character): ?>
                        <div class="col-md-6">
                            <div class="card shadow-lg">
                                <ul class="list-group">
                                    <li class="list-group-item">
                                        <a href="user_stats.php?character_id=<?php echo $character['id']; ?>" class="charListName text-dark">
                                            <?php echo htmlspecialchars($character['name']); ?>
                                        </a>
                                        <span class="badge badge-success">Patvirtintas</span>
                                    </li>
                                    <li class="list-group-item">Žaidimo laikas: <strong><?php echo htmlspecialchars($character['play_time'] ?? '0'); ?> valandos</strong></li>
                                </ul>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endif; ?>

        <?php if (!empty($pending_characters)): ?>
            <div class="col-md-12">
                <h3>Laukiantys patvirtinimo</h3>
                <div class="row">
                    <?php foreach ($pending_characters as $character): ?>
                        <div class="col-md-4">
                            <div class="card shadow-lg">
                                <ul class="list-group">
                                    <li class="list-group-item">
                                        <a href="user_stats.php?character_id=<?php echo $character['id']; ?>" class="charListName text-dark">
                                            <?php echo htmlspecialchars($character['name']); ?>
                                        </a>
                                        <span class="badge badge-warning">Laukiama patvirtinimo</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <div class="text-center mt-4">
        <button id="toggle-button" class="btn btn-secondary" onclick="toggleDeclinedCharacters()">Rodyti atmestus veikėjus</button>
    </div>

    <div id="declined-characters" style="display: none; margin-top: 20px;">
        <div class="card shadow-lg">
            <h3>Atmesti veikėjai</h3>
            <?php if (empty($declined_characters)): ?>
                <div class="alert alert-info text-center">
                    Jūs neturite atmestų veikėjų.
                </div>
            <?php else: ?>
                <div class="row">
                    <?php foreach ($declined_characters as $declined_character): ?>
                        <div class="col-md-4">
                            <div class="card shadow-lg">
                                <ul class="list-group">
                                    <li class="list-group-item">
                                        <?php echo htmlspecialchars($declined_character['name']); ?> 
                                        <span class="badge badge-danger">Atmestas</span>
                                    </li>
                                    <li class="list-group-item">
                                        <strong>Priežastis:</strong> <?php echo htmlspecialchars($declined_character['decline_reason']); ?>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="text-center mt-4">
        <a href="create_character.php" class="btn btn-primary">Kurti veikėją</a>
    </div>
</div>

</body>
</html>
