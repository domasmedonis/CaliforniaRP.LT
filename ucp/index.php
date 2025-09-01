<?php
session_start();

// Check if user is logged in
if (isset($_SESSION['username'])) {
    // User is logged in, redirect to user_stats.php
    header("Location: dashboard.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CaliforniaRP.LT - UCP</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="icon" type="image/png" sizes="32x32" href="./assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="./assets/images/favicon-16x16.png">

    <meta property="og:title" content="CaliforniaRP.LT">
    <meta property="og:description" content="Grand Theft Auto V roleplay serveris">
    <meta property="og:image" content="https://i.imgur.com/HJz3CcA.png">
    <meta property="og:url" content="https://californiarp.lt/ucp">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">

</head>
<body>

<div class="centruoti">

<div class="container pd70">
    <h1 class="text-center text-shadow mg50">Sveiki atvykę į vartotojo valdymo pultą</h1>
    
    <!-- Success Message Placeholder -->
    <?php if (isset($_SESSION['success_message'])): ?>
        <div class="alert alert-success" role="alert">
            <?php echo $_SESSION['success_message']; unset($_SESSION['success_message']); ?>
        </div>
    <?php endif; ?>
    
    <!-- Error Message Placeholder -->
    <?php if (isset($_SESSION['error_message'])): ?>
        <div class="alert alert-danger" role="alert">
            <?php echo $_SESSION['error_message']; unset($_SESSION['error_message']); ?>
        </div>
    <?php endif; ?>
    
    <!-- Login Form -->
    <div class="mt-4 form-container ">
        <form action="login.php" method="post" class="was-validated">
            <div class="form-group">
                <label for="username">Vartotojo vardas:</label>
                <input type="text" class="form-control" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="password">Slaptažodis:</label>
                <input type="password" class="form-control" id="password" name="password" required>
            </div>
            <p class="text-right mt-3 forgotpasstext"><a href="forgot_password.php">Pamiršote slaptažodį?</a></p>
            <button type="submit" class="btn btn-primary btn-block">Prisijungti</button>
        </form>

        <!-- Register Button -->
        <div class="text-center mt-3 mgtop20">
            <a href="register.php" class="registertext">Registruotis</a>
        </div>

    </div>
</div>

</div>
</body>
</html>
