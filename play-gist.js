/*
 * play-gist.js
 *
 * this needs "scene.js";
 */

(function() { "use strict"; })();

/*
 * main
 */
tm.main(function() {
	// アプリケーションセットアップ
	var	app	= tm.app.CanvasApp("#world");		// 生成
	app.resize(sp.SCREEN_WIDTH, sp.SCREEN_HEIGHT);	// サイズ(解像度)設定
	app.fitWindow();							// 自動フィッティング有効
	app.background = sp.BACKGROUND_COLOR;		// 背景色

	// クエリ文字列からgistのidを取ってくる
	// テスト用: ?id=8083682
	var query = window.location.search.substring(1);
	var id = query.split('=')[1];

	// シナリオファイルをロード
	var is_loaded = false;
	var content = null;
	tm.util.Ajax.load({
		url: "https://api.github.com/gists/" + id,
		dataType: "json",
		success: function(d) {
			is_loaded = true;
			content = d;
		},
	});

	// シナリオファイルをロードし終わったらアセットが確定するのでそれを
	// LoadingWithTitleSceneに渡して開始
	var timer_interval = 100;
	var script_src_load_callback = function() {
		if (is_loaded) {
			// ロードし終わった
			app.scriptMgr = ScriptMgr();
			try {
				// contentのfilesから最初の要素を取り出してロードする
				var filenames = Object.keys(content.files);
				app.scriptMgr.loadScriptSrc(content.files[filenames[0]].content);
			} catch (e) {
				if (e instanceof Error) {
					throw e;
				}
				app.replaceScene(ErrorScene(e));
				return;
			}
			
			// 読み込み
			var loadingScene = LoadingWithTitleScene({
			    scriptMgr: app.scriptMgr,
			    nextScene: GameScene,
			    width: sp.SCREEN_WIDTH,
			    height: sp.SCREEN_HEIGHT
			});
			app.replaceScene(loadingScene);	// シーン切り替え
		} else {
			// まだロードしてない、もう一度待つ
			setTimeout(script_src_load_callback, timer_interval);
		}
	};
	setTimeout(script_src_load_callback, timer_interval);

	// 実行
	app.run();
});
