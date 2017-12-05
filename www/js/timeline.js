function reset_alert() {
    hide('clear-alert');
    fetch("https://"+inst+"/api/v1/notifications/clear", {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+localStorage.getItem('knzk_account_token')},
        method: 'POST'
    }).then(function(response) {
        if(response.ok) {
            return response.json();
        } else {
            throw new Error();
        }
    }).then(function(json) {
        showtoast('ok-clear-alert');
        showAlert();
        alert_old_id = 0;
        alert_new_id = 0;
    }).catch(function(error) {
        showtoast('cannot-pros');
        console.log(error);
    });
}

function showAlert(reload, more_load) {
    var get = "", reshtml = "", i = 0, alert_text = "", e = 0;
    if (reload) {
        get = "?since_id="+alert_new_id;
    }
    if (more_load) {
        more_load.value = "読み込み中...";
        more_load.disabled = true;
        get = "?max_id="+alert_old_id;
    }
    fetch("https://"+inst+"/api/v1/notifications"+get, {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+localStorage.getItem('knzk_account_token')},
        method: 'GET'
    }).then(function(response) {
        if(response.ok) {
            return response.json();
        } else {
            showtoast('cannot-load');
            if (reload) reload();
            return false;
        }
    }).then(function(json) {
        if (json[i]) {
            displayTime('update');
            if (more_load) {
                more_load.className = "button button--large--quiet invisible";
                reshtml = document.getElementById("alert_main").innerHTML;
            }
            while (json[i]) {
                alert_new_id = json[0]['id'];
                if (!json[i]['account']['display_name']) json[i]['account']['display_name'] = json[i]['account']['username'];

                if (json[i]['type'] === "follow") {
                    alert_text = "<p class='alert_text'>";
                    alert_text += "<ons-icon icon=\"fa-user-plus\" class='boost-active'></ons-icon> <b onclick='show_account(" + json[i]['account']['id'] + ")'>" + json[i]['account']['display_name'] + "</b>さんにフォローされました";
                    alert_text += "</p>";
                    reshtml += "<div class=\"toot\">\n" +
                        alert_text +
                        "                    <div class=\"row\">\n" +
                        "                        <div class=\"col-xs-2\">\n" +
                        "                            <p><img src=\"" + json[i]['account']['avatar'] + "\" class=\"icon-img\" onclick='show_account(" + json[i]['account']['id'] + ")'/></p>\n" +
                        "                        </div>\n" +
                        "                        <div class=\"col-xs-9 toot-card-right\">\n" +
                        "                            <div class=\"toot-group\">\n" +
                        "                                <span onclick='show_account(" + json[i]['account']['id'] + ")'><b>" + json[i]['account']['display_name'] + "</b> <small>@" + json[i]['account']['acct'] + "</small></span>\n" +
                        "                            </div>\n" +
                        "                        </div>\n" +
                        "                    </div>\n" +
                        "            </div>";
                } else {
                    if (json[i]["type"] === "favourite") {
                        alert_text = "<ons-icon icon=\"fa-star\" class='fav-active'></ons-icon> <b onclick='show_account(" + json[i]['account']['id'] + ")'>" + json[i]['account']['display_name'] + "</b>さんがお気に入りに登録しました";
                    }
                    if (json[i]["type"] === "reblog") {
                        alert_text = "<ons-icon icon=\"fa-retweet\" class='boost-active'></ons-icon> <b onclick='show_account(" + json[i]['account']['id'] + ")'>" + json[i]['account']['display_name'] + "</b>さんがブーストしました";
                    }

                    reshtml += toot_card(json[i]['status'], "full", alert_text);
                }
                alert_text = "";
                i++;
            }
            if (reload) { //追加読み込み
                reshtml += document.getElementById("alert_main").innerHTML;
            }
            if (more_load || !reload) { //TL初回
                if (i !== 0) alert_old_id = json[i-1]['id'];
                reshtml += "<button class='button button--large--quiet' onclick='showAlert(null,this)'>もっと読み込む...</button>";
            }
            document.getElementById("alert_main").innerHTML = reshtml;
        }
        if (reload) reload();
        return true;
    });
}

function openTL(mode) {
    if (mode === "alert") {
        load("alert.html");
        showAlert();
        setTimeout(function () {
            initph("alert");
        }, 200);
    } else if (mode === "alert_nav") {
        loadNav("alert.html");
        showAlert();
        setTimeout(function () {
            document.getElementById("alert_button").innerHTML = "<ons-toolbar-button onclick=\"BackTab()\" class=\"toolbar-button\">\n" +
                "                    <ons-icon icon=\"fa-chevron-left\" class=\"ons-icon fa-chevron-left fa\"></ons-icon>\n" +
                "                    戻る\n" +
                "                </ons-toolbar-button>";
            initph("alert");
            if (localStorage.getItem('knzk_alert-back') == '1') {
                $("#alert-speed_dial").removeClass("invisible");
            }
        }, 200);
    } else {
        try {old_TL_ws.close();} catch(e) {console.log("ws_close_error");}
        load("home.html");
        showTL(null, null, null, true);
        setTimeout(function () {
            if (localStorage.getItem('knzk_swipe') == 1) document.getElementById("carousel").setAttribute('swipeable', '1');
            var dial = localStorage.getItem('knzk_dial'), icon;
            if (dial && dial != "change") {
                $("#dial_main").removeClass("invisible");
                if (dial === "toot") icon = "fa-pencil"; else if (dial === "alert") icon = "fa-bell"; if (dial === "reload") icon = "fa-refresh";
                document.getElementById("dial-icon").className = "ons-icon fa "+icon;
            } else if (dial) {
                $("#dial_TL").removeClass("invisible");
            }
        }, 200);
    }
}

/**
 * 自分でもわけわからなくなってるのでいつか書き直す
 * @param mode タイムラインの種類 home=ホーム, local=ローカルTL, public=連合TL
 * @param reload 引っ張って更新を終了させる変数を入れる
 * @param more_load もっと読み込むのボタンオブジェクト (thisでぶち込む)
 * @param clear_load 一旦破棄してやり直すときtrue
 */
function showTL(mode, reload, more_load, clear_load) {
    var tlmode = "", i = 0, reshtml = "", ws, ws_mode, id_main, n;
    if (!mode) mode = now_TL;
    if (clear_load) {
        home_auto_tmp = "";
        home_auto_num = 0;
        toot_new_id = 0;
        toot_old_id = 0;
        more_load = false;
        setTLheadcolor(0);
        try {
            if (last_load_TL) document.getElementById(last_load_TL+"_main").innerHTML = "";
        } catch (e) {
            console.error(e);
        }
    }
    if (more_load) {
        more_load.value = "読み込み中...";
        more_load.disabled = true;
    }
    if (mode === "home") {
        id_main = "home_main";
        if (more_load)
            tlmode = "home?max_id="+toot_old_id;
        else
            tlmode = "home?since_id="+toot_new_id;
        n = true;
    } else if (mode === "public") {
        id_main = "public_main";
        if (more_load)
            tlmode = "public?max_id="+toot_old_id;
        else
            tlmode = "public?since_id="+toot_new_id;
        n = true;
    } else if (mode === "local") {
        id_main = "local_main";
        if (more_load)
            tlmode = "public?local=true&max_id="+toot_old_id;
        else
            tlmode = "public?local=true&since_id="+toot_new_id;
        n = true;
    } else if (mode === "local_media") {
        id_main = "local_media_main";
        if (more_load)
            tlmode = "public?local=true&max_id="+toot_old_id;
        else
            tlmode = "public?limit=40&local=true&since_id="+toot_new_id;
        n = true;
    } else if (mode === "public_media") {
        id_main = "public_media_main";
        if (more_load)
            tlmode = "public?max_id="+toot_old_id;
        else
            tlmode = "public?limit=40&since_id="+toot_new_id;
        n = true;
    }
    if (n) {
        fetch("https://"+inst+"/api/v1/timelines/"+tlmode, {
            headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+localStorage.getItem('knzk_account_token')},
            method: 'GET'
        }).then(function(response) {
            if(response.ok) {
                return response.json();
            } else {
                showtoast('cannot-load');
                if (reload && reload !== "dial") reload();
                return false;
            }
        }).then(function(json) {
            if (!more_load && mode == last_load_TL && !clear_load) {
                displayTime('update');
            }
            if (more_load) {
                more_load.className = "button button--large--quiet invisible";
                reshtml = document.getElementById(id_main).innerHTML;
            } else {
                if (localStorage.getItem('knzk_realtime') == 1) {
                    if (now_TL === "public" || now_TL === "public_media")
                        ws_mode = "public";
                    else if (now_TL === "local" || now_TL === "local_media")
                        ws_mode = "public:local";
                    else
                        ws_mode = "user";

                    if (!reload && !more_load) {
                        if (old_TL_ws) old_TL_ws.close();

                        ws = new WebSocket("wss://"+inst+"/api/v1/streaming/?access_token=" + localStorage.getItem('knzk_account_token') + "&stream=" + ws_mode);
                        old_TL_ws = ws;
                        ws.onmessage = function (message) {
                            var ws_reshtml;
                            displayTime('update');
                            ws_reshtml = JSON.parse(JSON.parse(message.data).payload);

                            if (ws_reshtml['id']) {
                                if (toot_new_id !== ws_reshtml['id']) {
                                    var TLmode;
                                    if (now_TL === "local_media" || now_TL === "public_media") TLmode = "media"; else TLmode = "";
                                    home_auto_tmp = toot_card(ws_reshtml, "full", null, TLmode) + home_auto_tmp;
                                    if (!home_auto_mode && (ws_reshtml['media_attachments'][0] && TLmode === "media")) {
                                        home_auto_num++;
                                        setTLheadcolor(1);
                                    }
                                }
                                toot_new_id = ws_reshtml['id'];
                            } else {
                                var deltoot = document.getElementById("post_"+JSON.parse(message.data).payload);
                                if (deltoot) {
                                    deltoot.innerHTML = "<p class=\"alert_text\"><ons-icon icon=\"fa-trash\" class=\"ons-icon fa-trash fa\"></ons-icon>　削除されたトゥート</p>" + deltoot.innerHTML;
                                    deltoot.className = "toot toot_red";
                                }
                            }
                        };
                    }
                }
            }

            while (json[i]) {
                var TLmode;
                if (mode === "local_media" || mode === "public_media") TLmode = "media"; else TLmode = "";
                toot_new_id = json[0]['id'];
                reshtml += toot_card(json[i], "full", null, TLmode);
                i++;
            }

            if (!more_load && mode == last_load_TL && !clear_load) { //追加読み込みでない&前回と同じTL
                reshtml += document.getElementById(id_main).innerHTML;
            }
            if (more_load || mode != last_load_TL || clear_load) { //TL初回
                initph("TL");
                if (i !== 0) toot_old_id = json[i-1]['id'];
                var mediaTL_noti; if (TLmode === "media") mediaTL_noti = "(何回か押してね)"; else mediaTL_noti = "";
                reshtml += "<button class='button button--large--quiet more_load_bt_"+now_TL+"' onclick='showTL(null,null,this)'>もっと読み込む... "+mediaTL_noti+"</button>";
            }
            last_load_TL = mode;
            document.getElementById(id_main).innerHTML = reshtml;
            if (reload && reload !== "dial") reload();
            return true;
        });
    }
}

function showTagTL(tag, more_load) {
    var i = 0, reshtml = "", get = "";
    if (!tag) tag = tag_str;
    if (more_load) {
        get = "?max_id="+tag_old_id;
        more_load.value = "読み込み中...";
        more_load.disabled = true;
    } else {
        loadNav('showtag.html');
    }
    fetch("https://"+inst+"/api/v1/timelines/tag/"+tag+get, {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+localStorage.getItem('knzk_account_token')},
        method: 'GET'
    }).then(function(response) {
        if(response.ok) {
            return response.json();
        } else {
            showtoast('cannot-load');
            return false;
        }
    }).then(function(json) {
        if (more_load) {
            more_load.className = "button button--large--quiet invisible";
            reshtml = document.getElementById("tag_main").innerHTML;
        } else {
            document.getElementById("showtag_title").innerHTML = '#'+ decodeURI(tag);
        }

        while (json[i]) {
            reshtml += toot_card(json[i], "full", null);
            i++;
        }

        if (i !== 0) tag_old_id = json[i-1]['id'];
        reshtml += "<button class='button button--large--quiet' onclick='showTagTL(null,this)'>もっと読み込む...</button>";
        document.getElementById("tag_main").innerHTML = reshtml;
        return true;
    });
}

function showAccountTL(id, more_load, media) {
    var i = 0, ip = 0, reshtml = "", get = "", reshtml_pinned = "";
    if (more_load) {
        more_load.value = "読み込み中...";
        more_load.disabled = true;
        if (media)
            get = "?max_id="+account_toot_old_id+"&only_media=true";
        else
            get = "?max_id="+account_toot_old_id;
    } else {
        account_toot_old_id = 0;
        if (media)
            get = "?only_media=true";
    }
    if (media && !more_load) { //読み込みマーク入れる & ピンを表示しない
        document.getElementById("account_toot").innerHTML = "<div class=\"loading-now\"><ons-progress-circular indeterminate></ons-progress-circular></div>";
        document.getElementById("account_pinned_toot").innerHTML = "";
    }
    fetch("https://"+inst+"/api/v1/accounts/"+id+"/statuses"+get, {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+localStorage.getItem('knzk_account_token')},
        method: 'GET'
    }).then(function(response) {
        if(response.ok) {
            return response.json();
        } else {
            showtoast('cannot-load');
            return false;
        }
    }).then(function(json) {
        if (!media && !more_load) {
            fetch("https://"+inst+"/api/v1/accounts/"+id+"/statuses?pinned=true", {
                headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+localStorage.getItem('knzk_account_token')},
                method: 'GET'
            }).then(function(response) {
                if(response.ok) {
                    return response.json();
                } else {
                    showtoast('cannot-load');
                }
            }).then(function(json_pinned) {
                while (json_pinned[ip]) {
                    reshtml_pinned += toot_card(json_pinned[ip], "full", "<ons-icon icon='fa-thumb-tack'></ons-icon>　固定トゥート", "light");
                    ip++;
                }
                if (json != json_pinned) {
                    document.getElementById("account_pinned_toot").innerHTML = reshtml_pinned;
                }
            });
        }
        if (more_load) {
            more_load.className = "button button--large--quiet invisible";
            reshtml = document.getElementById("account_toot").innerHTML;
            displayTime('update');
        }
        i = 0;
        while (json[i]) {
            reshtml += toot_card(json[i], "full", null);
            i++;
        }
        if (i !== 0) account_toot_old_id = json[i-1]['id'];
        if (media)
            reshtml += "<button class='button button--large--quiet' onclick='showAccountTL(account_page_id, this, true)'>もっと読み込む...</button>";
        else
            reshtml += "<button class='button button--large--quiet' onclick='showAccountTL(account_page_id, this)'>もっと読み込む...</button>";

        document.getElementById("account_toot").innerHTML = reshtml;
        return true;
    });
}

var TL_prev = function() {
    var carousel = document.getElementById('carousel');
    carousel.prev();
    SpeedDial_icon_change(carousel.getActiveIndex());
};

var TL_next = function() {
    var carousel = document.getElementById('carousel');
    carousel.next();
    SpeedDial_icon_change(carousel.getActiveIndex());
};

function TL_change(mode) {
    SpeedDial_icon_change(mode);
    var carousel = document.getElementById('carousel');
    carousel.setActiveIndex(mode);
}

function SpeedDial_icon_change(mode) {
    var iconclass;
    if (mode !== 3) {
        var fa;
        if (mode === 0) fa = "fa-users"; else if (mode === 1) fa = "fa-home"; else if (mode === 2) fa = "fa-picture-o"; else if (mode === 4) fa = "fa-globe";
        iconclass = "ons-icon "+fa+" fa";
    } else {
        iconclass = "ons-icon zmdi zmdi-collection-image-o";
    }
    document.getElementById("speeddial_icon").className = iconclass;
}

function scrollTL() {
    $("#"+now_TL+"_item").scrollTop(0);
}