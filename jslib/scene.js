/*
 * scene.js
 * 
 * this needs "script-player.js";
 */

(function() { "use strict"; })();

/*
 * ゲームシーン
 */
tm.define("GameScene", {
	superClass:	"tm.app.Scene",

	init: function() {
		this.superInit();
		// シーンに入ったときに実行する処理
		this.addEventListener("enter", function() {
			try {
				this.app.scriptMgr.enterGameScene(this);
			} catch (e) {
				if (e instanceof Error) {
					throw e;
				}
				this.app.replaceScene(ErrorScene(e));
			}
		});
		// 毎フレームの更新処理
		this.addEventListener("enterframe", function() {
			try {
				this.app.scriptMgr.update();
			} catch (e) {
				if (e instanceof Error) {
					throw e;
				}
				this.app.replaceScene(ErrorScene(e));
			}
		});
	}
});

/*
 * タイトル付きローディングシーン
 */
tm.define("LoadingWithTitleScene", {
	superClass: tm.app.Scene,

	init: function(param) {
		this.superInit();
		var self = this;
		
		// タイトルラベル
		var titleLabel = tm.app.Label(param.scriptMgr.title)
		titleLabel
			.setFontSize(32)
			.setFontFamily(sp.FONT_FAMILY_FLAT)
			.setAlign("left")
			.setBaseline("top");
		titleLabel.x = 10;
		titleLabel.y = 5;
		titleLabel.alpha = 1;
		this.addChild(titleLabel);

		// ひよこさん
		var piyo = tm.app.Shape(84, 84);
		piyo.setPosition(-40, 100);
		piyo.canvas.setColorStyle("white", "yellow").fillCircle(42, 42, 32);
		piyo.canvas.setColorStyle("white", "black").fillCircle(27, 27, 2);
		piyo.canvas.setColorStyle("white", "brown").fillRect(40, 70, 4, 15).fillTriangle(0, 40, 11, 35, 11, 45);
		piyo.update = function(app) {
		    piyo.x += 4;
		    if (piyo.x > param.width + 80) piyo.x = -40;
		    piyo.rotation += 7;
		};
		this.addChild(piyo);

		// 名前空間spにロードエラー処理用の関数を定義する。
		// tmlibを書き換えて、ロードエラー時にこの関数が呼ばれるようにしている。
	    sp.defineFunction("onLoadError", function(path) {
	    	var lineNo_ = param.scriptMgr.assetPathToLineNo[path];
	    	var lineText_ = param.scriptMgr.scriptSrc[lineNo_];
	    	var info = {lineNo: lineNo_ + 1, lineText: lineText_, desc: "指定されたリソースがありません。リソース名を確認してください。"};
			self.app.replaceScene(ErrorScene(info));
	    });

	    if (param.scriptMgr.assets) {
            var loader = tm.asset.Loader();
            
            loader.onload = function() {
                piyo.tweener.clear().fadeOut(300).call(function() {
                    this.app.replaceScene(param.nextScene());
                    var e = tm.event.Event("load");
                    this.fire(e);
                }.bind(this));
            }.bind(this);
            
            loader.onprogress = function(e) {
                var event = tm.event.Event("progress");
                event.progress = e.progress;
                this.fire(event);
            }.bind(this);
            
            loader.load(param.scriptMgr.assets);
	    }
	}
});

/*
 * エラー表示シーン
 */
tm.define("ErrorScene", {
	superClass:	"tm.app.Scene",

	init: function(err_info) {
		this.superInit();
		var x_pos = 50;
		var line_height = 50;

		this.fromJSON({
			children: [
				{
					type: "Label", name: "lineNoLabel",
					text: "スクリプトの" + err_info.lineNo + "行目でエラーが発生しました。",
					x: x_pos,
					y: line_height,
					fillStyle: "#444",
					fontSize: 24,
					fontFamily:	sp.FONT_FAMILY_FLAT,
					align: "left",
					baseline: "top",
				},
				{
					type: "Label", name: "lineTextLabel",
					text: "" + err_info.lineNo + "行目のテキスト: " + err_info.lineText,
					x: x_pos,
					y: line_height * 2,
					fillStyle: "#444",
					fontSize: 24,
					fontFamily:	sp.FONT_FAMILY_FLAT,
					align: "left",
					baseline: "top",
				},
				{
					type: "Label", name: "discriptionLabel",
					text: "エラー内容: " + err_info.desc,
					x: x_pos,
					y: line_height * 3,
					fillStyle: "#444",
					fontSize: 24,
					fontFamily:	sp.FONT_FAMILY_FLAT,
					align: "left",
					baseline: "top",
				}
			]
		});
	}
});
