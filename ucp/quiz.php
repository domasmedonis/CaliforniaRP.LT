<?php
session_start();

// Check if the user is logged in; if yes, redirect to user_stats.php
if (isset($_SESSION['username'])) {
    header("Location: dashboard.php");
    exit();
}

// Questions for the quiz
$questions = [
    [
        'question' => 'Kas yra roleplay?',
        'options' => [
            'A' => 'Žaidimas, kuriame žaidėjai atkartoja realybę.',
            'B' => 'Žaidimas, kuriame žaidėjai kovoja tarpusavyje.',
            'C' => 'Žaidimas, kuriame reikia rinkti taškus.',
            'D' => 'Žaidimas, kuriame reikia statyti pastatus.'
        ],
        'answer' => 'A'
    ],
    [
        'question' => 'Kam yra laikomasi griežtų roleplay taisyklių?',
        'options' => [
            'A' => 'Nėra taisyklių, čia freeroam.',
            'B' => 'Taisyklės sukurtos, kad užtikrinti realistiškumą serveryje ir užtikrinti pozityvią patirtį visiem.',
            'C' => 'Svarbiausia neįžeidinėti administracijos - visą kitą galima.',
            'D' => 'Kad galėtum nepatinkantį asmenį išmesti iš serverio.'
        ],
        'answer' => 'B'
    ],
    [
        'question' => 'Ką turėtų daryti žaidėjas, kai juos nužudo?',
        'options' => [
            'A' => 'Parašyti /report, kad administracija pagydytų.',
            'B' => 'Atkeršyti už savo mirtį.',
            'C' => 'Išeiti iš serverio.',
            'D' => 'Sekti žaidimo taisykles ir elgtis atitinkamai.'
        ],
        'answer' => 'D'
    ],
    [
        'question' => 'Ar serveryje gali šaudyti, vogti, vartoti narkotikus laisvai?',
        'options' => [
            'A' => 'Tai turi atitikti tavo veikėjo background, neturi prasilenkti su realybe.',
            'B' => 'Taip, narkotikus ir ginklus pasigamini prekeivio darbe ir gali parduoti, vartoti kaip nori.',
            'C' => 'Per voice chat subazarini su baryga ir judat kaip norit.',
            'D' => 'Los Santos mieste didelis nusikalstamumas - apvogti gali visus kas panašus į grybą.'
        ],
        'answer' => 'A'
    ],
    [
        'question' => 'Kas yra metagaming?',
        'options' => [
            'A' => 'Informacijos naudojimas, kurią žaidėjas gavo už žaidimo ribų.',
            'B' => 'Neleisti žaidėjui atsakyti į jūsų /me komandą.',
            'C' => 'Naudoti /b komandą be reikalo.',
            'D' => 'Žaidimas be taisyklių.'
        ],
        'answer' => 'A'
    ],
    [
        'question' => 'Ką reiškia IC (in character)?',
        'options' => [
            'A' => 'Voice chat pagalba organizuoti bazarų kovas.',
            'B' => 'Tai visą kas vyksta veikėjų realybėje (vietinių gaujų susišaudymai, policijos reidai ir kita).',
            'C' => 'Kalėdinis tūsas, kuriame visi serverio žaidėjai užsideda kaledinęs kepures ir organizuoja drift eventą.',
            'D' => 'Voice chat pagalba užtikrinti, kad Jonas_Jonukas kalbėtų plonesniu balsu.'
        ],
        'answer' => 'B'
    ],
    [
        'question' => 'Ką daryti, jei stebite, kaip kitas žaidėjas nesilaiko taisyklių?',
        'options' => [
            'A' => 'Pranešti administratoriui arba moderatoriams.',
            'B' => 'Ignoruoti tai.',
            'C' => 'Dalyvauti situacijoje ir pasakyti jiems.',
            'D' => 'Išeiti iš žaidimo.'
        ],
        'answer' => 'A'
    ],
    [
        'question' => 'Ką turėtumėte daryti, jei norite pasiekti sėkmės roleplay serveriuose?',
        'options' => [
            'A' => 'Laikytis žaidimo taisyklių ir bendradarbiauti su kitais žaidėjais.',
            'B' => 'Varyti žvejoti ar dirbti fūristų kuo įmanoma daugiau valandų per dieną.',
            'C' => 'Susikurti veikėją Andriukas_Jonukas ir serveryje suburti xebrytę.',
            'D' => 'Nusipirkti kreditų arba susimokėti už administratorių.'
        ],
        'answer' => 'A'
    ],
    [
        'question' => 'Koks yra geras būdas pradėti roleplay mūsų serveryje?',
        'options' => [
            'A' => 'Prisijungti į serverį ir voice chat pagalba bandyti gauti ginklų, narkotikų ir pinigų.',
            'B' => 'Sugalvoti savo veikėjo backgroundą ir atitinkamai perteikti savo istoriją serveryje.',
            'C' => 'Susikūrus veikėją /pm visus kas gali suveikti ginklų, narkotikų ar pinigų.',
            'D' => 'Prisijungus pirmą kartą į serverį įsidarbinsite policijoje ir gaudysite serverio nusikaltėlius.'
        ],
        'answer' => 'B'
    ],
    [
        'question' => 'Ar mūsų serveryje egzistuoja robbery ir scam taisyklės?',
        'options' => [
            'A' => 'Taip, egzistuoja taisyklės, kurių privalau laikytis ir negaliu apvogti bet ko ir bet kur.',
            'B' => 'Ne, galiu apvogti ką noriu jei turiu ginklą.',
            'C' => 'Ne, esu gaujinių bosas ir galiu daryti ką noriu - visi manęs turi bijoti.',
            'D' => 'Taip, negali apvogti administracijos.'
        ],
        'answer' => 'A'
    ]
];


// Initialize the quiz session
if (!isset($_SESSION['quiz_started'])) {
    $_SESSION['quiz_started'] = true;
    $_SESSION['score'] = 0; // Initialize score
}

// Process the quiz submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $selected_answers = $_POST['answers'] ?? [];
    foreach ($selected_answers as $key => $answer) {
        if (isset($questions[$key]) && $questions[$key]['answer'] === $answer) {
            $_SESSION['score']++;
        }
    }

    // Check if the user passed the quiz (e.g., score of 8 or higher)
    if ($_SESSION['score'] >= 8) {
        $_SESSION['quiz_passed'] = true; // Set quiz passed
        $_SESSION['quiz_passed_time'] = time(); // Store the current time when quiz passed
        header("Location: register.php?status=success"); // Redirect to registration page
        exit();
    } else {
        $_SESSION['error_message'] = 'Nepavyko išlaikyti testo. Prašome bandyti dar kartą.'; // Error message
        unset($_SESSION['score']); // Reset score on failure
        header("Location: quiz.php"); // Redirect back to quiz
        exit();
    }
}

?>

<!DOCTYPE html>
<html lang="lt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Roleplay Testas</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets/css/style.css"> <!-- Your custom CSS -->
    <link rel="icon" type="image/png" sizes="32x32" href="./assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="./assets/images/favicon-16x16.png">
</head>
<body class="centruoti">

<div class="container mt-5">
    <h1 class="text-center text-shadow">Roleplay Testas</h1>

    <!-- Error Message Placeholder -->
    <?php if (isset($_SESSION['error_message'])): ?>
        <div class="alert alert-danger" role="alert">
            <?php echo $_SESSION['error_message']; unset($_SESSION['error_message']); ?>
        </div>
    <?php endif; ?>

    <form action="quiz.php" method="post">
        <?php foreach ($questions as $index => $question): ?>
            <div class="form-group">
                <h4><?php echo ($index + 1) . '. ' . $question['question']; ?></h4>
                <?php foreach ($question['options'] as $key => $option): ?>
                    <div>
                        <input type="radio" id="question_<?php echo $index; ?>_<?php echo $key; ?>" name="answers[<?php echo $index; ?>]" value="<?php echo $key; ?>" required>
                        <label for="question_<?php echo $index; ?>_<?php echo $key; ?>"><?php echo $option; ?></label>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endforeach; ?>

        <button type="submit" class="btn btn-primary">Siųsti atsakymus</button>
    </form>
</div>

</body>
</html>
