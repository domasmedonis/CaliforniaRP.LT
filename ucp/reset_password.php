<?php
session_start();
require_once 'config.php';

if (isset($_GET['token'])) {
    $token = $_GET['token'];

    // Check if token is valid and has not expired
    $stmt = $pdo->prepare("SELECT id, reset_expires FROM users WHERE reset_token = :token");
    $stmt->bindParam(':token', $token);
    $stmt->execute();
    $user = $stmt->fetch();

    if ($user && $user['reset_expires'] >= date('U')) {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $new_password = password_hash($_POST['password'], PASSWORD_DEFAULT);

            // Update the password in the database
            $stmt = $pdo->prepare("UPDATE users SET password = :password, reset_token = NULL, reset_expires = NULL WHERE id = :id");
            $stmt->bindParam(':password', $new_password);
            $stmt->bindParam(':id', $user['id']);
            $stmt->execute();

            $_SESSION['success_message'] = "Slaptažodis sėkmingai pakeistas. Prašome prisijungti.";
            header("Location: index.php");
            exit;
        }
    } else {
        $_SESSION['error_message'] = "Netinkama arba pasibaigusi nuoroda.";
        header("Location: forgot_password.php");
        exit;
    }
}
?>

<!-- HTML form for the user to reset their password -->
<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Atnaujinti slaptažodį</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets/css/style2.css">
    <link rel="icon" type="image/png" sizes="32x32" href="./assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="./assets/images/favicon-16x16.png">
</head>
<body>
<div class="container mt-5">
    <h2>Atnaujinti slaptažodį</h2>
    <?php if (isset($_SESSION['error_message'])): ?>
        <div class="alert alert-danger"><?php echo $_SESSION['error_message']; unset($_SESSION['error_message']); ?></div>
    <?php endif; ?>
    <form action="reset_password.php?token=<?php echo htmlspecialchars($token); ?>" method="post">
        <input type="password" name="password" placeholder="Įveskite naują slaptažodį" required>
        <button type="submit">Atnaujinti slaptažodį</button>
    </form>
</div>
</body>
</html>

