/*
 * Copyright 2012 buddycloud
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// sync.js:
// Handles requests to synchronize unread counters and posts (/sync).

var config = require('./util/config');
var session = require('./util/session');
var api = require('./util/api');
var recent = require('./util/recent');
var pubsub = require('./util/pubsub');
var atom = require('./util/atom');
var url = require('url');
var crypto = require('crypto');

var xmpp = require('node-xmpp');
var xml = require('libxmljs');

/**
 * Registers resource URL handlers.
 */
exports.setup = function(app) {
  app.get('/:channel/content/:node/:item/replyto',
           session.provider,
           getReplies);
};

//// GET /:channel/content/:node/:item/replyto /////////////////////////////////////////////////////////////
function getReplies(req, res) {
  var user = req.user;
  if (!user) {
    api.sendUnauthorized(res);
    return;
  }

  var channel = req.params.channel;
  var node = req.params.node;
  var itemId = req.params.item;

  var jsonResponse = {};

  var callback = function(reply) {
    var items = xml.parseXmlString(reply.toString()).find('/iq/p:pubsub/p:items', {
	  p: pubsub.ns
	});
	json = [];
	items.forEach(function(e) {
      var entries = e.find('p:item/a:entry', {
        p: pubsub.ns,
        a: atom.ns
      });
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var jsonEntry = atom.toJSON(entry);
        json.push(jsonEntry);
      }
    });
    
	res.contentType('json');
    res.send(json);
  }

  requestReplies(req, res, channel, node, itemId, callback);
}

function iq(attrs, ns) {
  return new xmpp.Iq(attrs).c('pubsub', {xmlns: ns});
}

function createRepliesIQ(channel, node, itemId) {
  var pubsubNode = iq({type: 'get'}, pubsub.ns);
  pubsubNode.c('replies', {
    xmlns: 'http://buddycloud.org/v1', 
    node: '/user/' + channel + '/' + node, 
    item_id: itemId
  });
  return pubsubNode.root();
}

function requestReplies(req, res, channel, node, itemId, callback) {
  var repliesIq = createRepliesIQ(channel, node, itemId);
  api.sendQuery(req, res, repliesIq, callback);
}