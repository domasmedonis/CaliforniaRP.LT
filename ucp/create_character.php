<?php
session_start();
require_once 'config.php'; // Ensure this connects to your database correctly

// Check if user is logged in
if (!isset($_SESSION['username'])) {
    header("Location: index.php"); // Redirect to login page if not logged in
    exit;
}

$username = $_SESSION['username'];

// Get user ID from the database using the username
$stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
$stmt->execute([$username]);
$user = $stmt->fetch();

// Debugging: Check if user was found
if (!$user) {
    die("Debug: User not found in the database for username: " . htmlspecialchars($username));
}

$user_id = $user['id']; // Get the actual user ID

// Process form submission only if POST request is made
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Sanitize and validate input
    $name = htmlspecialchars(trim($_POST['name']));
    $background = htmlspecialchars(trim($_POST['background']));

    // Ensure the name is in "First Last" format (two words with capital letters)
    if (!preg_match("/^[A-Z][a-z]+ [A-Z][a-z]+$/", $name)) {
        $_SESSION['error_message'] = 'Vardas Pavardė turi būti dvi žodžių, prasidedančių didžiosiomis raidėmis, pvz.: "John Doe".';
        header("Location: create_character.php"); // Redirect back to the form
        exit;
    }

    // Ensure the background story has at least 50 words
    if (str_word_count($background) < 50) {
        $_SESSION['error_message'] = 'Veikėjo istorija turi būti bent 50 žodžių.';
        header("Location: create_character.php"); // Redirect back to the form
        exit;
    }

    // Insert character into database
    try {
    $stmt = $pdo->prepare("INSERT INTO characters (user_id, name, background, status) VALUES (?, ?, ?, 'pending')");
    $stmt->execute([$user_id, $name, $background]);

    unset($_SESSION['error_message']);
    
    $_SESSION['success_message'] = 'Veikėjas sukurtas! Jūsų prašymas bus peržiūrėtas administracijos.';
    
    // Redirect to the character list after success
    header("Location: jusu_veikejai.php"); 
    exit;
} catch (PDOException $e) {
    $_SESSION['error_message'] = 'Klaida: ' . $e->getMessage();
    header("Location: create_character.php"); 
    exit;
}

}
?>

<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <title>Kurti veikėją</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="icon" type="image/png" sizes="32x32" href="./assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="./assets/images/favicon-16x16.png">
    <style>
        .form-container { max-width: 500px; margin: 0 auto; }
        .warning { color: red; display: none; }
    </style>
    <script>
        function checkWordCount() {
            const story = document.getElementById("background").value;
            const wordCount = story.trim().split(/\s+/).length;
            const warning = document.getElementById("warning");
            const submitBtn = document.getElementById("submit");

            if (wordCount < 50) {
                warning.style.display = "block";
                submitBtn.disabled = true;
            } else {
                warning.style.display = "none";
                submitBtn.disabled = false;
            }
        }

        function validateName() {
            const name = document.getElementById("name").value;
            const nameWarning = document.getElementById("nameWarning");
            const submitBtn = document.getElementById("submit");

            // Regex to match the "First Last" format
            const namePattern = /^[A-Z][a-z]+ [A-Z][a-z]+$/;

            if (!namePattern.test(name)) {
                nameWarning.style.display = "block";
                submitBtn.disabled = true;
            } else {
                nameWarning.style.display = "none";
                // Check if the background story also meets requirements
                const story = document.getElementById("background").value;
                const wordCount = story.trim().split(/\s+/).length;
                submitBtn.disabled = !(wordCount >= 50);
            }
        }
    </script>
</head>
<body>

<?php include 'sidebar.html'; ?>    

<div class="container mt-5">
    <h2 class="text-center pd50top">Kurti veikėją</h2>
    
    <?php
    // Display error message if exists
    if (isset($_SESSION['error_message'])) {
        echo '<div class="alert alert-danger">' . $_SESSION['error_message'] . '</div>';
        unset($_SESSION['error_message']);
    }

    // Display success message if exists
    if (isset($_SESSION['success_message'])) {
        echo '<div class="alert alert-success">' . $_SESSION['success_message'] . '</div>';
        unset($_SESSION['success_message']);
    }
    ?>

    <form action="create_character.php" method="POST" class="mt-4">
        <div class="form-group">
            <label for="name">Vardas Pavardė:</label>
            <input type="text" id="name" name="name" class="form-control" required onkeyup="validateName()">
            <p id="nameWarning" class="warning wText">Vardas Pavardė turi būti dvi žodžių, prasidedančių didžiosiomis raidėmis, pvz.: "John Doe".</p>
        </div>

        <div class="form-group">
            <label for="background">Veikėjo istorija:</label>
            <textarea id="background" name="background" class="form-control" onkeyup="checkWordCount()" required></textarea>
            <p id="warning" class="warning wText">Veikėjo istorija turi būti bent 50 žodžių.</p>
        </div>

        <button type="submit" id="submit" class="btn btn-primary">Sukurti veikėją</button>
    </form>
</div>

</body>
</html>
