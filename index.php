<?php
session_start();
if (!isset($_SESSION['user'])) {
    header('Location: /giris');
    exit;
}
// index.php (aynı layout, admin.js çağrısı güncellendi)
?>
<!doctype html>
<html>

<head>
    <meta charset="utf-8">
    <title>Otomatik CMS</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <style>
        .admin-table-link {
            background: #eaf4ff !important;
            color: #1761a0 !important;
            font-weight: bold;
            border-left: 4px solid #1761a0;
        }

        body {
            height: 100vh;
            overflow: hidden;
        }

        .sidebar {
            width: 220px;
            background: #2f353a;
            color: #cfd8dc;
            height: 100%;
            position: fixed;
        }

        .sidebar a {
            color: #cfd8dc;
            display: block;
            padding: 10px 16px;
            text-decoration: none;
        }

        .content {
            margin-left: 220px;
            padding: 24px;
            height: 100%;
            overflow: auto;
        }

        .label-edit {
            cursor: pointer;
            color: #0d6efd;
            text-decoration: underline;
            font-size: 0.9rem;
        }

        .img-thumb {
            max-width: 80px;
            max-height: 50px;
            display: block;
        }
    </style>
</head>

<body>
    <!-- Oturum kontrolü PHP ile yapılmaktadır. -->
    <div class="sidebar p-2">
        <h5 class="px-2">CMS</h5>
        <hr style="border-color:#3b4146">
        <div id="menu-tables"></div>
        <hr style="border-color:#3b4146">
        <!-- <div><a href="#" id="refresh-tables">Yenile</a></div> -->
    </div>

    <div class="content">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 id="page-title">Otomatik CMS</h3>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-secondary" id="btn-back" style="display:none">Geri</button>
                <button class="btn btn-primary" id="btn-new-record" style="display:none">Yeni Kayıt</button>
            </div>
        </div>

        <div id="panel-area">
            <div id="form-area"></div>
            <div id="list-area"></div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="admin.js"></script>
</body>

</html>