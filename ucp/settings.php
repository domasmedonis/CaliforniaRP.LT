<?php
session_start();
require_once 'config.php';

// Check if user is logged in
if (!isset($_SESSION['username'])) {
    header("Location: index.php"); // Redirect to login page if not logged in
    exit;
}

$username = $_SESSION['username'];

// Get user details from the database
$stmt = $pdo->prepare("SELECT id, email, created_at FROM users WHERE username = ?");
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user) {
    die("User not found.");
}

$user_id = $user['id'];
$email = $user['email'];
$created_at = date("Y-m-d", strtotime($user['created_at']));

// Handle email change
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['change_email'])) {
    $new_email = filter_var($_POST['new_email'], FILTER_SANITIZE_EMAIL);
    
    if (filter_var($new_email, FILTER_VALIDATE_EMAIL)) {
        $stmt = $pdo->prepare("UPDATE users SET email = ? WHERE id = ?");
        $stmt->execute([$new_email, $user_id]);
        $_SESSION['success_message'] = "El. paštas sėkmingai atnaujintas!";
        header("Location: settings.php");
        exit;
    } else {
        $_SESSION['error_message'] = "Neteisingas el. pašto formatas!";
    }
}

// Handle password change
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['change_password'])) {
    $current_password = $_POST['current_password'];
    $new_password = $_POST['new_password'];
    $confirm_password = $_POST['confirm_password'];

    // Get current hashed password
    $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $user_password = $stmt->fetchColumn();

    // Verify current password
    if (password_verify($current_password, $user_password)) {
        // Check if new passwords match and meet the minimum length
        if ($new_password === $confirm_password && strlen($new_password) >= 6) {
            // Hash the new password before updating it
            $hashed_password = password_hash($new_password, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
            $stmt->execute([$hashed_password, $user_id]);

            // Log the user out after changing the password
            session_unset();  // Unset all session variables
            session_destroy();  // Destroy the session
            session_start();  // Start a new session
            
            $_SESSION['success_message'] = "Slaptažodis sėkmingai pakeistas! Prašome prisijungti su nauju slaptažodžiu.";
            header("Location: index.php");  // Redirect to the login page
            exit;
        } else {
            $_SESSION['error_message'] = "Nauji slaptažodžiai nesutampa arba yra per trumpi!";
        }
    } else {
        $_SESSION['error_message'] = "Neteisingas dabartinis slaptažodis!";
    }
}

?>

<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <title>Nustatymai</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets/css/style.css">
    <style>
        .profile-header {
            text-align: center;
            padding: 30px;
            background: linear-gradient(to right, #6a11cb, #2575fc);
            color: white;
            border-radius: 10px;
        }
        .profile-img {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 3px solid white;
            margin-top: -50px;
        }
        .settings-card {
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
    </style>
</head>
<body>
<?php include 'sidebar.html'; ?>
<div class="container mt-5 pd25top">

    <?php if (isset($_SESSION['error_message'])): ?>
        <div class="alert alert-danger text-center mt-3"> <?php echo $_SESSION['error_message']; unset($_SESSION['error_message']); ?> </div>
    <?php endif; ?>

    <?php if (isset($_SESSION['success_message'])): ?>
        <div class="alert alert-success text-center mt-3"> <?php echo $_SESSION['success_message']; unset($_SESSION['success_message']); ?> </div>
    <?php endif; ?>

    <div class="card p-4 mt-4 settings-card">
        <h4 class="text-center">Jūsų paskyros informacija</h4>
        <p><strong>Vartotojo vardas:</strong> <?php echo htmlspecialchars($username); ?></p>
        <p><strong>El. paštas:</strong> <?php echo htmlspecialchars($email); ?></p>
        <p><strong>Registracijos data:</strong> <?php echo htmlspecialchars($created_at); ?></p>
    </div>

    <div class="row mt-4">
        <div class="col-md-6">
            <div class="card p-4 settings-card">
                <h4 class="text-center">Keisti el. paštą</h4>
                <form method="post">
                    <div class="form-group">
                        <label>Naujas el. paštas</label>
                        <input type="email" name="new_email" class="form-control" required>
                    </div>
                    <button type="submit" name="change_email" class="btn btn-primary btn-block">Keisti el. paštą</button>
                </form>
            </div>
        </div>
        <div class="col-md-6">
            <div class="card p-4 settings-card">
                <h4 class="text-center">Keisti slaptažodį</h4>
                <form method="post">
                    <div class="form-group">
                        <label>Dabartinis slaptažodis</label>
                        <input type="password" name="current_password" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Naujas slaptažodis</label>
                        <input type="password" name="new_password" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Pakartokite naują slaptažodį</label>
                        <input type="password" name="confirm_password" class="form-control" required>
                    </div>
                    <button type="submit" name="change_password" class="btn btn-warning btn-block">Keisti slaptažodį</button>
                </form>
            </div>
        </div>
    </div>
</div>
</body>
</html>
