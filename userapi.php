<?php

$users = array(
    "root" => array(
        "password" => "4d2ece30e1a503e92939b3bbbc9c96d6",
        "methods" => array(
            "*"
        )
    ),
    "dj" => array(
        "password" => "7d04e57900e1568abb18782fb70c4a28",
        "methods" => array(
            "shoutcast",
            "icecast"
        ),
        "cond" => (date("G") >= 12 && date("G") <= 14)
    )
);

if(!isset($_GET["authstring"]) || empty($_GET["authstring"]) || !isset($_GET["method"]) || empty($_GET["method"])) {
    die("0"); // If no authstring or no method is given, exit with allowness 0
}

list($username, $password) = explode(":", $_GET["authstring"]); // Split authstring into two parts: username and password
$password = md5($password); // Hash password with md5 (this is insecure but we don't need better passwords here)

if(!isset($users[$username]) || empty($users[$username]) || $users[$username]["password"] !== $password) {
    die("0"); // If username does not exist or password is wrong, exit with alloweness 0
}

if(!in_array($_GET["method"], $users[$username]["methods"]) && !in_array('*', $users[$username]["methods"])) {
    die("0"); // If this user is not allowed to call the server with the called method, exit with allowness 0
}

if(isset($users[$username]["cond"]) && !isset($users[$username]["cond"])) {
    die("2"); // If a condition is set and the condition is met, exit with allowness 2, which means, allow to kick current dj and stream
}

die("1"); // If none of the above conditions were met, exit wich allowness 1, which means, allow to connect to stream
