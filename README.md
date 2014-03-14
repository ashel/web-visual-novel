web-visual-novel
================

##このプログラムについて

ブラウザ上でスクリプトベースのビジュアルノベルを再生するプログラムです。

[tmlib](http://phi-jp.github.io/tmlib.js/)を利用して書かれています。

スクリプトの仕様など、詳しい説明は、[ビジュアルノベル作成サイト](http://plk.sakura.ne.jp/wvn/)
を参照してください。

##各ファイルの説明

  * **data** - スクリプトから参照するデータ類を格納するフォルダです。
  * **jslib**
    * **scene.js** - script-player.jsを利用したゲーム画面です。ロード画面、エラー画面も含みます。
    * **script-player.js** - 本プログラムの本体です。スクリプトの解釈と画面の駆動を行います。
    * **tmlib.js** - tmlib.js 0.2.0です。ただし、modify:とコメントを付けた箇所で改変を行っています。
  * **play-form.cgi** - フォームからpostされたスクリプトを表示するためのcgiです。rubyで書かれています。
  * **play-form.js** - play-form.cgiで使用しているJavaScriptです。
  * **play-gist.html** - gistに投稿されたスクリプトを駆動します。クエリ文字列で、「?id=gistのid」としてください。
  * **play-gist.js** - play-gist.htmlで使用しているJavaScriptです。
  * **test_cgiserver.rb** - play-form.cgiのテストを行うためにwebrickのサーバを立ち上げるためのrubyスクリプトです。
  * **test_form.html** - play-form.cgiのテストを行うためのformを含んだhtmlファイルです。
  * **test_local.js** - ローカルで動作をテストするためのJavaScriptです。
  * **test_script0.html** - test_script0.txtの内容を再生するWebページです。ブラウザ側でローカルから動的にファイルを読み込むための設定が必要であることに注意してください。例えばChromeでは、実行時に引数で--allow-file-access-from-filesを指定します。
  * **test_script0.txt** - test_script0.htmlで再生するスクリプトです。

##ライセンス

このプログラムは、[MIT license](http://www.opensource.org/licenses/mit-license.php)で配布します。

ただし、jslib/tmlib.js は tmlib.js のライセンスとします。
