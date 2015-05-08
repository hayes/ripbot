var Youtube = require('youtube-api')

module.exports = youtube

function youtube(robot) {
  Youtube.authenticate({
    type: 'key',
    key: 'AIzaSyCLsSUhzOsJfNgEpmd2OWSdTUhasuz3NNw'
  })

  robot.respond(/(?:youtube|yt)(?: me)? (.*)/i, function getVideo(msg) {
    Youtube.search.list({
      q: msg.match[1],
      maxResults: 10,
      part: 'id'
    }, reply)

    function reply(err, results) {
      if (err) return console.error(err)
      msg.send('https://www.youtube.com/watch?v=' + msg.random(results.items).id.videoId)
    }
  })
}
