<?php
session_start();

// Check if the user is logged in
if (!isset($_SESSION['username'])) {
    header("Location: index.php"); // Redirect to login page if not logged in
    exit;
}
?>

<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pagrindinis - Naujienos</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="icon" type="image/png" sizes="32x32" href="./assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="./assets/images/favicon-16x16.png">
    <style>
        .news-card {
            margin-bottom: 20px;
        }
        .news-card img {
            height: 150px; /* Adjust the height as needed */
            object-fit: cover;
        }
    </style>
</head>
<body>

<?php include 'sidebar.html'; ?>

<div class="container mt-5">
    <h2 class="text-center pd70">Sveiki atvykę į CaliforniaRP.LT</h2>
    <p class="text-center pd40">Čia rasite svarbiausias naujienas ir atnaujinimus.</p>

    <div class="row">
        <!-- Example news item -->
        <div class="col-md-4">
            <div class="card news-card">
                <img src="assets/images/news1.jpg" class="card-img-top" alt="Naujiena 1">
                <div class="card-body">
                    <h5 class="card-title">Veikėjų kūrimas</h5>
                    <p class="card-text">Laba. Norime jums padėkoti, kad apsilankėte mūsų projekte ir nusprendėte susikurti veikėją. Nuo šios dienos tą galima padaryti. Su šia paskyra turėsite prisijungti į žaidimą, o žaidime žaisti su sukurtais veikėjais. Veikėjus patvirtins arba atmes administracija. Veikėjai turi atitikti taisykles - jas galite rasti forume. Ačiū!</p>
                    <small class="text-muted">Data: 2024-10-30</small>
                </div>
            </div>
        </div>

        <!-- Add more news items here -->
    </div>
</div>

</body>
</html>
