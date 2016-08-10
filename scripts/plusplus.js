var _ = require('underscore');
var querystring = require('querystring')
var ScoreKeeper = require('./scorekeeper')

var matcher = /^([\s\w'@.-:]*)\s*([-+]{2}|—)(?:\s+(?:for|because|cause|cuz)\s+(.+))?$/i
var eraseMatcher = /(?:erase)([\s\w'@.-:]+?)(?:\s+(?:for|because|cause|cuz)\s+(.+))?$/i

module.exports = function plusplus(robot) {
  var scoreKeeper = new ScoreKeeper(robot)

  robot.hear(matcher, onMessage);
  robot.respond(/score (for\s)?(.*)/i, getScore)
  robot.respond(eraseMatcher, erase)


  robot.respond(/(top|bottom) (\d+)/i, function(msg) {
    var amount, graphSize, i, j, message, ref, tops;
    amount = parseInt(msg.match[2]) || 10;
    message = [];
    tops = scoreKeeper[msg.match[1]](amount);
    if (tops.length > 0) {
      for (i = j = 0, ref = tops.length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        message.push((i + 1) + ". " + tops[i].name + " : " + tops[i].score);
      }
    } else {
      message.push("No scores to keep track of yet!");
    }
    if (msg.match[1] === "top") {
      graphSize = Math.min(tops.length, Math.min(amount, 20));
      // does not apprear to work with groupme
      // message.splice(0, 0, clark(_.first(_.pluck(tops, "score"), graphSize)));
    }
    return msg.send(message.join("\n"));
  });
  robot.router.get("/" + robot.name + "/normalize-points", function(req, res) {
    scoreKeeper.normalize(function(score) {
      if (score > 0) {
        score = score - Math.ceil(score / 10);
      } else if (score < 0) {
        score = score - Math.floor(score / 10);
      }
      return score;
    });
    return res.end(JSON.stringify('done'));
  });
  return robot.router.get("/" + robot.name + "/scores", function(req, res) {
    var amount, direction, obj, query, tops;
    query = querystring.parse(req._parsedUrl.query);
    if (query.name) {
      obj = {};
      obj[query.name] = scoreKeeper.scoreForUser(query.name);
      return res.end(JSON.stringify(obj));
    } else {
      direction = query.direction || "top";
      amount = query.limit || 10;
      tops = scoreKeeper[direction](amount);
      return res.end(JSON.stringify(tops, null, 2));
    }
  })

  function onMessage(msg) {
    var name = msg.match[1]
    var operator = msg.match[2]
    var reason = msg.match[3]
    var from = msg.message.user.name.toLowerCase()
    var room = msg.message.room

    reason = reason && typeof reason === 'string' ? reason.trim().toLowerCase() : null

    if (name) {
      name = (name.replace(/(^\s*@)|([,:\s]*$)/g, '')).trim().toLowerCase()
    }

    if (!((name != null) && name !== '')) {
      var last = scoreKeeper.last(room)
      var name = last[0]
      var lastReason = last[1]

      if ((reason == null) && (lastReason != null)) {
        reason = lastReason
      }
    }

    var result = operator === '++' ?
      scoreKeeper.add(name, from, room, reason) :
      scoreKeeper.subtract(name, from, room, reason)

    var score = result[0]
    var reasonScore = result[1]

    if (!score && score !== 0) return

    if (operator === '++') {
      var message = name + ' has ' + score + pluralize(' Rip Point', score)

      if (reason) {
          message += ', ' + reasonScore + ' of which '
            + pluralize('', reasonScore, 'are', 'is')
            + ' for ' + reason + (reason[reason.length - 1] === '.' ? '' : '.')
      }
    } else {
      message = 'ouch! ' + name + ' loses a Rip Point'
      if (reason) message += ' for ' + reason
      message += '. ' + name + ' now has ' + score + pluralize(' Rip Point', score)
    }

    msg.send(message)
    return robot.emit('plus-one', {
      name: name,
      direction: operator,
      room: room,
      reason: reason
    })
  }

  function getScore(msg) {
    var name = cleanName(msg.match[2])
    var score = scoreKeeper.scoreForUser(name)
    var reasons = scoreKeeper.reasonsForUser(name)
    var message = name + ' has ' + score + pluralize(' Rip Point', score)

    if (typeof reasons === 'object' && Object.keys(reasons).length > 0) {
      message += ' here are some reasons:'
      message += _.reduce(reasons, function formatScore(memo, val, key) {
        return memo += '\n' + key + ': ' + val + pluralize(' Rip Point', val)
      }, '')
    }

    msg.send(message)
  }

  function erase(msg) {
    var name =  cleanName(msg.match[1])
    var reason = msg.match[2] ? msg.match[2].trim().toLowerCase() : null
    var from = msg.message.user.name.toLowerCase()
    var user = msg.envelope.user;
    var room = msg.message.room;

    var isAdmin = this.robot.auth && (
      this.robot.auth.hasRole(user, 'plusplus-admin') ||
      this.robot.auth.hasRole(user, 'admin')
    )

    if (this.robot.auth && !isAdmin) {
      return msg.reply('Sorry, you don\'t have authorization to do that.')
    }

    if (scoreKeeper.erase(name, from, room, reason)) {
      message = reason != null ?
        'Erased the following reason from ' + name + ': ' + reason :
        'Erased Rip Points for ' + name

      return msg.send(message)
    }
  }
}

function pluralize(str, n, sfx, single) {
  return Math.abs(n) === 1 ? str + (single || '') : str + (sfx || 's')
}

function cleanName(name) {
  return name ? name.replace(/(^\s*@)|([,:\s]*$)/g, '').trim().toLowerCase() : name
}
