#!/usr/local/bin/ruby
require 'webrick'

# http://localhost:10022/

def webrick(config = {})
  WEBrick::HTTPServer.new(config).instance_eval do |server|
    [:INT, :TERM].each do |signal|
      Signal.trap(signal) { shutdown }
    end
    start
  end
end

webrick :DocumentRoot => Dir.pwd,
        :Port => 10022,
        :CGIInterpreter => WEBrick::HTTPServlet::CGIHandler::Ruby
