// admin.js
$(function () {
    let currentUser = null;
    // Sayfa yüklenince localStorage'dan kullanıcıyı yükle, yoksa sunucudan iste
    let userLoaded = false;
    try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            userLoaded = true;
        }
    } catch (e) { }
    function redirectToLogin() {
        window.location.href = '/giris';
    }
    function checkAuth(cb) {
        if (userLoaded && currentUser) {
            cb && cb();
        } else {
            $.getJSON('api.php?action=whoami').done(function (resp) {
                if (resp && resp.ok && resp.user) {
                    currentUser = resp.user;
                    try { localStorage.setItem('currentUser', JSON.stringify(currentUser)); } catch (e) { }
                    cb && cb();
                } else {
                    redirectToLogin();
                }
            }).fail(redirectToLogin);
        }
    }
    // Tüm kodu yetki kontrolünden sonra başlat

    checkAuth(function () {
        // Profil butonu ekle
        function addProfileButton() {
            // Eğer zaten eklenmişse tekrar ekleme
            if ($('#profile-actions').length) return;
            // Profil ve çıkış butonlarını içeren sabit bir div oluştur
            const actionsDiv = $(`
                <div id="profile-actions" style="position: absolute; bottom: 24px; left: 0; width: 100%; padding: 0 16px;">
                    <button id="btn-profile" class="btn btn-outline-secondary w-100 mb-2">Profilim</button>
                    <button id="btn-logout" class="btn btn-outline-danger w-100 mb-2">Çıkış Yap</button>
                </div>
            `);
            actionsDiv.find('#btn-profile').on('click', showProfileModal);
            actionsDiv.find('#btn-logout').on('click', function () {
                showSpinner();
                api('logout', {}, 'POST').always(() => {
                    hideSpinner();
                    currentUser = null;
                    $('#profile-actions').remove();
                    $('#menu-tables').empty();
                    $('#list-area').html('<div class="text-muted">Soldan bir tablo seçin.</div>');
                    redirectToLogin();
                });
            });
            // Sidebar'a ekle (sidebar varsa)
            if ($('.sidebar').length) {
                $('.sidebar').append(actionsDiv);
            } else {
                // Yedek: menü-tables'ın sonuna ekle
                $('#menu-tables').after(actionsDiv);
            }
        }

        function showProfileModal() {
            if (!currentUser) return;
            let html = `<div class="modal fade" id="profileModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">Profilim</h5></div>
            <div class="modal-body">
                <form id="profile-form">
                    <div class="mb-3"><label>Kullanıcı Adı</label><input class="form-control" name="username" value="${escapeHtml(currentUser.username)}" required></div>
                    <div class="mb-3"><label>Yeni Şifre</label><input class="form-control" name="password" type="password" placeholder="Değiştirmek için doldurun"></div>
                    <div class="mb-3"><label>Şifre Tekrar</label><input class="form-control" name="password2" type="password" placeholder="Tekrar"></div>
                    <button class="btn btn-primary w-100" type="submit">Kaydet</button>
                </form>
            </div>
        </div></div></div>`;
            $(document.body).append(html);
            let m = new bootstrap.Modal(document.getElementById('profileModal'));
            m.show();
            $('#profile-form').on('submit', function (e) {
                e.preventDefault();
                let pass = this.password.value;
                let pass2 = this.password2.value;
                let username = this.username.value.trim();
                if (!username) {
                    showToast('Kullanıcı adı boş olamaz', 'danger');
                    return;
                }
                if (pass && pass !== pass2) {
                    showToast('Şifreler eşleşmiyor', 'danger');
                    return;
                }
                showSpinner();
                api('update_profile', { username: username, password: pass }, 'POST').done(resp => {
                    if (resp.ok && resp.user) {
                        currentUser.username = resp.user.username;
                        try { localStorage.setItem('currentUser', JSON.stringify(currentUser)); } catch (e) { }
                    }
                    hideSpinner();
                    if (resp.ok) {
                        showToast('Profil güncellendi');
                        m.hide();
                        $('#profileModal').remove();
                    } else {
                        showToast(resp.error || 'Hata', 'danger');
                    }
                }).fail(() => { hideSpinner(); showToast('Sunucu hatası', 'danger'); });
            });
        }
        const apiUrl = 'api.php';
        const api = (action, data = {}, method = 'GET', opts = {}) => {
            if (method.toUpperCase() === 'GET') {
                return $.getJSON(apiUrl + '?action=' + action + (data ? '&' + $.param(data) : ''));
            } else {
                if (opts.isFormData) {
                    let fd = data;
                    try { localStorage.removeItem('currentUser'); } catch (e) { }
                    return $.ajax({
                        url: apiUrl + '?action=' + action,
                        method: 'POST',
                        data: fd,
                        processData: false,
                        contentType: false
                    });
                } else {
                    return $.ajax({
                        url: apiUrl + '?action=' + action,
                        method: method,
                        contentType: 'application/json',
                        data: JSON.stringify(data)
                    });
                }
            }
        };

        // --- TOAST ---
        function showToast(msg, type = 'success') {
            let id = 'toast-' + Date.now();
            let html = `<div id="${id}" class="toast align-items-center text-bg-${type == 'success' ? 'success' : 'danger'} border-0 show position-fixed bottom-0 end-0 m-3" role="alert" aria-live="assertive" aria-atomic="true" style="z-index:9999;min-width:200px;">
                <div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div></div>`;
            $(document.body).append(html);
            setTimeout(() => $('#' + id).remove(), 3500);
        }

        // --- SPINNER ---
        function showSpinner() {
            if ($('#global-spinner').length) return;
            $(document.body).append('<div id="global-spinner" style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9998;background:rgba(255,255,255,0.5)"><div class="spinner-border text-primary position-absolute top-50 start-50 translate-middle" style="width:3rem;height:3rem"></div></div>');
        }
        function hideSpinner() { $('#global-spinner').remove(); }

        // --- LOGIN MODAL ---
        function showLoginModal() {
            let html = `<div class="modal fade" id="loginModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
                <div class="modal-header"><h5 class="modal-title">Giriş Yap</h5></div>
                <div class="modal-body">
                    <form id="login-form">
                        <div class="mb-3"><label>Kullanıcı Adı</label><input class="form-control" name="username" required></div>
                        <div class="mb-3"><label>Şifre</label><input class="form-control" name="password" type="password" required></div>
                        <button class="btn btn-primary w-100" type="submit">Giriş</button>
                    </form>
                </div>
            </div></div></div>`;
            $(document.body).append(html);
            let m = new bootstrap.Modal(document.getElementById('loginModal'));
            m.show();
            $('#login-form').on('submit', function (e) {
                e.preventDefault();
                showSpinner();
                api('login', {
                    username: this.username.value,
                    password: this.password.value
                }, 'POST').done(resp => {
                    hideSpinner();
                    if (resp.ok) {
                        showToast('Giriş başarılı');
                        currentUser = resp.user;
                        m.hide();
                        $('#loginModal').remove();
                        loadTables();
                    } else {
                        showToast(resp.error || 'Hata', 'danger');
                    }
                }).fail(() => { hideSpinner(); showToast('Sunucu hatası', 'danger'); });
            });
        }

        // --- LABEL MODAL ---
        function showLabelModal(table, col, currentLabel, cb) {
            $('#labelModal').remove(); // Eski modalı temizle
            let html = `<div class="modal fade" id="labelModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
                <div class="modal-header"><h5 class="modal-title">Etiket Düzenle</h5></div>
                <div class="modal-body">
                    <form id="label-form">
                        <div class="mb-3"><label>Yeni Label</label><input class="form-control" name="label" value="${currentLabel || ''}" required></div>
                        <button class="btn btn-primary w-100" type="submit">Kaydet</button>
                    </form>
                </div>
            </div></div></div>`;
            $(document.body).append(html);
            let m = new bootstrap.Modal(document.getElementById('labelModal'));
            m.show();
            $('#label-form').on('submit', function (e) {
                e.preventDefault();
                showSpinner();
                api('save_label', { table, column: col, label: this.label.value }, 'POST').done(() => {
                    hideSpinner();
                    showToast('Etiket kaydedildi');
                    m.hide();
                    $('#labelModal').remove();
                    cb && cb();
                }).fail(() => { hideSpinner(); showToast('Sunucu hatası', 'danger'); });
            });
        }

        // --- SOL MENÜ ---
        function loadTables() {
            addProfileButton();
            showSpinner();
            api('list_tables').done(resp => {
                hideSpinner();
                const div = $('#menu-tables').empty();
                let items = resp.routes || resp.tables || [];
                // Sadece admin görebileceği tablolar
                const adminOnlyTables = ['cms_field_labels', 'cms_routes', 'users'];
                // Admin tabloları ve diğerleri ayrı blokta göster
                let adminLinks = [];
                let otherLinks = [];
                items.forEach(t => {
                    let name = t.route_name || t;
                    let label = t.route_label || t;
                    let icon = t.route_icon ? `<i class="${t.route_icon}"></i> ` : '';
                    if (currentUser && currentUser.role !== 'yonetici' && adminOnlyTables.includes(name)) return;
                    let extraClass = '';
                    if (currentUser && currentUser.role === 'yonetici' && adminOnlyTables.includes(name)) {
                        extraClass = ' admin-table-link';
                        adminLinks.push(
                            $(`<a href="#" class="table-link${extraClass}"></a>`)
                                .html(icon + label)
                                .data('table', name)
                                .data('label', label)
                        );
                    } else {
                        otherLinks.push(
                            $(`<a href="#" class="table-link"></a>`)
                                .html(icon + label)
                                .data('table', name)
                                .data('label', label)
                        );
                    }
                });
                adminLinks.forEach(a => div.append(a));
                if (adminLinks.length && otherLinks.length) {
                    div.append('<hr class="my-2">');
                }
                otherLinks.forEach(a => div.append(a));
            }).fail(() => { hideSpinner(); showToast('Menü yüklenemedi', 'danger'); });
        }

        // --- LABEL EKLEMEDE DROPDOWN ---
        function showLabelAddModal() {
            let html = `<div class="modal fade" id="labelAddModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
                <div class="modal-header"><h5 class="modal-title">Yeni Label Ekle</h5></div>
                <div class="modal-body">
                    <form id="label-add-form">
                        <div class="mb-3"><label>Tablo</label><select class="form-select" name="table" required></select></div>
                        <div class="mb-3"><label>Sütun</label><select class="form-select" name="column" required></select></div>
                        <div class="mb-3"><label>Label</label><input class="form-control" name="label" required></div>
                        <button class="btn btn-primary w-100" type="submit">Kaydet</button>
                    </form>
                </div>
            </div></div></div>`;
            $(document.body).append(html);
            let m = new bootstrap.Modal(document.getElementById('labelAddModal'));
            m.show();
            // Tablo doldur
            api('dropdown_tables').done(resp => {
                let sel = $('#labelAddModal select[name=table]').empty();
                (resp.tables || []).forEach(t => sel.append(`<option value="${t}">${t}</option>`));
                sel.trigger('change');
            });
            // Sütun doldur
            $('#labelAddModal select[name=table]').on('change', function () {
                let t = $(this).val();
                api('dropdown_columns', { table: t }).done(resp => {
                    let sel = $('#labelAddModal select[name=column]').empty();
                    (resp.columns || []).forEach(c => sel.append(`<option value="${c}">${c}</option>`));
                });
            });
            $('#label-add-form').on('submit', function (e) {
                e.preventDefault();
                showSpinner();
                api('save_label', {
                    table: this.table.value,
                    column: this.column.value,
                    label: this.label.value
                }, 'POST').done(() => {
                    hideSpinner();
                    showToast('Etiket kaydedildi');
                    m.hide();
                    $('#labelAddModal').remove();
                }).fail(() => { hideSpinner(); showToast('Sunucu hatası', 'danger'); });
            });
        }

        // --- GLOBAL DEĞİŞKENLER ---
        let currentTable = null;
        let currentPK = null;
        let lastTable = null;
        let tableHistory = [];

        // --- SOL MENÜ TIKLAMA ---
        $(document).on('click', '.table-link', function (e) {
            e.preventDefault();
            const table = $(this).data('table');
            const label = $(this).data('label') || table;
            if (currentTable) tableHistory.push(currentTable);
            lastTable = currentTable;
            currentTable = table;
            $('#page-title').text(label);
            $('#btn-new-record').show().off('click').on('click', () => showFormFor(table));
            loadList(table);
            $('#btn-back').show().off('click').on('click', function () {
                if ($('#form-area').is(':visible')) {
                    // Formdayken geri: önceki tabloya veya listeye dön
                    $('#form-area').hide();
                    $('#list-area').show();
                    $('#btn-back').hide();
                } else if (tableHistory.length > 0) {
                    // Tablo geçmişi varsa önceki tabloya dön
                    const prevTable = tableHistory.pop();
                    if (prevTable) {
                        // Menüdeki label'ı bul
                        const link = $(`.table-link`).filter(function () { return $(this).data('table') === prevTable; });
                        const label = link.data('label') || prevTable;
                        currentTable = prevTable;
                        $('#page-title').text(label);
                        loadList(prevTable);
                    }
                }
            });
        });

        // --- GERİ BUTONU ---
        $('#btn-back').hide();

        // --- LİSTELEME (ARAMA, PAGINATION, TARİH FİLTRE) ---
        function loadList(table, page = 1, search = '', dateFrom = '', dateTo = '') {
            showSpinner();
            api('list_records', { table, page, search, date_from: dateFrom, date_to: dateTo }).done(resp => {
                hideSpinner();
                $('#form-area').hide().empty();
                $('#list-area').show().empty();
                // btn-back butonunu listede gizle
                $('#btn-back').hide();
                const cols = resp.cols;
                const rows = resp.rows;
                currentPK = resp.primary_key;
                let t = $('<table class="table table-sm table-striped"><thead></thead><tbody></tbody></table>');
                let thead = '<tr>';
                cols.forEach(c => {
                    thead += `<th>${escapeHtml(c.label)}`;
                    // Label düzenleme sadece yönetici
                    if (currentUser && currentUser.role === 'yonetici') {
                        if (!(table === 'cms_field_labels' && c.COLUMN_NAME === 'table_name')) {
                            thead += ` <a href="#" class="label-edit" data-col="${escapeHtml(c.COLUMN_NAME)}" data-label="${escapeHtml(c.label)}" style="font-size:0.8rem; margin-left:6px">✎</a>`;
                        }
                    }
                    thead += `</th>`;
                });
                thead += '<th style="width:160px">İşlemler</th></tr>';
                t.find('thead').html(thead);

                // Arama ve filtre
                let hasOtherDate = cols.some(c =>
                    ['date', 'datetime', 'timestamp'].includes((c.DATA_TYPE || '').toLowerCase()) && c.COLUMN_NAME !== 'created_at'
                );
                let filterHtml = `<form id="filter-form" class="row g-2 mb-2 align-items-end">
                    <div class="col-auto"><input class="form-control" name="search" placeholder="Ara" value="${escapeHtml(search)}"></div>`;
                if (hasOtherDate) {
                    filterHtml += `<div class="col-auto"><input class="form-control" name="date_from" type="date" value="${escapeHtml(dateFrom)}"></div>`;
                    filterHtml += `<div class="col-auto"><input class="form-control" name="date_to" type="date" value="${escapeHtml(dateTo)}"></div>`;
                }
                filterHtml += `<div class="col-auto"><button class="btn btn-outline-primary" type="submit">Filtrele</button></div>`;
                filterHtml += `<div class="col-auto"><button class="btn btn-outline-secondary" id="clear-filter" type="button">Temizle</button></div>`;
                filterHtml += `</form>`;
                $('#list-area').append(filterHtml);
                $('#filter-form').on('submit', function (e) {
                    e.preventDefault();
                    loadList(table, 1, this.search.value, this.date_from ? this.date_from.value : '', this.date_to ? this.date_to.value : '');
                });
                $('#clear-filter').on('click', function () {
                    loadList(table, 1, '', '', '');
                });

                let btnsHtml = `<div class="mb-2 d-flex gap-2"><button class="btn btn-sm btn-secondary" id="refresh-list">Yenile</button>`;
                if (table === 'cms_field_labels' && currentUser && currentUser.role === 'yonetici') {
                    btnsHtml += `<button class="btn btn-sm btn-outline-info" id="btn-label-add">Yeni Label</button>`;
                }
                btnsHtml += `</div>`;
                $('#list-area').append(btnsHtml);
                $('#refresh-list').on('click', () => loadList(table, page, search, dateFrom, dateTo));
                if (table === 'cms_field_labels') {
                    $('#btn-label-add').on('click', showLabelAddModal);
                }

                rows.forEach(r => {
                    let tr = $('<tr></tr>');
                    cols.forEach(c => {
                        let v = r[c.COLUMN_NAME];
                        // users tablosunda role için Türkçe gösterim
                        if (currentTable === 'users' && c.COLUMN_NAME === 'role') {
                            const roleLabels = {
                                'admin': 'Yönetici',
                                'editor': 'Editör',
                                'standart': 'Standart Kullanıcı',
                                'yonetici': 'Yönetici'
                            };
                            tr.append(`<td>${roleLabels[v] || escapeHtml(String(v ?? ''))}</td>`);
                        } else if (currentTable === 'users' && c.COLUMN_NAME === 'password') {
                            tr.append('<td>*****</td>');
                        } else if (c.is_file && v) {
                            let decoded = decodeURIComponent(String(v));
                            let lower = decoded.toLowerCase();
                            if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
                                tr.append(`<td><a href="${decoded}" target="_blank"><img src="${decoded}" class="img-thumb" /></a></td>`);
                            } else {
                                tr.append(`<td><a href="${decoded}" target="_blank">Dosya</a></td>`);
                            }
                        } else {
                            tr.append(`<td>${escapeHtml(String(v ?? ''))}</td>`);
                        }
                    });
                    let pkVal = r[currentPK] ?? r[Object.keys(r)[0]];
                    let ops = $(`<td>
                <button class="btn btn-sm btn-primary btn-edit me-1">Düzenle</button>
                <button class="btn btn-sm btn-danger btn-delete">Sil</button>
            </td>`);
                    ops.find('.btn-edit').on('click', () => showFormFor(table, r));
                    ops.find('.btn-delete').on('click', () => {
                        if (!confirm('Silinsin mi?')) return;
                        showSpinner();
                        api('delete_record', { table, pk: pkVal }, 'POST').done(resp => {
                            hideSpinner();
                            showToast('Silindi');
                            loadList(table, page, search, dateFrom, dateTo);
                        }).fail(err => { hideSpinner(); showToast('Silme hatası', 'danger'); });
                    });
                    tr.append(ops);
                    t.find('tbody').append(tr);
                });

                $('#list-area').append(t);

                // Pagination
                let total = resp.total || 0;
                let per = resp.per || 50;
                let cur = resp.page || 1;
                let pageCount = Math.ceil(total / per);
                if (pageCount > 1) {
                    let pag = $('<nav><ul class="pagination pagination-sm"></ul></nav>');
                    for (let i = 1; i <= pageCount; i++) {
                        let li = $(`<li class="page-item${i == cur ? ' active' : ''}"><a class="page-link" href="#">${i}</a></li>`);
                        li.on('click', function (e) { e.preventDefault(); loadList(table, i, search, dateFrom, dateTo); });
                        pag.find('ul').append(li);
                    }
                    $('#list-area').append(pag);
                }

                // label edit buttons in list header
                $('#list-area').off('click', '.label-edit').on('click', '.label-edit', function (e) {
                    e.preventDefault();
                    const col = $(this).data('col');
                    const label = $(this).data('label') || col;
                    showLabelModal(table, col, label, () => loadList(table, page, search, dateFrom, dateTo));
                });
            }).fail(() => { hideSpinner(); showToast('Liste yüklenemedi', 'danger'); });
        }

        // --- FORM ---
        function getInputForColumn(col, value = '') {
            let name = col.COLUMN_NAME;
            let labelHtml = `<div class="d-flex justify-content-between align-items-center">
                                                    <label class="form-label mb-1">${col.label || name}</label>`;
            // Label düzenleme sadece admin
            if (currentUser && currentUser.role === 'yonetici') {
                if (!(currentTable === 'cms_field_labels' && name === 'table_name')) {
                    labelHtml += `<a href="#" class="label-edit" data-col="${name}" data-label="${col.label || name}">Düzenle</a>`;
                }
            }
            labelHtml += `</div>`;
            let required = col.IS_NULLABLE === 'NO' ? 'required' : '';
            if (currentTable === 'users' && name === 'password') {
                // Şifre inputu her zaman boş gelsin
                return `<div class="mb-3">${labelHtml}<input class="form-control" type="password" name="${name}" autocomplete="new-password" placeholder="Yeni şifre (değiştirmek için yazın)"></div>`;
            }
            // --- cms_routes özel davranış ---
            if (currentTable === 'cms_routes' && name === 'route_name') {
                // Eğer düzenleme ise (value dolu), readonly input göster
                if (value) {
                    return `<div class="mb-3">${labelHtml}<input class="form-control" name="${name}" value="${escapeHtml(value)}" readonly disabled></div>`;
                } else {
                    // Yeni kayıt: dropdown (tablo listesi)
                    // Dropdown'u yüklemek için bir placeholder ve JS ile doldurulacak bir select ekle
                    setTimeout(() => {
                        api('dropdown_tables').done(resp => {
                            let sel = document.querySelector('#form-area select[name="route_name"]');
                            if (sel) {
                                sel.innerHTML = (resp.tables || []).map(t => `<option value="${t}">${t}</option>`).join('');
                            }
                        });
                    }, 0);
                    return `<div class="mb-3">${labelHtml}<select class="form-select" name="${name}" ${required}></select></div>`;
                }
            }

            // Tek dosya veya resim alanı ise file inputu oluştur
            if (
                col.is_file ||
                /image|file/i.test(name) // Kolon adında image veya file geçiyorsa
            ) {
                let html = `<div class="mb-3"><label class="form-label">${col.label || name}</label>`;
                let isImage = /image/i.test(name);
                let hasValue = value && value !== '';
                if (hasValue) {
                    if (isImage) {
                        html += `<div class='mb-2' id='preview_wrap_${name}'><img id='preview_${name}' src='${value}' alt='Görsel' style='max-width:120px;max-height:120px;border:1px solid #ccc;border-radius:6px;display:block;'/></div>`;
                    } else {
                        html += `<div class='mb-2'><a href='${value}' target='_blank'>Yüklü dosya</a></div>`;
                    }
                    html += `<button type='button' class='btn btn-outline-danger btn-sm mb-2' id='btn-remove-${name}'>Mevcut resmi/dosyayı sil</button>`;
                }
                if (isImage) {
                    html += `<input class="form-control" type="file" name="${name}" id="input_${name}" accept="image/*"></div>`;
                } else {
                    html += `<input class="form-control" type="file" name="${name}" id="input_${name}"></div>`;
                }
                // Önizleme scripti ve silme butonu sadece image/file için ekle
                setTimeout(() => {
                    const input = document.querySelector(`#form-area #input_${name}`);
                    let preview = document.querySelector(`#form-area #preview_${name}`);
                    const previewWrap = document.querySelector(`#form-area #preview_wrap_${name}`);
                    const btnRemove = document.querySelector(`#form-area #btn-remove-${name}`);
                    // Önizleme
                    if (isImage && input) {
                        input.addEventListener('change', function () {
                            let file = this.files && this.files[0];
                            if (file && !file.type.startsWith('image/')) {
                                showToast('Sadece resim dosyası yükleyebilirsiniz', 'danger');
                                this.value = '';
                                return;
                            }
                            let preview = document.querySelector(`#form-area #preview_${name}`);
                            let wrap = document.querySelector(`#form-area #preview_wrap_${name}`);
                            if (file) {
                                if (!wrap) {
                                    wrap = document.createElement('div');
                                    wrap.className = 'mb-2';
                                    wrap.id = `preview_wrap_${name}`;
                                    input.parentNode.insertBefore(wrap, input);
                                }
                                if (!preview) {
                                    preview = document.createElement('img');
                                    preview.id = `preview_${name}`;
                                    preview.style.maxWidth = '120px';
                                    preview.style.maxHeight = '120px';
                                    preview.style.border = '1px solid #ccc';
                                    preview.style.borderRadius = '6px';
                                    preview.style.display = 'block';
                                    wrap.innerHTML = '';
                                    wrap.appendChild(preview);
                                }
                                const reader = new FileReader();
                                reader.onload = function (e) {
                                    preview.src = e.target.result;
                                    preview.style.opacity = 1;
                                };
                                reader.readAsDataURL(file);
                            } else {
                                // Dosya seçimi kaldırıldıysa önizlemeyi kaldır
                                if (preview && preview.parentNode) preview.parentNode.removeChild(preview);
                                if (wrap && wrap.childNodes.length === 0) wrap.remove();
                            }
                        });
                    }
                    // Anlık silme butonu
                    if (btnRemove) {
                        btnRemove.addEventListener('click', function () {
                            // Bootstrap modal ile modern onay
                            let modalId = 'deleteConfirmModal_' + name;
                            if (!document.getElementById(modalId)) {
                                let modalHtml = `<div class="modal fade" id="${modalId}" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content">
                                    <div class="modal-header"><h5 class="modal-title">Dosya Sil</h5></div>
                                    <div class="modal-body">Mevcut dosya silinsin mi?</div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button>
                                        <button type="button" class="btn btn-danger" id="${modalId}_ok">Sil</button>
                                    </div>
                                </div></div></div>`;
                                $(document.body).append(modalHtml);
                            }
                            let m = new bootstrap.Modal(document.getElementById(modalId));
                            m.show();
                            // Sil butonuna tıklanınca işlemi başlat
                            $(document).off('click', `#${modalId}_ok`).on('click', `#${modalId}_ok`, function () {
                                btnRemove.disabled = true;
                                btnRemove.textContent = 'Siliniyor...';
                                const pk = document.querySelector('#dynamic-form input[name=pk]')?.value;
                                const table = document.querySelector('#dynamic-form input[name=table]')?.value;
                                if (!pk || !table) { showToast('Kayıt bilgisi bulunamadı', 'danger'); m.hide(); return; }
                                $.ajax({
                                    url: 'api.php?action=remove_file',
                                    method: 'POST',
                                    data: { table, pk, column: name },
                                    success: function (resp) {
                                        if (resp && resp.ok) {
                                            if (preview && preview.parentNode) preview.parentNode.removeChild(preview);
                                            if (btnRemove) btnRemove.remove();
                                            const fileInput = document.querySelector(`#form-area #input_${name}`);
                                            if (fileInput) fileInput.value = '';
                                            showToast('Dosya silindi');
                                        } else {
                                            showToast(resp.error || 'Silme hatası', 'danger');
                                            btnRemove.disabled = false;
                                            btnRemove.textContent = 'Mevcut resmi/dosyayı sil';
                                        }
                                        m.hide();
                                    },
                                    error: function () {
                                        showToast('Sunucu hatası', 'danger');
                                        btnRemove.disabled = false;
                                        btnRemove.textContent = 'Mevcut resmi/dosyayı sil';
                                        m.hide();
                                    }
                                });
                            });
                        });
                    }
                }, 100);
                return html;
                return html;
            }

            let type = col.DATA_TYPE;
            if (["int", "bigint", "smallint", "mediumint", "decimal", "float", "double"].includes(type)) {
                return `<div class="mb-3">${labelHtml}<input class="form-control" type="number" name="${name}" ${required} value="${escapeHtml(value)}"></div>`;
            } else if (type === 'tinyint' && col.COLUMN_TYPE.indexOf('tinyint(1)') > -1) {
                let checked = (value == 1) ? 'checked' : '';
                return `<div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="${name}" ${checked}><label class="form-check-label">${col.label}</label></div>`;
            } else if (["text", "mediumtext", "longtext"].includes(type)) {
                return `<div class="mb-3">${labelHtml}<textarea class="form-control" name="${name}">${escapeHtml(value)}</textarea></div>`;
            } else if (["date", "datetime", "timestamp"].includes(type)) {
                return `<div class="mb-3">${labelHtml}<input class="form-control" type="date" name="${name}" value="${escapeHtml(value)}"></div>`;
            } else if (col.COLUMN_TYPE && col.COLUMN_TYPE.startsWith('enum(')) {
                let opts = col.COLUMN_TYPE.match(/^enum\((.*)\)$/i)[1].split(',').map(s => s.replace(/(^'|'$)/g, ''));
                let html = `<div class="mb-3">${labelHtml}<select class="form-select" name="${name}">`;
                opts.forEach(o => html += `<option value="${o}" ${o == value ? 'selected' : ''}>${o}</option>`);
                html += `</select></div>`;
                return html;
            } else {
                return `<div class="mb-3">${labelHtml}<input class="form-control" type="text" name="${name}" value="${escapeHtml(value)}"></div>`;
            }
        }

        function showFormFor(table, existingRow = null) {
            // Form açılırken tabloyu history'ye ekle
            if (currentTable) tableHistory.push(currentTable);
            // Kayıt/güncelleme ekranında geri butonunu göster
            $('#btn-back').show();
            showSpinner();
            api('get_columns', { table }).done(resp => {
                hideSpinner();
                const cols = resp.columns;
                currentPK = resp.primary_key;
                let html = `<form id="dynamic-form" enctype="multipart/form-data"><div class="card p-3">`;
                cols.forEach(c => {
                    // id (primary key ve auto_increment) hiçbir zaman düzenlenebilir olmasın
                    if (c.COLUMN_NAME === currentPK && c.EXTRA && c.EXTRA.indexOf('auto_increment') > -1) {
                        // Sadece gizli input olarak ekle (hem yeni hem düzenlemede)
                        let val = existingRow ? (existingRow[c.COLUMN_NAME] ?? '') : '';
                        if (val !== '') {
                            html += `<input type="hidden" name="${c.COLUMN_NAME}" value='${escapeHtml(val)}'>`;
                        }
                        return;
                    }
                    if (!existingRow && c.EXTRA && c.EXTRA.indexOf('auto_increment') > -1) return;
                    let val = existingRow ? (existingRow[c.COLUMN_NAME] ?? '') : '';
                    html += getInputForColumn(c, val);
                });
                if (existingRow) {
                    let pkVal = existingRow[currentPK] ?? existingRow[Object.keys(existingRow)[0]];
                    html += `<input type="hidden" name="pk" value='${escapeHtml(pkVal)}'>`;
                }
                html += `<input type="hidden" name="table" value="${escapeHtml(table)}">`;
                html += `<div class="d-flex gap-2"><button class="btn btn-primary" type="submit">Kaydet</button><button class="btn btn-secondary" id="cancel-form" type="button">İptal</button></div>`;
                html += `</div></form>`;
                $('#form-area').html(html).show();
                $('#list-area').hide();
                $('#btn-back').show();

                // label edit click
                $('#form-area').off('click', '.label-edit').on('click', '.label-edit', function (e) {
                    e.preventDefault();
                    const col = $(this).data('col');
                    const label = $(this).data('label') || col;
                    showLabelModal(table, col, label, () => showFormFor(table, existingRow));
                });

                $('#cancel-form').on('click', () => {
                    $('#form-area').hide();
                    $('#list-area').show();
                    $('#btn-back').hide();
                });

                $('#dynamic-form').on('submit', function (e) {
                    e.preventDefault();
                    const form = this;
                    const fd = new FormData(form);
                    $(form).find('input[type=checkbox]').each(function () {
                        if (!fd.has(this.name)) fd.append(this.name, this.checked ? 1 : 0);
                    });
                    html += `<button type='button' class='btn btn-outline-danger btn-sm mb-2' id='btn-remove-${name}'>Mevcut resmi/dosyayı sil</button>`;
                    showSpinner();
                    if (existingRow) {
                        api('update_record', fd, 'POST', { isFormData: true }).done(resp => {
                            hideSpinner();
                            showToast('Güncellendi');
                            loadList(table);
                            $('#form-area').hide();
                            $('#list-area').show();
                            $('#btn-back').hide();
                        }).fail(err => { hideSpinner(); showToast('Hata: ' + err.responseText, 'danger'); });
                    } else {
                        api('create_record', fd, 'POST', { isFormData: true }).done(resp => {
                            hideSpinner();
                            showToast('Eklendi');
                            loadList(table);
                            $('#form-area').hide();
                            $('#list-area').show();
                            $('#btn-back').hide();
                        }).fail(err => { hideSpinner(); showToast('Hata: ' + err.responseText, 'danger'); });
                    }
                });
            }).fail(() => { hideSpinner(); showToast('Form yüklenemedi', 'danger'); });
        }

        function escapeHtml(s) {
            if (typeof s !== 'string') s = String(s);
            return s.replace(/[&<>"'`=\/]/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' }[c];
            });
        }

        // initial placeholder
        $('#list-area').html('<div class="text-muted">Soldan bir tablo seçin.</div>');

        // Menü ilk yükleme
        loadTables();
        $('#refresh-tables').on('click', e => { e.preventDefault(); loadTables(); });
    });
});