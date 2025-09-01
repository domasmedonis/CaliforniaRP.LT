<?php
session_start();
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = htmlspecialchars($_POST['email']);

    // Check if the email exists in the database
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->bindParam(':email', $email);
    $stmt->execute();
    $user = $stmt->fetch();

    if ($user) {
        // Generate a reset token and expiration time
        $token = bin2hex(random_bytes(50));
        $expires = date('U') + 1800; // Expires in 30 minutes

        // Save the token and expiration time in the database
        $stmt = $pdo->prepare("UPDATE users SET reset_token = :token, reset_expires = :expires WHERE id = :id");
        $stmt->bindParam(':token', $token);
        $stmt->bindParam(':expires', $expires);
        $stmt->bindParam(':id', $user['id']);
        $stmt->execute();

        // Send the reset email
        $reset_link = "https://californiarp.lt/ucp/reset_password.php?token=" . $token;
        $to = $email;
        $subject = "Slaptažodžio atkūrimas";
        $message = "Sveiki,\n\nNorėdami atkurti savo slaptažodį, spauskite nuorodą: " . $reset_link;
        $headers = "From: admin@californiarp.lt";

        if (mail($to, $subject, $message, $headers)) {
            $_SESSION['success_message'] = "Atkūrimo nuoroda išsiųsta el. paštu.";
        } else {
            $_SESSION['error_message'] = "Nepavyko išsiųsti el. laiško. Bandykite vėliau.";
        }
    } else {
        $_SESSION['error_message'] = "El. pašto adresas nerastas.";
    }
}
?>

<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pamiršote slaptažodį</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets/css/style2.css">
    <link rel="icon" type="image/png" sizes="32x32" href="./assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="./assets/images/favicon-16x16.png">
</head>
<body>
<div class="container mt-5">
    <h2>Pamiršote slaptažodį</h2>
    <?php if (isset($_SESSION['error_message'])): ?>
        <div class="alert alert-danger"><?php echo $_SESSION['error_message']; unset($_SESSION['error_message']); ?></div>
    <?php elseif (isset($_SESSION['success_message'])): ?>
        <div class="alert alert-success"><?php echo $_SESSION['success_message']; unset($_SESSION['success_message']); ?></div>
    <?php endif; ?>
    <form action="forgot_password.php" method="post">
        <input type="email" name="email" placeholder="Įveskite el. paštą" required>
        <button type="submit">Siųsti</button>
    </form>
</div>
</body>
</html>
