<?php
session_start();
require_once 'config.php'; // Adjust the path if needed

if (isset($_SESSION['username'])) {
    header("Location: dashboard.php"); // Redirect to user_stats.php
    exit();
}

// Check if the user has completed the quiz
if (!isset($_SESSION['quiz_passed']) || $_SESSION['quiz_passed'] !== true) {
    // If not completed, redirect to the quiz page
    header("Location: quiz.php");
    exit();
}

// Check if 15 minutes have passed since the quiz was passed
if (isset($_SESSION['quiz_passed_time'])) {
    $quizPassedTime = $_SESSION['quiz_passed_time'];
    $currentTime = time();
    $timeDiff = $currentTime - $quizPassedTime;

    // If more than 15 minutes (900 seconds) have passed, reset the quiz
    if ($timeDiff > 900) {
        unset($_SESSION['quiz_passed']);
        unset($_SESSION['quiz_passed_time']);
        header("Location: quiz.php"); // Redirect to quiz to retake
        exit();
    }
}

// Initialize success message variable
$quizSuccessMessage = '';

// Check if form is submitted
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Retrieve and sanitize form data
    $username = htmlspecialchars($_POST['username']);
    $email = htmlspecialchars($_POST['email']);
    $password = $_POST['password'];
    $confirm_password = $_POST['confirm_password'];

    // Check if passwords match
    if ($password !== $confirm_password) {
        $_SESSION['error_message'] = 'Jūsų slaptažodžiai nesutampa.';
    } else {
        // Hash password
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);

        // Check for existing username or email
        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = :username OR email = :email");
        $stmt->bindParam(':username', $username);
        $stmt->bindParam(':email', $email);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $_SESSION['error_message'] = 'Vartotojo vardas arba elektroninis paštas yra užimtas.';
        } else {
            // Insert new user into the database
            $token = bin2hex(random_bytes(16)); // Generate a random token
            $stmt = $pdo->prepare("INSERT INTO users (username, email, password, is_confirmed, confirmation_token) VALUES (:username, :email, :password, 0, :token)");
            $stmt->bindParam(':username', $username);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':password', $hashed_password);
            $stmt->bindParam(':token', $token);

            if ($stmt->execute()) {
                // Prepare the email
                $to = $email;
                $subject = 'Please confirm your email';
                $message = "Click the link below to confirm your email:\n";
                $message .= "http://californiarp.lt/ucp/confirm.php?token=$token"; // Change to your domain
                $headers = 'From: info@californiarp.lt' . "\r\n" .
                           'Reply-To: info@californiarp.lt' . "\r\n" .
                           'X-Mailer: PHP/' . phpversion();

                // Send the email
                if (mail($to, $subject, $message, $headers)) {
                    $_SESSION['success_message'] = 'Sėkmingai užsiregistravote! Patvirtinkite savo elektroninį paštą.';
                } else {
                    $_SESSION['error_message'] = 'Esate užregistruotas tačiau nepavyko išsiųsti elektroninio laiško.';
                }

                // After successful registration, reset quiz completion status
                unset($_SESSION['quiz_passed']);
                unset($_SESSION['quiz_passed_time']);
                
                // Redirect to index after registration
                header("Location: index.php");
                exit;
            } else {
                $_SESSION['error_message'] = 'Registracija nepavyko. Bandykite dar kartą';
            }
        }
    }
}

// Set the success message only if there are no error messages
if (isset($_SESSION['quiz_passed']) && $_SESSION['quiz_passed'] === true && empty($_SESSION['error_message'])) {
    $quizSuccessMessage = 'Sėkmingai išlaikėte testą! Dabar galite užsiregistruoti.';
}
?>

<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registracija</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="icon" type="image/png" sizes="32x32" href="./assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="./assets/images/favicon-16x16.png">
</head>
<body>

<div class="container mt-5">
    <h1 class="text-center pd50top">Registracijos forma</h1>
    
    <!-- Error Message Placeholder -->
    <?php if (isset($_SESSION['error_message'])): ?>
        <div class="alert alert-danger" role="alert">
            <?php echo $_SESSION['error_message']; unset($_SESSION['error_message']); ?>
        </div>
    <?php endif; ?>

    <!-- Success Message Placeholder -->
    <?php if ($quizSuccessMessage): ?>
        <div class="alert alert-success" role="alert">
            <?php echo $quizSuccessMessage; ?>
        </div>
    <?php endif; ?>

    <div class="form-container">
        <form action="register.php" method="post" class="was-validated">
            <div class="form-group">
                <label for="username">Vartotojo vardas:</label>
                <input type="text" class="form-control" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="email">El. paštas:</label>
                <input type="email" class="form-control" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="password">Slaptažodis:</label>
                <input type="password" class="form-control" id="password" name="password" required>
            </div>
            <div class="form-group">
                <label for="confirm_password">Patvirtinkite slaptažodį:</label>
                <input type="password" class="form-control" id="confirm_password" name="confirm_password" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Registruotis</button>
        </form>
        <p class="text-center mt-3">Jau turite paskyrą? <a href="index.php">Prisijunkite čia</a></p>
    </div>
</div>

</body>
</html>
