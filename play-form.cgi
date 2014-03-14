#!/usr/local/bin/ruby
require 'uri'

post_data = STDIN.read(ENV["CONTENT_LENGTH"].to_i)

puts "Content-Type: text/html"
puts
puts <<EOS
<!DOCTYPE html>

<html>
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, user-scalable=no">
	<meta name="apple-mobile-web-app-capable" content="yes">
	<title>visual-novel-scirpt</title>
	<script src= "jslib/tmlib.js"></script>
	<script>var QUERY_STRING = "#{post_data}"</script>
	<script src= "jslib/script-player.js"></script>
	<script src= "jslib/scene.js"></script>
	<script src= "play-form.js"></script>
</head>
<body>
    <canvas id="world"></canvas>
</body>
</html>
EOS
