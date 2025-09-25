<?php
// login.php
if (isset($_SESSION['user'])) {
    header('Location: /');
    exit;
}
?>
<!doctype html>
<html>

<head>
    <meta charset="utf-8">
    <title>Giriş Yap - Otomatik CMS</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <style>
        body {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f5f5;
        }

        .login-box {
            min-width: 340px;
            max-width: 400px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 16px #0001;
            padding: 32px 28px;
        }

        .login-title {
            font-weight: bold;
            margin-bottom: 24px;
            text-align: center;
        }
    </style>
</head>

<body>
    <div class="login-box">
        <div class="login-title">Otomatik CMS Giriş</div>
        <form id="login-form">
            <div class="mb-3">
                <label class="form-label">Kullanıcı Adı</label>
                <input class="form-control" name="username" required autofocus>
            </div>
            <div class="mb-3">
                <label class="form-label">Şifre</label>
                <input class="form-control" name="password" type="password" required>
            </div>
            <button class="btn btn-primary w-100" type="submit">Giriş Yap</button>
        </form>
        <div id="login-error" class="text-danger mt-3" style="display:none"></div>
    </div>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script>
        $(function() {
            $('#login-form').on('submit', function(e) {
                e.preventDefault();
                $('#login-error').hide();
                $.ajax({
                    url: 'api.php?action=login',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        username: this.username.value,
                        password: this.password.value
                    })
                }).done(function(resp) {
                    if (resp.ok) {
                        try {
                            localStorage.setItem('currentUser', JSON.stringify(resp.user));
                        } catch (e) {}
                        window.location.href = '/';
                    } else {
                        $('#login-error').text(resp.error || 'Hatalı giriş!').show();
                    }
                }).fail(function() {
                    $('#login-error').text('Sunucu hatası!').show();
                });
            });
        });
    </script>
</body>

</html>