/*
 * play-form.js
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

	var content = QUERY_STRING.split('=')[1];

	// ロードし終わった
	app.scriptMgr = ScriptMgr();
	try {
		// contentのfilesから最初の要素を取り出してロードする
		var content_decoded = decodeURIComponent(content).replace(/\+/g, ' ');
		app.scriptMgr.loadScriptSrc(content_decoded);
	} catch (e) {
		if (e instanceof Error) {
			throw e;
		}
		app.replaceScene(ErrorScene(e));
		app.run();
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

	// 実行
	app.run();
});
