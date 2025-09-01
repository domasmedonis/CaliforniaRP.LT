<?php
session_start();
require_once 'config.php';

if (isset($_GET['token'])) {
    $token = $_GET['token'];
    $stmt = $pdo->prepare("SELECT * FROM users WHERE confirmation_token = :token");
    $stmt->bindParam(':token', $token);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        // Confirm the email
        $stmt = $pdo->prepare("UPDATE users SET is_confirmed = 1, confirmation_token = NULL WHERE confirmation_token = :token");
        $stmt->bindParam(':token', $token);
        $stmt->execute();
        
        $_SESSION['success_message'] = 'Jūsų elektroninis paštas buvo patvirtinas. Galite prisijungti.';
        header("Location: index.php");
        exit;
    } else {
        $_SESSION['error_message'] = 'Neteisinga patvirtinimo nuoroda.';
        header("Location: index.php");
        exit;
    }
}
?>
