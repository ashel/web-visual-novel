/*
 * script-player.js
 *
 * this needs "tmlib.js"
 */

(function() { "use strict"; })();

/*
 * 名前空間spの中に定数を定義する
 */
tm.namespace("sp", function() {
    this.defineVariable("SCREEN_WIDTH", 1136);	// スクリーン幅
    this.defineVariable("SCREEN_HEIGHT", 640);	// スクリーン高さ
    this.defineVariable("SCREEN_CENTER_X", sp.SCREEN_WIDTH/2);	// スクリーン幅の半分
    this.defineVariable("SCREEN_CENTER_Y", sp.SCREEN_HEIGHT/2);	// スクリーン高さの半分
    this.defineVariable("DIALOG_X_MARGIN", 200);	// ダイアログの画面横端からのマージン
    this.defineVariable("FIGURE_NUM_MAX", 2);		// 出せるキャラの最大数
    this.defineVariable("FONT_FAMILY_FLAT", "'Helvetica-Light' 'Meiryo' sans-serif");	// フォント指定
    this.defineVariable("BACKGROUND_COLOR", "rgba(195, 195, 195, 1.0)");	// 背景色
});

/*
 * スクリプトによる駆動を行う
 */
tm.define("ScriptMgr", {
	superClass: tm.event.EventDispatcher,

	init: function() {
		this.superInit();
		this.script = null;
		this.scene = null;
		this.cmdPos = 0;
		this.assets = {};
		this.assetPathToLineNo = {};
		this.waitsAfter = {};
		this.waitsBefore = {};
		this.isExecWaitBefore = false;
		this.defaultArgs = {};
		this.longCmd = null;
		this.scriptSrc = [];
		this.cmdPosToLineNo = [];
		this.title = "";
		this.isAudioEnable = ( ! tm.isMobile && tm.BROWSER != "IE");
	},

	/*
	 * 配列形式のスクリプトを読み込む
	 * 
	 * このメソッドが受け取るのは、JavaScriptの配列の形になったもの
	 * テキスト形式のデータを読み込むにはloadScriptSrcを用いる
	 */
	loadScript: function(script_) {
		this.script = script_;
		this.title = "";
		this.assets = {};
		this.assetPathToLineNo = {};
		// デフォルトのアセットを追加
		this.assets["black"] = "data/back/black.jpg";
		this.assets["dummy_figure"] = "data/figure/dummy_figure.png";
		// スクリプト内のコマンドからアセットに関係するものを取り出す
		for (var i = 0; i < this.script.length; i++) {
			var cmd = this.script[i];
			var asset_name = null;
			var asset_path = null;
			if (cmd[0] === "data") {
				// モバイルでは音声を正しく扱えないため、サウンドファイルのロードは行わない
				if ( ! this.isAudioEnable && cmd[2].match(/\.(wav|mp3|ogg)$/)) {
					continue;
				}
				asset_name = cmd[1];
				asset_path = cmd[2];
			} else if (cmd[0] === "title") {
				this.title = cmd[1];
				document.title = this.title;
			} else if (cmd[0] === "set_bg" || cmd[0] === "modify_bg" || cmd[0] === "change_bg") {
				if (this.assets[cmd[1]] == null) {
					asset_name = cmd[1];
					asset_path = "data/back/" + cmd[1] + ".jpg";
				}
			} else if (cmd[0] === "set_chara" || cmd[0] === "modify_chara" || cmd[0] === "change_chara") {
				if (this.assets[cmd[2]] == null) {
					asset_name = cmd[2];
					asset_path = "data/figure/" + cmd[2] + ".png";
				}
			} else if (this.isAudioEnable && cmd[0] === "play_bgm") {
				if (this.assets[cmd[1]] == null) {
					asset_name = cmd[1];
					asset_path = "data/bgm/" + cmd[1] + ".mp3";
				}
			} else if (this.isAudioEnable && cmd[0] === "play_se") {
				if (this.assets[cmd[1]] == null) {
					asset_name = cmd[1];
					asset_path = "data/se/" + cmd[1] + ".mp3";
				}
			}
			if (asset_name != null) {
				this.assetPathToLineNo[asset_path] = this.cmdPosToLineNo[i];
				this.assets[asset_name] = asset_path;
			}
		}
	},

	/*
	 * テキスト形式のスクリプトを読み込む
	 * 
	 * パースして配列形式に変換してから、loadScriptメソッドに渡す
	 */
	loadScriptSrc: function(script_src) {
		// まず行ごとに区切る
		var lines = script_src.split("\n");
		var script_parsed = [];
		this.scriptSrc = [];
		this.cmdPosToLineNo = [];
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			// postで送られたデータは行の末尾に0x0dが残っているので、あれば削除する
			if (line.length > 0 && line.charCodeAt(line.length - 1) === 0xd) {
				line = line.substring(0, line.length - 1)
			}
			var line_fixed = null;
			if (line === "" || line[0] === "#") {
				// 空行、コメントは削除
			} else {
				// 空行、コメントでない場合
				var match_result = line.match(/^@(\w+)/)
				if (match_result) {
					// 通常のコマンド
					line_fixed = "[" + line.replace(/^@\w+/, "\"" + match_result[1] + "\"") + "]";
				} else {
					// コマンドでない場合はtextコマンドとして解釈する
					line_fixed = "[\"text\", \"" + line + "\"]"
				}
				if (script_parsed) {
					try {
						// エラー表示用にコマンド位置がどこの行に当たるかを覚えておく
						this.cmdPosToLineNo[script_parsed.length] = i;
						script_parsed.push(JSON.parse(line_fixed));
					} catch (e) {
						throw {lineNo: i + 1, lineText: line, desc: "コマンドに文法エラーがあります(カンマがないなど)"};
					}
				}
			}
			// エラー表示用にオリジナルのソースを保持しておく
			this.scriptSrc[i] = line;
		}

		// パース済みのスクリプトをロードする
		this.loadScript(script_parsed);
	},

	/*
	 * ゲームシーンが開始されたときに呼び出されるコールバック
	 * 
	 * 初期化処理を行った後、スクリプトの再生を開始する
	 */
	enterGameScene: function(scene_) {
		// 変数初期化
		this.scene = scene_;
		this.cmdPos = 0;
		this.waitCount = 0;
		this.bgmVolumeCount = 0;
		this.bgmVolumeCmd = null;
		this.bgmSound = null;
		this.waitsAfter = {};
		this.waitsBefore = {};
		this.isExecWaitBefore = false;
		this.defaultArgs = {};
		this.longCmd = null;
		this.scriptError = null;
		this.rootElement = tm.app.CanvasElement().addChildTo(this.scene);
	    // 最初のx,yを別のメンバ変数に記録しておく。これは、shakeするときに使われる。
	    this.rootElement.originalX = this.rootElement.x;
	    this.rootElement.originalY = this.rootElement.y;
	    this.rootElement.width = sp.SCREEN_WIDTH;
	    this.rootElement.height = sp.SCREEN_HEIGHT;

	    // コマンド終了コールバック
	    var callback = this.cmdEndCallback.bind(this);
	    // 背景画像オブジェクトを生成、
		this.backImage = BackImage(callback).addChildTo(this.rootElement);
		// キャラ画像オブジェクトを生成
		this.figureImages = [];
		for (var i = 0; i < sp.FIGURE_NUM_MAX; ++i) {
			this.figureImages[i] = FigureImage(callback).addChildTo(this.rootElement);
		}
		// ダイアログオブジェクトを生成
		this.dialog = Dialog(callback).addChildTo(this.rootElement);
		// 画面切り替えのための要素を設定
		this.setupTransitElements();

		// デフォルト引数、wait_before及びwait_afterのデフォルト設定
		this.setDefaultArg("new_page", 0, 3);
		this.setDefaultArg("new_page_name", 0, 3);
		this.setDefaultArg("name", 1, 3);
		this.setDefaultArg("modify_chara", 2, 6);
		this.setDefaultArg("change_chara", 2, 15);
		this.setDefaultArg("play_bgm", 1, 1);
		this.setDefaultArg("play_bgm", 2, 0);
		this.setDefaultArg("play_se", 1, 1);
		this.setWaitBefore("new_page", 20);
		this.setWaitBefore("new_page_name", 20);
		this.setWaitAfter("name", 5);
		this.setWaitAfter("modify_chara", 5);
		this.setWaitAfter("change_chara", 5);
		this.setWaitAfter("text", 20);
		this.setWaitAfter("new_page", 5);
		this.setWaitAfter("new_page_name", 5);

		// スクリプトを再生
		this.processScript();
	},

	/*
	 * 画面切り替えのための要素を設定する
	 * これらの要素は自動的に消えるため、メンバにはしない
	 */
	setupTransitElements: function() {
		// フェードインっぽく見せるための覆い
		var coverShape = tm.app.Shape(sp.SCREEN_WIDTH, sp.SCREEN_HEIGHT).addChildTo(this.rootElement);
		coverShape.x = sp.SCREEN_CENTER_X;
		coverShape.y = sp.SCREEN_CENTER_Y;
	    coverShape.canvas
	    	.setColorStyle(sp.BACKGROUND_COLOR, sp.BACKGROUND_COLOR)
		    .fillRect(0, 0, sp.SCREEN_WIDTH, sp.SCREEN_HEIGHT);
		coverShape.tweener
			.clear()
			.fadeOut(this.frameToMilliSec(5))
			.call(function() {
				this.remove();
			}.bind(coverShape));
		
		// タイトルラベル
	    var titleLabel = tm.app.Label(this.title).addChildTo(this.rootElement);
	    titleLabel
			.setFontSize(32)
			.setFontFamily(sp.FONT_FAMILY_FLAT)
			.setAlign("left")
			.setBaseline("top");
		titleLabel.x = 10;
		titleLabel.y = 5;
		// しばらくしてからフェードアウトする
		titleLabel.tweener
			.clear()
			.wait(this.frameToMilliSec(30*3))
			.fadeOut(this.frameToMilliSec(20))
			.call(function() {
				this.remove();
			}.bind(titleLabel));
	},
	

	/*
	 * スクリプトを処理する
	 * 
	 * スクリプト内のコマンドが同期処理(即時に実行される処理)の場合は、そのまま進める。
	 * 非同期処理(時間がかかる処理)の場合はいったんこのメソッドを出て、コマンド終了
	 * イベントの中からもう一度呼び出される。
	 */
	processScript: function() {
		while (this.cmdPos < this.script.length) {
			// wait_beforeが行われていなくて、コマンドに設定されていたら実行
			if ( ! this.isExecWaitBefore
				&& this.executeWaitBeforeAfter(this.script[this.cmdPos], this.waitsBefore))
			{
				this.isExecWaitBefore = true;
				break;
			} else {
				this.isExecWaitBefore = false;
			}
			// 現在位置のコマンドを実行する
			var is_async = this.executeCmd(this.script[this.cmdPos]);
			// 位置を進める
			this.cmdPos += 1;
			if (is_async) {
				// 非同期処理だったらループを抜ける
				break;
			} else if (this.executeWaitBeforeAfter(this.script[this.cmdPos - 1], this.waitsAfter)) {
				// wait_afterが有効なコマンドだったら非同期処理になるのでループを抜ける
				break;
			}
		}
	},

	/*
	 * appの設定を使って、フレーム数からミリ秒に変換するユーティリティメソッド。
	 */
	frameToMilliSec: function(frame) {
		return frame * (1000 / this.scene.app.fps);
	},

	/*
	 * 引数として受け取ったコマンドを実行する
	 * 
	 * コマンドは配列であり、１つ目の要素がコマンド名、それ以降が引数となっている。
	 * コマンドが非同期処理だった場合はtrueを、同期処理だった場合はfalseを返す。
	 */
	executeCmd: function(cmd) {
		// コマンド名と引数に分解する。このとき、デフォルト引数の処理も行う。
		var cmd_name = cmd[0];
		var args = [];
		var cmd_arg_num = this._CMD_ARG_NUMS[cmd_name];
		if ( ! cmd_arg_num) {
			// サポートされていないコマンド
			this._throwErrorWithCmdPos("コマンド[" + cmd_name + "]はサポートされていません");
		}
		for (var i = 0; i < cmd_arg_num; i++) {
			if (cmd[i + 1] != null) {
				args[i] = cmd[i + 1];
			} else if (this.defaultArgs[cmd_name] != null && this.defaultArgs[cmd_name][i] != null) {
				args[i] = this.defaultArgs[cmd_name][i];
			} else {
				// 引数未指定エラー
				this._throwErrorWithCmdPos("コマンドの引数が[" + i + "]個ですが、[" + cmd_arg_num + "]個必要です");
			}
		}
		// コマンドに応じた処理を行う。
		switch (cmd_name) {
		case "text":
			this.dialog.addText(args[0]);
			return true;
		case "set_name":
			this.dialog.setName(args[0]);
			return false;
		case "name":
			this.dialog.fadeInName(args[0], this.frameToMilliSec(args[1]));
			return true;
		case "wait":
			this.waitCount = 0;
			this.longCmd = cmd;
			return true;
		case "shake_all":
			this.waitCount = 0;
			this.longCmd = cmd;
			return true;
		case "shake_dialog":
			this.waitCount = 0;
			this.longCmd = cmd;
			return true;
		case "wait_before":
			this.setWaitBefore(args[0], args[1]);
			return false;
		case "wait_after":
			this.setWaitAfter(args[0], args[1]);
			return false;
		case "default_arg":
			this.setDefaultArg(args[0], args[1], args[2]);
			return false;
		case "new_page":
			this.dialog.newPage(this.frameToMilliSec(args[0]), false);
			return true;
		case "new_page_name":
			this.dialog.newPage(this.frameToMilliSec(args[0]), true);
			return true;
		case "in_chara":
			if (args[1] === 0) {
				this.figureImages[args[0]].setVisible(true);
				return false;
			} else {
				this.figureImages[args[0]].fadeIn(this.frameToMilliSec(args[1]));
				return true;
			}
		case "out_chara":
			if (args[1] === 0) {
				this.figureImages[args[0]].setVisible(false);
				return false;
			} else {
				this.figureImages[args[0]].fadeOut(this.frameToMilliSec(args[1]));
				return true;
			}
		case "set_chara":
			this.figureImages[args[0]].setImage(args[1]);
			return false;
		case "modify_chara":
			this.figureImages[args[0]].changeOverwrite(args[1], this.frameToMilliSec(args[2]));
			return true;
		case "change_chara":
			this.figureImages[args[0]].changeCross(args[1], this.frameToMilliSec(args[2]));
			return true;
		case "move_chara_x":
			if (args[2] === 0) {
				this.figureImages[args[0]].setX(args[1]);
				return false;
			} else {
				this.figureImages[args[0]].moveX(args[1], this.frameToMilliSec(args[2]));
				return true;
			}
		case "set_bg":
			this.backImage.setImage(args[0]);
			return false;
		case "modify_bg":
			this.backImage.changeOverwrite(args[0], this.frameToMilliSec(args[1]));
			return true;
		case "change_bg":
			this.backImage.changeCross(args[0], this.frameToMilliSec(args[1]));
			return true;
		case "play_bgm":
			if (this.isAudioEnable) {
				this.playBGM(args[0], args[1], args[2]);
			}
			return false;
		case "stop_bgm":
			if (this.isAudioEnable) {
				this.changeBGMVolume(0, args[0]);
			}
			return false;
		case "bgm_volume":
			if (this.isAudioEnable) {
				this.changeBGMVolume(args[0], args[1]);
			}
			return false;
		case "play_se":
			if (this.isAudioEnable) {
				this.playSE(args[0], args[1]);
			}
			return false;
		default:
			// 再生中は処理されないコマンド、例えばdata, titleなど
			return false;
		}
	},

	/*
	 * 指定したコマンドの前にwaitを入れる設定を行う
	 */
	setWaitBefore: function(cmd_name, frame) {
		if (cmd_name != "wait") {
			this.waitsBefore[cmd_name] = frame;
		}
	},

	/*
	 * 指定したコマンドの後にwaitを入れる設定を行う
	 */
	setWaitAfter: function(cmd_name, frame) {
		if (cmd_name != "wait") {
			this.waitsAfter[cmd_name] = frame;
		}
	},

	/*
	 * 指定したコマンドの前、もしくは後にwaitを入れる処理を実行する
	 * 
	 * コマンドにwait_before、もしくはwait_afterが設定されていなければ何もせずにfalseを返す。
	 * 設定されていれば、waitを設定してtrueを返す。
	 */
	executeWaitBeforeAfter: function(cmd, waits) {
		var cmd_name = cmd[0];
		if (this.waitsAfter[cmd_name]) {
			// コマンドにwait_before、もしくはwait_afterが設定されていたら
			var wait_frame = waits[cmd_name];
			if (wait_frame > 0) {
				// waitを設定
				this.waitCount = 0;
				this.longCmd = ["wait", wait_frame];
				return true;
			}
		}
		return false;
	},

	/*
	 * 指定したコマンドにデフォルト引数を設定する
	 */
	setDefaultArg: function(cmd_name, arg_no, value) {
		if (this.defaultArgs[cmd_name] == null) {
			this.defaultArgs[cmd_name] = [];
		}
		this.defaultArgs[cmd_name][arg_no] = value;
	},

	/*
	 * 指定したBGMを再生する
	 * 
	 * frameが0の場合は、フェードインせずに指定した音量で再生する。
	 * frameが0以外の場合は、ボリューム0から指定したフレーム数で指定したボリュームまでフェードインする。
	 */
	playBGM: function(sound_name, volume, frame) {
		this.bgmSound = tm.asset.AssetManager.get(sound_name);
		this.bgmSound.loop = true;
		this.bgmSound.play();
		if (frame > 0) {
			this.bgmVolumeCmd = ["bgm_volume", 0, volume, frame];
			this.bgmVolumeCount = 0;
		} else {
			this.bgmSound.volume = volume;
		}
	},

	/*
	 * 現在再生しているBGMのボリュームを変更する
	 * 
	 * frameが0の場合は、徐々にではなくすぐにボリュームを変更する。
	 * frameが0以外の場合は、現在のボリュームから指定したフレーム数で変更する。
	 * 
	 * ボリュームが0になると、BGMの再生は停止される
	 */
	changeBGMVolume: function(volume, frame) {
		if (frame > 0) {
			this.bgmVolumeCmd = ["bgm_volume", this.bgmSound.volume, volume, frame];
			this.bgmVolumeCount = 0;
		} else {
			if (volume === 0) {
				this.bgmSound.stop();
			} else {
				this.bgmSound.volume = volume;
			}
		}
	},

	/*
	 * 指定したSEを再生する
	 */
	playSE: function(sound_name, volume) {
		var se = tm.asset.AssetManager.get(sound_name).clone();
		se.volume = volume;
		se.play();
	},

	/*
	 * 非同期コマンドが終わったときにコールバックされる
	 * 
	 * wait_afterがあったら実行し、ない場合はコマンドの実行を進める。
	 * 現状では引数eは使用していない
	 */
	cmdEndCallback: function(e) {
		if ( ! this.executeWaitBeforeAfter(this.script[this.cmdPos - 1], this.waitsAfter)) {
			try {
				this.processScript();
			} catch (e) {
				this.scriptError = e;
			}
		}
	},

	/*
	 * 毎フレームの更新処理
	 * 
	 * コマンドの実行はコールバックベースで行われているので、このメソッドでは、wait等の
	 * ScriptMgrが受け持っている非同期コマンドの制御と、BGMのボリュームの制御を行う。
	 */
	update: function() {
		if (this.scriptError) {
			throw this.scriptError;
		}
		var cmd;
		// ダイアアグがタッチされていたら、waitを終わらせる、もしくは現在表示中のtextを最後まで進める
		var pointing = this.scene.app.pointing;
		if (pointing.getPointing() && this.dialog.isHitPointRect(pointing.x, pointing.y)) {
			if (this.longCmd && this.longCmd[0] === "wait") {
				this.waitCount = this.longCmd[1];
			} else if (this.cmdPos > 0 && this.script[this.cmdPos - 1][0] === "text") {
				this.dialog.completeTextLabelAnimation();
			}
		}		
		// ScriptMgrが受け持っている非同期コマンドの制御
		if (this.longCmd) {
			cmd = this.longCmd;
			switch (cmd[0]) {
			case "wait":
				this.waitCount += 1;
				if (this.waitCount >= cmd[1]) {
					this.longCmd = null;
					this.processScript();
				}
				break;
			case "shake_all":
				this.waitCount += 1;
				this._shakeCanvasElement(this.rootElement, this.waitCount, cmd[1], 0.05);
				if (this.waitCount >= cmd[1]) {
					this.longCmd = null;
					this.cmdEndCallback();
				}
				break;
			case "shake_dialog":
				this.waitCount += 1;
				this._shakeCanvasElement(this.dialog, this.waitCount, cmd[1], 0.1);
				if (this.waitCount >= cmd[1]) {
					this.longCmd = null;
					this.cmdEndCallback();
				}
				break;
			}
		}
		// BGMボリュームの制御
		if (this.bgmVolumeCmd) {
			this.bgmVolumeCount += 1;
			cmd = this.bgmVolumeCmd;
			var volume_ratio = this.bgmVolumeCount / cmd[3];
			this.bgmSound.volume = cmd[1] + (cmd[2] - cmd[1]) * volume_ratio;
			if (volume_ratio >= 1) {
				this.bgmVolumeCmd = null;
				if (cmd[2] === 0) {
					this.bgmSound.stop();
				}
			}
		}
	},

	/*
	 * 指定されたキャンバス要素の振動を行う。elementの位置をcurrent_frameで指定した位置に設定する。
	 * 
	 * どのように振動するかは、振動のトータルの長さと振動の強さパラメータ(swing_rate)から決まる。
	 * current_frameがtotal_frameに等しい場合は、必ず元の位置に戻るようにしている。
	 */
	_shakeCanvasElement: function(element, current_frame, total_frame, swing_rate) {
		var shake_num = Math.ceil(total_frame / 9);
		var swing_value = Math.sin(Math.PI * 2 * (current_frame / total_frame) * shake_num);
		element.x = element.originalX + swing_value * element.width * swing_rate;
		element.y = element.originalY + swing_value * element.height * swing_rate;
	},

	/*
	 *	現在のコマンド位置でエラーが発生したことを示す例外をthrowする
	 */
	_throwErrorWithCmdPos: function(description) {
		var line_no = this.cmdPosToLineNo[this.cmdPos];
		throw {lineNo: line_no, lineText: this.scriptSrc[line_no], desc: description};
	},

	/*
	 * 各コマンドの引数の数の定義
	 */
	_CMD_ARG_NUMS: {
		data: 2, text: 1, set_name: 1, name: 2, wait: 1, shake_all: 1,
		shake_dialog: 1, wait_before: 2, wait_after: 2, default_arg: 3, new_page: 1,
		new_page_name: 1, in_chara: 2, out_chara: 2, set_chara: 2,
		modify_chara: 3, change_chara: 3, move_chara_x: 3, set_bg: 1,
		modify_bg: 2, change_bg: 2, play_bgm: 3, stop_bgm: 1,
		bgm_volume: 3, play_se: 2, title: 1
	}
});

/*
 * CanvasElementに、２つの画像を切り替える機能を追加したもの。
 * 
 * 要素の親子関係としては、このCanvasElementの子として２つのtm.app.Spriteが
 * 付いた形になっている。この２つのSpriteのalphaを操作して切り替える。
 */
tm.define("ChangableImage", {
	superClass: tm.app.CanvasElement,

	/*
	 * 初期化処理
	 * 
	 * 指定されたイメージを表示して初期化する
	 */
	init: function(image, cmdEndCallback) {
		this.superInit();
		this.addEventListener("cmdend", cmdEndCallback);
	    this.x = sp.SCREEN_CENTER_X;
	    this.y = sp.SCREEN_CENTER_Y;
	    this.main = tm.app.Sprite(image).addChildTo(this);
	    this.sub = tm.app.Sprite(image);
	},

	/*
	 * 指定したイメージに変更する
	 */
	setImage: function(image) {
		this._setMainImage(image);
	},

	/*
	 * Main側のイメージを変更する、内部用メソッド
	 */
	_setMainImage: function(image) {
		this.main.image = image;
		this.main.width = this.main.srcRect.width;
		this.main.height = this.main.srcRect.height;
	    this.main.y = sp.SCREEN_CENTER_Y - this.main.height / 2;
	},

	/*
	 * Sub側のイメージを変更する、内部用メソッド
	 */
	_setSubImage: function(image) {
		this.sub.image = image;
		this.sub.width = this.sub.srcRect.width;
		this.sub.height = this.sub.srcRect.height;
	    this.sub.y = sp.SCREEN_CENTER_Y - this.sub.height / 2;
	},

	/*
	 * 表示/非表示を切り替える
	 */
	setVisible: function(is_visible) {
		if (is_visible) {
			this.alpha = 1;
		} else {
			this.alpha = 0;
		}
	},

	/*
	 * 上書きで、元のイメージから指定したイメージに切り替える
	 * 
	 * 元のイメージの上に、上書きで新しいイメージをアルファインして切り替えるので、
	 * イメージの輪郭は変わらずに、中身だけが変わるとき(例えば表情替えのとき)は
	 * changeCrossではなくこちらを使ったほうが自然になる。
	 * 
	 * tweenerを使っているので、処理は非同期で行われる。処理が終わったらコマンド終了
	 * コールバックが呼び出される。
	 */
	changeOverwrite: function(image, milli_sec) {
		this._setSubImage(image);
		this.sub.alpha = 0;
	    this.sub.addChildTo(this);
		this.sub.tweener
			.clear()
			.fadeIn(milli_sec)
			.call(function() {
				this._setMainImage(image);
				this.sub.remove();
				this.dispatchEvent(CmdEndEvent());
			}.bind(this));
	},

	/*
	 * クロスフェードで、元のイメージから指定したイメージに切り替える
	 * 
	 * 元のイメージをアルファアウトして消しながら新しいイメージをアルファインして切り替える。
	 * イメージの輪郭が大きく変わるときにはchangeOverwriteではなくこちらを使用する。
	 * 
	 * tweenerを使っているので、処理は非同期で行われる。処理が終わったらコマンド終了
	 * コールバックが呼び出される。
	 */
	changeCross: function(image, milli_sec) {
		this._setSubImage(image);
		this.sub.alpha = 0;
	    this.sub.addChildTo(this);
		this.sub.tweener.clear().fadeIn(milli_sec);
	    this.main.tweener
			.clear()
	    	.fadeOut(milli_sec)
			.call(function() {
				this._setMainImage(image);
				this.main.alpha = 1;
				this.sub.remove();
				this.dispatchEvent(CmdEndEvent());
			}.bind(this));
	}
});

/*
 * 背景画像クラス
 */
tm.define("BackImage", {
	superClass: ChangableImage,

	init: function(cmdEndCallback) {
		this.superInit("black", cmdEndCallback);
	},

});

/*
 * キャラ画像クラス
 */
tm.define("FigureImage", {
	superClass: ChangableImage,

	/*
	 * 初期化処理
	 */
	init: function(cmdEndCallback) {
		this.superInit("dummy_figure", cmdEndCallback);
	    this.main.y = sp.SCREEN_CENTER_Y - this.main.height / 2;
	    this.sub.y = sp.SCREEN_CENTER_Y - this.sub.height / 2;
	},

	/*
	 * X位置を指定した場所に変更する。位置は0が左端、1が右端となる。
	 */
	setX: function(x_pos) {
		this.x = sp.SCREEN_WIDTH * x_pos;
	},

	/*
	 * X位置を指定した時間で、現在の位置から指定した場所に動かす。位置は0が左端、1が右端となる。
	 * 
	 * tweenerを使用して非同期処理を行う。終了したらコマンド終了コールバックを呼び出す。
	 */
	moveX: function(x_pos, milli_sec) {
		this.tweener
			.clear()
			.to({x:sp.SCREEN_WIDTH * x_pos}, milli_sec)
			.call(function() {
				this.dispatchEvent(CmdEndEvent());
			}.bind(this));
	},

	/*
	 * 指定した時間で、画像をフェードインする。
	 * 
	 * tweenerを使用して非同期処理を行う。終了したらコマンド終了コールバックを呼び出す。
	 */
	fadeIn: function(milli_sec) {
		this.alpha = 0;
		this.tweener
			.clear()
			.fadeIn(milli_sec)
			.call(function() {
				this.dispatchEvent(CmdEndEvent());
			}.bind(this));
	},

	/*
	 * 指定した時間で、画像をフェードアウトする。
	 * 
	 * tweenerを使用して非同期処理を行う。終了したらコマンド終了コールバックを呼び出す。
	 */
	fadeOut: function(milli_sec) {
		this.alpha = 1;
		this.tweener
			.clear()
			.fadeOut(milli_sec)
			.call(function() {
				this.dispatchEvent(CmdEndEvent());
			}.bind(this));
	},
});

/*
 * ダイアログボックスクラス。
 * 
 * このクラス自体はCanvasElementとしてはShapeであり、ダイアログボックスの背景となっている。
 * 子要素として、文字列を表示するLabel、名前の背景のShape、名前を表示するLabelを持つ。
 */
tm.define("Dialog", {
	superClass: tm.app.Shape,

	/*
	 * 初期化処理
	 */
	init: function(cmdEndCallback) {
		this.superInit(sp.SCREEN_WIDTH - sp.DIALOG_X_MARGIN, 200);
		this.addEventListener("cmdend", cmdEndCallback);
		// 自分自身のShape(セリフのテキストの背景)を設定
	    this.x = sp.SCREEN_CENTER_X;
	    this.y = sp.SCREEN_HEIGHT - 120;
	    // 最初のx,yを別のメンバ変数に記録しておく。これは、shakeするときに使われる。
	    this.originalX = this.x;
	    this.originalY = this.y;
	    var color = "rgba(50, 50, 50, 0.5)";
	    this.canvas.setColorStyle(color, color);
	    this.canvas.fillRoundRect(0, 0, sp.SCREEN_WIDTH - sp.DIALOG_X_MARGIN, 200, 20);

	    this.texts = [];
	    this.charSize = 36;
	    this.nameCharSize = 32;
	    this.charLineHeight = 46;
	    this.currentLineNum = 0;
	    this.isAddingText = false;

	    // 名前の背景のShapeを構築・設定
	    this.nameBack = tm.app.Shape(250, 60).addChildTo(this);
	    this.nameBack.x = -sp.SCREEN_CENTER_X + (this.nameBack.width + sp.DIALOG_X_MARGIN) / 2;
	    this.nameBack.y = -120;
	    this.nameBack.canvas.setColorStyle(color, color);
	    this.nameBack.canvas.fillRoundRect(0, 0, 250, 50, 15);

	    // 名前を表示するLabelを構築・設定
	    this.nameText = tm.app.Label("").addChildTo(this.nameBack);
		this.nameText
			.setFontSize(this.nameCharSize)
			.setFontFamily(sp.FONT_FAMILY_FLAT)
			.setAlign("center")
			.setBaseline("middle");
	},

	/*
	 * ダイアログに表示する文字列を全て消す
	 */
	clear: function() {
		for (var i = 0; i < this.texts.length; i++) {
			this.texts[i].remove();
		}
		this.texts = []
	    this.currentLineNum = 0;
	},

	/*
	 * 指定した文字列の行を追加する
	 * 
	 * 現在表示されている文字はそのままで、最後の行の後に追加する。
	 * 文字列が一行より長い場合は、自動的に改行される。
	 * 
	 * 文字は一定のスピードで出て行くので、非同期処理となってる。
	 * 文字をすべて表示し終わったら、終了したらコマンド終了コールバックを呼び出す。
	 */
	addText: function(text) {
		// 5行目以上は表示しない
		if (this.currentLineNum >= 4) {
			return;
		}
		// AnimationLabelを構築
		var label = this._createTextLabel();
		var firstLabel = label;

		// 文字列を1文字ずつ調べていき、改行すべき位置を見つける。
		var textLength = text.length;
		var currentLineStart = 0;
		for (var i = 0; i < textLength; i++) {
			var subText = text.slice(currentLineStart, i);
			var textWidth = label.measureText(subText).width;
			if (textWidth > sp.SCREEN_WIDTH - sp.DIALOG_X_MARGIN - 15) {
				// 改行が必要な場合
				// ここまでの行にy座標とテキストをセットする
				label.y += this.charLineHeight * this.currentLineNum;
				label.setText(text.slice(currentLineStart, i - 1));
				this.currentLineNum += 1;
				if (this.currentLineNum >= 4) {
					// 五行目以上になってしまったらアニメーションを開始して抜ける
					firstLabel.startAnimation();
					this.isAddingText = true;
					return;
				}
				// 新しいAnimationLabelを構築し、さらに改行が必要ないか調査を継続する。
				var newLabel = this._createTextLabel();
				label.setNextLabel(newLabel);
				label = newLabel;
				currentLineStart = i - 1;
			}
		}
		// 最後の1行にy座標とテキストをセットする
		// このif文はほとんどの場合実行される。例外はちょうど改行と同時に文字列が終わった場合。
		if (currentLineStart < textLength) {
			label.y += this.charLineHeight * this.currentLineNum;
			label.setText(text.slice(currentLineStart));
			this.currentLineNum += 1;
		}

		// アニメーションを開始して抜ける
		firstLabel.startAnimation();
		this.isAddingText = true;
	},

	/*
	 * 文字を消して、新しいページにする
	 * 
	 * clearと似ているが、文字(isFadeNameが指定されていたら名前も)を
	 * フェードアウトさせる点が異なる。
	 * 
	 * 文字が消えたら、終了したらコマンド終了コールバックを呼び出す。
	 */
	newPage: function(milli_sec, isFadeName) {
		if (this.texts.length === 0) {
			return;
		}
		// コマンド終了コールバックは最初の行に仕掛ける。それ以外は単にフェードアウトする。
		this.texts[0].tweener
			.clear()
			.fadeOut(milli_sec)
			.call(function() {
				this.clear();
				this.dispatchEvent(CmdEndEvent());
			}.bind(this));
		for (var i = 1; i < this.texts.length; i++) {
			this.texts[i].tweener.clear().fadeOut(milli_sec);
		}
		if (isFadeName) {
			this.nameText.tweener
				.clear()
				.fadeOut(milli_sec);
		}
	},

	/* 
	 * 現在アニメーションのラベルの表示を全て完了させる
	 */
	completeTextLabelAnimation: function() {
		for (var i = 0; i < this.texts.length; i++) {
			this.texts[i].completeAnimation();
		}
	},

	/*
	 * Dialogが使用する設定のAnimationLabelを作るための内部メソッド
	 */
	_createTextLabel: function() {
		var label = AnimationLabel();
		label
			.setFontSize(this.charSize)
			.setFontFamily(sp.FONT_FAMILY_FLAT)
			.setAlign("left")
			.setBaseline("top");
		label.x = -this.width/2 + 12;
		label.y = -this.height/2 + 12;
		label.addChildTo(this);
		this.texts.push(label);
		return label;
	},

	/*
	 * 名前を設定する
	 */
	setName: function(name) {
		this.nameText.text = name;
	},

	/*
	 * 名前をフェードインする
	 */
	fadeInName: function(name, milli_sec) {
		this.setName(name);
		this.nameText.alpha = 0;
		this.nameText.tweener
			.clear()
			.fadeIn(milli_sec)
			.call(function() {
				this.dispatchEvent(CmdEndEvent());
			}.bind(this));
	},

	/*
	 * CanvasElementとしての更新処理。毎フレーム呼び出される。
	 * 
	 * テキストのアニメーションを監視して、終わったらコマンド終了コールバックを呼び出す。
	 */
	update: function() {
		if (this.isAddingText) {
			var is_animate = false;
			for (var i = 0; i < this.texts.length; i++) {
				if (this.texts[i].isAnimate) {
					is_animate = true;
				}
			}
			if ( ! is_animate) {
				this.isAddingText = false;
				this.dispatchEvent(CmdEndEvent());
			}
		}
	}
});

/*
 * コマンド終了を表すイベント
 */
tm.define("CmdEndEvent", {
	superClass: tm.event.Event,

	init: function() {
		this.superInit("cmdend");
	}
});

/*
 * 1文字ずつアニメーションして表示するLabel
 */
tm.define("AnimationLabel", {
	superClass: tm.app.Label,

	/*
	 * 初期化処理
	 */
	init: function() {
		this.superInit("");
		this.wholeText = "";
		this.isAnimate = false;
		this.stepWidth = 16;
		this.currentStepWidth = 0;
		this.currentPos = 0;
		this.nextLabel = null;
	},
 
	/*
	 * テキストの内容をセットする
	 */
	setText: function(text) {
		this.wholeText = text;
	},

	/*
	 * 次の行のラベルを設定する。アニメーションが終わった時に、ここで設定した
	 * ラベルのアニメーションを起動する。
	 */
	setNextLabel: function(nextLabel_) {
		this.nextLabel = nextLabel_;
	},

	/*
	 * アニメーションを開始する
	 */
	startAnimation: function() {
		this.text = "";
		this.isAnimate = true;
		this.currentStepWidth = 0;
		this.currentPos = 0;
	},

	/*
	 * CanvasElementとしての更新処理。毎フレーム呼び出される
	 * 
	 * 文字を一定の速度で表示していく。
	 */
	update: function() {
		if ( ! this.isAnimate) {
			return;
		}
		// 表示する幅を進める。このクラスでは、アニメーションは1フレームに1文字というのではなく、文字を表示する
		// 幅を1フレームに一定値ずつ広げていき、そこより右側の文字を表示するという処理にしている。そのほうが自然に
		// 見えるため。
		this.currentStepWidth += this.stepWidth;
		if (this.measureText(this.wholeText.slice(0, this.currentPos + 1)).width > this.currentStepWidth) {
			return;
		}
		this.currentPos += 1;
		if (this.currentPos < this.wholeText.length) {
			this.text = this.wholeText.slice(0, this.currentPos);
		} else {
			this.text = this.wholeText;
			this.isAnimate = false;
			if (this.nextLabel) {
				this.nextLabel.startAnimation();
				this.nextLabel = null;
			}
		}
	},

	/*
	 * アニメーションを完了させる
	 */
	completeAnimation: function() {
		this.text = this.wholeText;
		this.isAnimate = false;
		if (this.nextLabel) {
			this.nextLabel.completeAnimation();
			this.nextLabel = null;
		}
	},

	/*
	 * 指定した文字列の文字幅を取得する
	 * 
	 * このラベルに設定されたfontStyleで幅を計算する。
	 */
	measureText: function(text) {
		if ( ! AnimationLabel.dummyCanvas) {
			AnimationLabel.dummyCanvas = document.createElement("canvas");
			AnimationLabel.dummyContext = AnimationLabel.dummyCanvas.getContext("2d");
		}
	    AnimationLabel.dummyContext.font = this.fontStyle;
		return AnimationLabel.dummyContext.measureText(text);
	}
});
